import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

function loadEnvFile(relativePath) {
  const fullPath = path.resolve(process.cwd(), relativePath);
  if (!existsSync(fullPath)) return;
  const content = readFileSync(fullPath, 'utf8');
  const lines = content.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIndex = line.indexOf('=');
    if (eqIndex <= 0) continue;
    const key = line.slice(0, eqIndex).trim();
    const value = line.slice(eqIndex + 1).trim();
    if (!key) continue;
    if (process.env[key] === undefined || process.env[key] === '') {
      process.env[key] = value;
    }
  }
}

// Auto-load local env files for dev orchestrator runs.
loadEnvFile('.env');
loadEnvFile('.env.local');

const port = Number(process.env.AI_ORCHESTRATOR_PORT || 8787);
const supabaseUrl = String(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
).replace(/\/$/, '');
const supabaseAnonKey = String(
  process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
);
const openRouterApiKey = String(process.env.OPENROUTER_API_KEY || '');
const openRouterModel = String(process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini');
const openRouterBaseUrl = String(process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1');

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '[ai-orchestrator] Missing SUPABASE_URL / SUPABASE_ANON_KEY. Set these before running.'
  );
}
if (!openRouterApiKey) {
  console.warn(
    '[ai-orchestrator] OPENROUTER_API_KEY missing. Falling back to regex intent and static phrasing.'
  );
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  });
  res.end(JSON.stringify(payload));
}

function normalizeMessage(message) {
  return String(message || '').trim().toLowerCase();
}

function shouldListConfirmed(message) {
  return /(confirmed|is confirmed|are confirmed|what.*confirmed|which.*confirmed)/.test(message);
}

function shouldListMyAvailability(message) {
  return /(what|where).*(available|availability)|made myself available|my availability/.test(
    message
  );
}

function shouldListAttendees(message) {
  return /\bwho\b.*\bcoming\b|\bwho\b.*\bgoing\b|\battendees?\b|\bwho is coming\b/.test(
    message
  );
}

function shouldProposeActivity(message) {
  const hasPlanningVerb = /\b(propose|plan|suggest|organize)\b/.test(message);
  const hasActivityNoun =
    /\b(activity|event|night out|night on the town|outing|dinner|drinks)\b/.test(message);
  return hasPlanningVerb && hasActivityNoun;
}

async function callOpenRouter(messages, options = {}) {
  if (!openRouterApiKey) return null;
  const response = await fetch(`${openRouterBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openRouterApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: openRouterModel,
      messages,
      temperature: options.temperature ?? 0,
      max_tokens: options.maxTokens ?? 180,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenRouter error (${response.status}): ${body}`);
  }

  const payload = await response.json();
  return String(payload?.choices?.[0]?.message?.content || '').trim();
}

async function classifyIntent(message) {
  // Deterministic intent shortcuts for high-confidence phrasing.
  if (shouldListConfirmed(message)) return 'list_confirmed';
  if (shouldListMyAvailability(message)) return 'list_my_availability';
  if (shouldListAttendees(message)) return 'list_attendees';
  if (shouldProposeActivity(message)) return 'propose_activity';

  if (!openRouterApiKey) {
    return 'unsupported';
  }

  try {
    const prompt = [
      {
        role: 'system',
        content:
        'Classify the user request into exactly one label: list_confirmed, list_my_availability, list_attendees, propose_activity, unsupported. Respond with only the label.',
      },
      {
        role: 'user',
        content: message,
      },
    ];
    const result = await callOpenRouter(prompt, { maxTokens: 12, temperature: 0 });
    if (
      result === 'list_confirmed' ||
      result === 'list_my_availability' ||
      result === 'list_attendees' ||
      result === 'propose_activity' ||
      result === 'unsupported'
    ) {
      return result;
    }
  } catch (error) {
    console.warn(`[ai-orchestrator] intent classification fallback: ${String(error)}`);
  }

  if (shouldListConfirmed(message)) return 'list_confirmed';
  if (shouldListMyAvailability(message)) return 'list_my_availability';
  if (shouldListAttendees(message)) return 'list_attendees';
  if (shouldProposeActivity(message)) return 'propose_activity';
  return 'unsupported';
}

async function fetchConfirmedProposals({ authToken, activeGroupId }) {
  const query = new URLSearchParams({
    select: 'id,title,type,status,specifics_json,created_at',
    status: 'eq.confirmed',
    order: 'created_at.asc',
  });
  if (activeGroupId) {
    query.append('group_id', `eq.${activeGroupId}`);
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/proposals?${query.toString()}`, {
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${authToken}`,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to fetch confirmed proposals (${response.status}): ${body}`);
  }

  return response.json();
}

async function fetchMyAvailabilityWithTitles({ authToken, userId, activeGroupId }) {
  const availabilityQuery = new URLSearchParams({
    select: 'proposal_id,dates_json',
    user_id: `eq.${userId}`,
  });
  if (activeGroupId) {
    availabilityQuery.append('group_id', `eq.${activeGroupId}`);
  }

  const availabilityResponse = await fetch(
    `${supabaseUrl}/rest/v1/availabilities?${availabilityQuery.toString()}`,
    {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${authToken}`,
      },
    }
  );

  if (!availabilityResponse.ok) {
    const body = await availabilityResponse.text();
    throw new Error(`Failed to fetch availabilities (${availabilityResponse.status}): ${body}`);
  }

  const availabilities = await availabilityResponse.json();
  const proposalIds = Array.from(
    new Set(
      availabilities
        .map((row) => row.proposal_id)
        .filter(Boolean)
    )
  );

  if (proposalIds.length === 0) {
    return [];
  }

  const idList = proposalIds.join(',');
  const proposalQuery = new URLSearchParams({
    select: 'id,title,type,status',
    id: `in.(${idList})`,
  });
  if (activeGroupId) {
    proposalQuery.append('group_id', `eq.${activeGroupId}`);
  }

  const proposalResponse = await fetch(
    `${supabaseUrl}/rest/v1/proposals?${proposalQuery.toString()}`,
    {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${authToken}`,
      },
    }
  );

  if (!proposalResponse.ok) {
    const body = await proposalResponse.text();
    throw new Error(`Failed to fetch proposals (${proposalResponse.status}): ${body}`);
  }

  const proposals = await proposalResponse.json();
  const proposalsById = new Map(proposals.map((proposal) => [proposal.id, proposal]));

  return availabilities
    .map((availability) => ({
      proposalId: availability.proposal_id,
      dates: Array.isArray(availability.dates_json) ? availability.dates_json : [],
      proposal: proposalsById.get(availability.proposal_id) || null,
    }))
    .filter((entry) => entry.proposal && entry.dates.length > 0);
}

async function fetchProposalById({ authToken, proposalId, activeGroupId }) {
  const query = new URLSearchParams({
    select: 'id,title,type,status,specifics_json',
    id: `eq.${proposalId}`,
    limit: '1',
  });
  if (activeGroupId) {
    query.append('group_id', `eq.${activeGroupId}`);
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/proposals?${query.toString()}`, {
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${authToken}`,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to fetch proposal by id (${response.status}): ${body}`);
  }

  const rows = await response.json();
  return rows[0] || null;
}

async function fetchAttendeesForProposal({ authToken, proposalId, activeGroupId }) {
  const availabilityQuery = new URLSearchParams({
    select: 'user_id,dates_json',
    proposal_id: `eq.${proposalId}`,
  });
  if (activeGroupId) {
    availabilityQuery.append('group_id', `eq.${activeGroupId}`);
  }

  const availabilityResponse = await fetch(
    `${supabaseUrl}/rest/v1/availabilities?${availabilityQuery.toString()}`,
    {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${authToken}`,
      },
    }
  );

  if (!availabilityResponse.ok) {
    const body = await availabilityResponse.text();
    throw new Error(`Failed to fetch attendees (${availabilityResponse.status}): ${body}`);
  }

  const availabilityRows = await availabilityResponse.json();
  const userIds = Array.from(
    new Set(
      availabilityRows
        .filter((row) => Array.isArray(row.dates_json) && row.dates_json.length > 0)
        .map((row) => row.user_id)
        .filter(Boolean)
    )
  );

  if (userIds.length === 0) return [];

  const idList = userIds.join(',');
  const profilesQuery = new URLSearchParams({
    select: 'id,display_name',
    id: `in.(${idList})`,
  });
  const profileResponse = await fetch(`${supabaseUrl}/rest/v1/profiles?${profilesQuery.toString()}`, {
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${authToken}`,
    },
  });

  if (!profileResponse.ok) {
    // If profile lookup is restricted by policy, still return user ids.
    return userIds.map((userId) => ({ id: userId, name: userId }));
  }

  const profiles = await profileResponse.json();
  const byId = new Map(profiles.map((profile) => [profile.id, profile.display_name || profile.id]));
  return userIds.map((userId) => ({ id: userId, name: byId.get(userId) || userId }));
}

function formatConfirmedAnswer(rows) {
  if (!rows || rows.length === 0) {
    return 'No confirmed activities found for your current scope.';
  }

  const lines = rows.map((row) => {
    const specifics = row.specifics_json || {};
    const date = specifics.date ? ` on ${specifics.date}` : '';
    const time = specifics.time ? ` at ${specifics.time}` : '';
    return `- ${row.title} (${row.type})${date}${time}`;
  });

  return `Confirmed activities:\n${lines.join('\n')}`;
}

function formatAvailabilityAnswer(rows) {
  if (!rows || rows.length === 0) {
    return 'You have no saved availability yet.';
  }

  const lines = rows.map((row) => {
    const label = row.proposal?.title || row.proposalId;
    const dates = row.dates.slice(0, 3).join(', ');
    const extra = row.dates.length > 3 ? ` (+${row.dates.length - 3} more)` : '';
    return `- ${label}: ${dates}${extra}`;
  });
  return `Your availability:\n${lines.join('\n')}`;
}

function formatIsoDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getCurrentWeekBounds(now = new Date()) {
  const current = new Date(now);
  current.setHours(0, 0, 0, 0);
  const day = current.getDay(); // 0=Sun..6=Sat
  const offsetToMonday = day === 0 ? -6 : 1 - day;
  const start = new Date(current);
  start.setDate(current.getDate() + offsetToMonday);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return {
    startIso: formatIsoDate(start),
    endIso: formatIsoDate(end),
  };
}

function getNextWeekBounds(now = new Date()) {
  const current = new Date(now);
  current.setHours(0, 0, 0, 0);
  const day = current.getDay(); // 0=Sun..6=Sat
  const offsetToMonday = day === 0 ? -6 : 1 - day;
  const start = new Date(current);
  start.setDate(current.getDate() + offsetToMonday + 7);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return {
    startIso: formatIsoDate(start),
    endIso: formatIsoDate(end),
    startDate: start,
  };
}

const WEEKDAY_MATCHERS = [
  { label: 'Monday', offset: 0, pattern: /\b(mon|monday)\b/ },
  { label: 'Tuesday', offset: 1, pattern: /\b(tue|tues|tuesday)\b/ },
  { label: 'Wednesday', offset: 2, pattern: /\b(wed|weds|wednesday)\b/ },
  { label: 'Thursday', offset: 3, pattern: /\b(thu|thur|thurs|thursday)\b/ },
  { label: 'Friday', offset: 4, pattern: /\b(fri|friday)\b/ },
  { label: 'Saturday', offset: 5, pattern: /\b(sat|saturday)\b/ },
  { label: 'Sunday', offset: 6, pattern: /\b(sun|sunday)\b/ },
];

function parseRequestedWeekdays(message) {
  return WEEKDAY_MATCHERS.filter((entry) => entry.pattern.test(message));
}

function getWeekendBoundsForDate(now = new Date(), offsetWeeks = 0) {
  const current = new Date(now);
  current.setHours(0, 0, 0, 0);
  const day = current.getDay(); // 0 Sun ... 6 Sat
  const daysUntilSaturday = (6 - day + 7) % 7;
  const saturday = new Date(current);
  saturday.setDate(current.getDate() + daysUntilSaturday + offsetWeeks * 7);
  const sunday = new Date(saturday);
  sunday.setDate(saturday.getDate() + 1);
  return {
    startIso: formatIsoDate(saturday),
    endIso: formatIsoDate(sunday),
    label: `${formatIsoDate(saturday)} to ${formatIsoDate(sunday)}`,
  };
}

function getMonthIndexFromName(message) {
  const months = [
    'january',
    'february',
    'march',
    'april',
    'may',
    'june',
    'july',
    'august',
    'september',
    'october',
    'november',
    'december',
  ];
  for (let i = 0; i < months.length; i += 1) {
    if (message.includes(months[i])) return i;
  }
  return null;
}

function getOrdinalWeekRangeInMonth(now, monthIndex, ordinalWord) {
  const ordinals = {
    first: 0,
    second: 1,
    third: 2,
    fourth: 3,
  };
  const ordinalIndex = ordinals[ordinalWord];
  if (ordinalIndex === undefined) return null;

  const currentYear = now.getFullYear();
  const monthHasPassed = monthIndex < now.getMonth();
  const year = monthHasPassed ? currentYear + 1 : currentYear;
  const monthStart = new Date(year, monthIndex, 1);
  monthStart.setHours(0, 0, 0, 0);
  const offsetToMonday = monthStart.getDay() === 0 ? 1 : ((8 - monthStart.getDay()) % 7);
  const firstMonday = new Date(monthStart);
  firstMonday.setDate(monthStart.getDate() + offsetToMonday);
  const start = new Date(firstMonday);
  start.setDate(firstMonday.getDate() + ordinalIndex * 7);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  return {
    startIso: formatIsoDate(start),
    endIso: formatIsoDate(end),
    label: `${ordinalWord} week of ${start.toLocaleString('en-US', { month: 'long' })} (${formatIsoDate(start)} to ${formatIsoDate(end)})`,
  };
}

function extractJsonObject(text) {
  const value = String(text || '').trim();
  if (!value) return null;
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] || value).trim();
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

function normalizeModelTimingResult(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const kind = raw.kind;
  if (kind === 'dates' && Array.isArray(raw.dates)) {
    const dates = raw.dates
      .filter((d) => d && typeof d.isoDate === 'string')
      .map((d) => ({
        label: typeof d.label === 'string' && d.label.trim() ? d.label.trim() : d.isoDate,
        isoDate: d.isoDate,
      }));
    if (dates.length > 0) return { kind: 'dates', dates };
  }
  if (
    kind === 'window' &&
    raw.window &&
    typeof raw.window.startIso === 'string' &&
    typeof raw.window.endIso === 'string'
  ) {
    return {
      kind: 'window',
      window: {
        label:
          typeof raw.window.label === 'string' && raw.window.label.trim()
            ? raw.window.label.trim()
            : `${raw.window.startIso} to ${raw.window.endIso}`,
        startIso: raw.window.startIso,
        endIso: raw.window.endIso,
      },
    };
  }
  return null;
}

function normalizeWhitespace(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripTrailingPunctuation(value) {
  return normalizeWhitespace(value).replace(/[.,;:!?]+$/, '').trim();
}

function inferBasicPlaceFromMessage(message) {
  const atMatch = message.match(/\bat\s+([^.,!?\n]+?)(?:\s+(?:on|this|next|tomorrow|at)\b|[.!?]|$)/i);
  if (atMatch?.[1]) return stripTrailingPunctuation(atMatch[1]);

  const inMatch = message.match(/\bin\s+([^.,!?\n]+?)(?:\s+(?:on|this|next|tomorrow|at)\b|[.!?]|$)/i);
  if (inMatch?.[1]) return stripTrailingPunctuation(inMatch[1]);

  return '';
}

function inferBasicRequirementFromMessage(message) {
  const bringMatch = message.match(/\b(bring [^.!\n]+)(?:[.!?]|$)/i);
  if (bringMatch?.[1]) return stripTrailingPunctuation(bringMatch[1]);

  const requirementMatch = message.match(/\b(?:must|please)\s+([^.!\n]+)(?:[.!?]|$)/i);
  if (requirementMatch?.[1]) return stripTrailingPunctuation(requirementMatch[1]);

  return '';
}

function inferBasicTimeFromMessage(message) {
  const m = message.match(/\b(\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/i);
  if (m?.[1]) return normalizeWhitespace(m[1]).toUpperCase();
  return '';
}

function inferBasicTitleFromMessage(message) {
  if (/\blunch\b/i.test(message)) return 'Lunch';
  if (/\bdinner\b/i.test(message)) return 'Dinner';
  if (/\bbrunch\b/i.test(message)) return 'Brunch';
  if (/\bbreakfast\b/i.test(message)) return 'Breakfast';
  if (/\bdrinks\b/i.test(message)) return 'Drinks';
  if (/\bhike\b/i.test(message)) return 'Hike';
  if (/\bnight on the town\b/i.test(message)) return 'Night on the Town';
  if (/\bnight out\b/i.test(message)) return 'Night Out';
  return '';
}

function normalizeModelProposalDraft(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const proposalType = raw.proposalType === 'sejour' ? 'sejour' : 'event';
  const title = typeof raw.title === 'string' ? normalizeWhitespace(raw.title) : '';
  const dates = typeof raw.dates === 'string' ? normalizeWhitespace(raw.dates) : '';
  const times = typeof raw.times === 'string' ? normalizeWhitespace(raw.times) : '';
  const invitees = typeof raw.invitees === 'string' ? normalizeWhitespace(raw.invitees) : '';
  const place = typeof raw.place === 'string' ? normalizeWhitespace(raw.place) : '';
  const requirements =
    typeof raw.requirements === 'string' ? normalizeWhitespace(raw.requirements) : '';
  const comments = typeof raw.comments === 'string' ? normalizeWhitespace(raw.comments) : '';

  return {
    proposalType,
    title,
    dates,
    times,
    invitees,
    place,
    requirements,
    comments,
  };
}

async function extractProposalDraftFields(rawMessage, temporalRequest) {
  const message = normalizeMessage(rawMessage);
  const now = new Date();
  const todayIso = formatIsoDate(now);

  const deterministic = {
    proposalType:
      /\btrip\b|\btravel\b|\bvacation\b|\bweekend getaway\b|\bsejour\b/.test(message)
        ? 'sejour'
        : 'event',
    title: inferBasicTitleFromMessage(rawMessage),
    dates:
      temporalRequest.kind === 'dates'
        ? temporalRequest.dates.map((d) => d.isoDate).join(', ')
        : temporalRequest.kind === 'window'
        ? `${temporalRequest.window.startIso} to ${temporalRequest.window.endIso}`
        : '',
    times: inferBasicTimeFromMessage(rawMessage),
    invitees:
      /\binvite everyone\b|\binvite all\b|\bour group\b|\bgroup\b/.test(message)
        ? 'Everyone in active group'
        : 'Everyone in active group',
    place: inferBasicPlaceFromMessage(rawMessage),
    requirements: inferBasicRequirementFromMessage(rawMessage),
    comments: '',
  };

  if (!openRouterApiKey) {
    return deterministic;
  }

  try {
    const prompt = [
      {
        role: 'system',
        content:
          `Extract an activity proposal form from the user message. Today is ${todayIso}. ` +
          `Return JSON only with keys: ` +
          `proposalType ("event"|"sejour"), title, dates, times, invitees, place, requirements, comments. ` +
          `Rules: resolve relative dates (tomorrow, this coming weekend, first week in April) into ISO dates. ` +
          `Use "YYYY-MM-DD" or "YYYY-MM-DD to YYYY-MM-DD" for dates. ` +
          `Infer title from the activity (e.g. lunch, dinner, hike). ` +
          `Put constraints like "Bring your own wine" in requirements. ` +
          `If a field is unknown, use empty string. No prose.`,
      },
      {
        role: 'user',
        content: rawMessage,
      },
    ];

    const modelText = await callOpenRouter(prompt, { maxTokens: 320, temperature: 0 });
    const parsed = normalizeModelProposalDraft(extractJsonObject(modelText));
    if (!parsed) return deterministic;

    return {
      proposalType: parsed.proposalType || deterministic.proposalType,
      title: parsed.title || deterministic.title,
      dates: parsed.dates || deterministic.dates,
      times: parsed.times || deterministic.times,
      invitees: parsed.invitees || deterministic.invitees,
      place: parsed.place || deterministic.place,
      requirements: parsed.requirements || deterministic.requirements,
      comments: parsed.comments || deterministic.comments,
    };
  } catch (error) {
    console.warn(`[ai-orchestrator] proposal field extraction fallback: ${String(error)}`);
    return deterministic;
  }
}

async function resolveTemporalRequest(rawMessage) {
  const message = normalizeMessage(rawMessage);
  const now = new Date();

  // Deterministic shortcuts for common phrases and offline fallback.
  if (/\btomorrow\b/.test(message)) {
    const d = new Date(now);
    d.setDate(now.getDate() + 1);
    return { kind: 'dates', dates: [{ label: `Tomorrow (${formatIsoDate(d)})`, isoDate: formatIsoDate(d) }] };
  }
  if (/\b(this coming weekend|coming weekend|this weekend)\b/.test(message)) {
    const weekend = getWeekendBoundsForDate(now, 0);
    return { kind: 'window', window: weekend };
  }
  if (/\bnext weekend\b/.test(message)) {
    const weekend = getWeekendBoundsForDate(now, 1);
    return { kind: 'window', window: weekend };
  }
  const ordinalWeekMatch = message.match(/\b(first|second|third|fourth)\s+week\s+(?:of|in)\s+([a-z]+)/);
  if (ordinalWeekMatch) {
    const ordinalWord = ordinalWeekMatch[1];
    const monthIndex = getMonthIndexFromName(message);
    if (monthIndex !== null) {
      const range = getOrdinalWeekRangeInMonth(now, monthIndex, ordinalWord);
      if (range) return { kind: 'window', window: range };
    }
  }
  if (/\bnext week\b/.test(message)) {
    const nextWeekBounds = getNextWeekBounds(now);
    const weekdays = parseRequestedWeekdays(message);
    if (weekdays.length > 0) {
      const dates = weekdays.map((weekday) => {
        const date = new Date(nextWeekBounds.startDate);
        date.setDate(nextWeekBounds.startDate.getDate() + weekday.offset);
        return {
          label: `${weekday.label} (${formatIsoDate(date)})`,
          isoDate: formatIsoDate(date),
        };
      });
      return { kind: 'dates', dates };
    }
    return {
      kind: 'window',
      window: {
        label: `Next week (${nextWeekBounds.startIso} to ${nextWeekBounds.endIso})`,
        startIso: nextWeekBounds.startIso,
        endIso: nextWeekBounds.endIso,
      },
    };
  }

  // Model-grounded extraction for broader natural language.
  if (openRouterApiKey) {
    try {
      const todayIso = formatIsoDate(now);
      const prompt = [
        {
          role: 'system',
          content:
            `Extract scheduling date intent from a user message. Today is ${todayIso}. ` +
            `Return JSON only with one shape: ` +
            `{"kind":"dates","dates":[{"label":"...","isoDate":"YYYY-MM-DD"}]} ` +
            `or {"kind":"window","window":{"label":"...","startIso":"YYYY-MM-DD","endIso":"YYYY-MM-DD"}} ` +
            `or {"kind":"unknown"}. No prose.`,
        },
        {
          role: 'user',
          content: rawMessage,
        },
      ];
      const modelText = await callOpenRouter(prompt, { maxTokens: 220, temperature: 0 });
      const parsed = normalizeModelTimingResult(extractJsonObject(modelText));
      if (parsed) return parsed;
    } catch (error) {
      console.warn(`[ai-orchestrator] temporal parse fallback: ${String(error)}`);
    }
  }

  return { kind: 'unknown' };
}

function toTitleCase(value) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function inferProposalTitleFromMessage(message) {
  if (/\bnight on the town\b/.test(message)) return 'Night on the Town';
  if (/\bnight out\b/.test(message)) return 'Night Out';
  if (/\bdinner\b/.test(message)) return 'Group Dinner';
  if (/\bdrinks\b/.test(message)) return 'Drinks';
  if (/\bhike\b/.test(message)) return 'Hike';
  if (/\btrip\b/.test(message)) return 'Trip';
  if (/\bweekend getaway\b/.test(message)) return 'Weekend Getaway';

  const explicitPhrase = message.match(
    /\b(?:propose|plan|suggest|organize)\s+(?:a|an)?\s*([a-z0-9][a-z0-9\s'-]{2,60}?)(?:\s+(?:on|for|next week|this week|invite)\b|[.!?]|$)/
  );
  const raw = explicitPhrase?.[1]?.trim();
  if (raw) return toTitleCase(raw);

  return 'New Activity Proposal';
}

async function buildActivityProposalPreview(rawMessage) {
  const message = normalizeMessage(rawMessage);
  const temporalRequest = await resolveTemporalRequest(rawMessage);
  const extractedFields = await extractProposalDraftFields(rawMessage, temporalRequest);
  const inviteEveryone = /\binvite everyone\b|\binvite all\b/.test(message);
  const groupAudienceRequested = /\bour group\b|\bgroup\b/.test(message);
  const looksLikeNightOut =
    /\bnight on the town\b|\bnight out\b|\bdinner\b|\bdrinks\b/.test(message);
  const inferredTitle = extractedFields.title || inferProposalTitleFromMessage(message);

  const activityLabel = looksLikeNightOut ? 'night on the town' : 'group activity';

  const candidateDates =
    temporalRequest.kind === 'dates' ? temporalRequest.dates.map((entry) => entry.label) : [];
  const candidateWindowLabel =
    temporalRequest.kind === 'window' ? temporalRequest.window.label : null;
  const primaryDateIso =
    temporalRequest.kind === 'dates' && temporalRequest.dates[0]
      ? temporalRequest.dates[0].isoDate
      : null;
  const rangeDateValue =
    temporalRequest.kind === 'window'
      ? `${temporalRequest.window.startIso} to ${temporalRequest.window.endIso}`
      : null;
  const datesFieldValue = primaryDateIso || rangeDateValue || '';
  const inviteesFieldValue =
    extractedFields.invitees ||
    (inviteEveryone || groupAudienceRequested ? 'Everyone in active group' : 'Everyone in active group');
  const proposalType = extractedFields.proposalType === 'sejour' ? 'sejour' : 'event';
  const timeFieldValue = extractedFields.times || (proposalType === 'sejour' ? '' : '');
  const placeFieldValue = extractedFields.place || '';
  const requirementsFieldValue = extractedFields.requirements || '';
  const commentsFieldValue = extractedFields.comments || '';
  const resolvedDatesFieldValue = extractedFields.dates || datesFieldValue;

  const assistantLines = [
    `I drafted a ${activityLabel} proposal form for you.`,
    'Edit any fields, then click Propose.',
  ];

  const summary = [
    `Propose ${activityLabel}`,
    temporalRequest.kind === 'window' ? `for ${temporalRequest.window.label}` : '',
    temporalRequest.kind === 'dates'
      ? `(${temporalRequest.dates.map((d) => d.label.replace(/\s*\(\d{4}-\d{2}-\d{2}\)/, '')).join(' / ')})`
      : '',
    inviteEveryone || groupAudienceRequested ? 'and invite everyone in group' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const impact = [
    candidateDates.length > 0
      ? `Candidate dates: ${candidateDates.join(', ')}`
      : candidateWindowLabel
      ? `Candidate window: ${candidateWindowLabel}`
      : 'Candidate date to be chosen',
    `Invitees: ${inviteesFieldValue}`,
  ].join('. ') + '.';

  return {
    assistantText: assistantLines.join('\n'),
    actionProposal: {
      id: randomUUID(),
      type: 'create_activity_proposal_and_invite_draft',
      summary,
      requiresApproval: true,
      impact,
      payload: {
        kind: 'create_proposal',
        proposalDraft: {
          title: inferredTitle,
          type: proposalType,
          emoji: '🎉',
          specifics: {
            ...(resolvedDatesFieldValue ? { date: resolvedDatesFieldValue } : {}),
            ...(timeFieldValue ? { time: timeFieldValue } : {}),
            ...(placeFieldValue ? { location: placeFieldValue } : {}),
          },
          form: {
            dates: resolvedDatesFieldValue,
            times: timeFieldValue,
            invitees: inviteesFieldValue,
            place: placeFieldValue,
            requirements: requirementsFieldValue,
            comments: commentsFieldValue,
          },
        },
      },
    },
  };
}

function detectAvailabilityWindow(message) {
  if (/\bthis week\b/.test(message)) {
    const bounds = getCurrentWeekBounds(new Date());
    return {
      label: `this week (${bounds.startIso} to ${bounds.endIso})`,
      ...bounds,
    };
  }
  return null;
}

function formatAvailabilityByDateInWindow(rows, window) {
  const dateToTitles = new Map();
  rows.forEach((row) => {
    const title = row.proposal?.title || row.proposalId;
    row.dates.forEach((isoDate) => {
      if (isoDate < window.startIso || isoDate > window.endIso) return;
      if (!dateToTitles.has(isoDate)) {
        dateToTitles.set(isoDate, new Set());
      }
      dateToTitles.get(isoDate).add(title);
    });
  });

  const dates = Array.from(dateToTitles.keys()).sort();
  if (dates.length === 0) {
    return `You have no saved availability in ${window.label}.`;
  }

  const lines = dates.map((isoDate) => {
    const titles = Array.from(dateToTitles.get(isoDate)).sort().join(', ');
    return `- ${isoDate}: ${titles}`;
  });
  return `Your availability in ${window.label}:\n${lines.join('\n')}`;
}

function formatAttendeesAnswer({ proposalTitle, attendees }) {
  if (!attendees || attendees.length === 0) {
    return `No one is currently marked available for ${proposalTitle}.`;
  }
  const names = attendees.map((entry) => entry.name).join(', ');
  return `For ${proposalTitle}, currently marked available (${attendees.length}): ${names}`;
}

function resolveProposalFromMessageAndState({ message, state }) {
  const normalized = normalizeMessage(message);
  const recent = state.lastConfirmedProposals || [];
  if (recent.length === 0) return null;

  const byTitleMatch = recent.find((proposal) =>
    normalized.includes(String(proposal.title || '').toLowerCase())
  );
  if (byTitleMatch) return byTitleMatch;

  if (state.lastReferencedProposalId) {
    const byRecentReference = recent.find(
      (proposal) => proposal.id === state.lastReferencedProposalId
    );
    if (byRecentReference) return byRecentReference;
  }

  if (recent.length === 1) return recent[0];
  return null;
}

async function generateNaturalLanguageAnswer({ userMessage, intent, rows }) {
  // Tool-backed intents are rendered deterministically to prevent model drift.
  if (intent === 'list_confirmed') return formatConfirmedAnswer(rows);
  if (intent === 'list_my_availability') {
    const window = detectAvailabilityWindow(normalizeMessage(userMessage));
    if (window) return formatAvailabilityByDateInWindow(rows, window);
    return formatAvailabilityAnswer(rows);
  }

  if (!openRouterApiKey) {
    return 'Read-only mode is active. I can currently answer confirmed activities and your availability.';
  }

  const systemPrompt =
    'You are a scheduling assistant in read-only mode. Only answer with supported capability guidance. Be concise.';
  const userPrompt = `User message: ${userMessage}\nIntent: ${intent}`;

  try {
    const text = await callOpenRouter(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { maxTokens: 220, temperature: 0.1 }
    );
    if (text) return text;
  } catch (error) {
    console.warn(`[ai-orchestrator] answer generation fallback: ${String(error)}`);
  }

  return 'Read-only mode is active. I can currently answer confirmed activities and your availability.';
}

const server = http.createServer(async (req, res) => {
  if (!globalThis.__mtupAiThreadState) {
    globalThis.__mtupAiThreadState = new Map();
  }
  const threadStateById = globalThis.__mtupAiThreadState;

  if (req.method === 'OPTIONS') {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === 'POST' && req.url === '/ai/chat') {
    try {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk.toString();
      });

      req.on('end', async () => {
        const authHeader = req.headers.authorization || '';
        const authToken = authHeader.startsWith('Bearer ')
          ? authHeader.slice('Bearer '.length)
          : '';

        if (!authToken) {
          sendJson(res, 401, { error: 'Missing bearer token' });
          return;
        }

        const payload = JSON.parse(body || '{}');
        const threadId = payload.threadId || randomUUID();
        const threadState = threadStateById.get(threadId) || {};
        const rawMessage = String(payload.message || '').trim();
        const normalizedMessage = normalizeMessage(rawMessage);
        const context = payload.context || {};
        const userId = context.userId || null;
        const activeGroupId = context.activeGroupId || null;
        const selectedProposalId = context.selectedProposalId || null;

        if (!normalizedMessage) {
          sendJson(res, 400, { error: 'message is required' });
          return;
        }

        const intent = await classifyIntent(normalizedMessage);
        let rows = [];
        let assistantText = '';
        let responseMode = 'answer';
        let actionProposal = null;
        if (intent === 'list_confirmed') {
          const confirmedRows = await fetchConfirmedProposals({ authToken, activeGroupId });
          rows = Array.isArray(confirmedRows) ? confirmedRows : [];
          threadState.lastConfirmedProposals = rows.map((row) => ({
            id: row.id,
            title: row.title,
            type: row.type,
          }));
          assistantText = await generateNaturalLanguageAnswer({
            userMessage: rawMessage,
            intent,
            rows,
          });
        } else if (intent === 'list_my_availability' && userId) {
          const availRows = await fetchMyAvailabilityWithTitles({
            authToken,
            userId,
            activeGroupId,
          });
          rows = Array.isArray(availRows) ? availRows : [];
          assistantText = await generateNaturalLanguageAnswer({
            userMessage: rawMessage,
            intent,
            rows,
          });
        } else if (intent === 'list_my_availability' && !userId) {
          sendJson(res, 400, { error: 'userId is required for availability queries' });
          return;
        } else if (intent === 'list_attendees') {
          let resolvedProposal =
            resolveProposalFromMessageAndState({
              message: rawMessage,
              state: threadState,
            }) || null;

          if (!resolvedProposal && selectedProposalId) {
            resolvedProposal = await fetchProposalById({
              authToken,
              proposalId: selectedProposalId,
              activeGroupId,
            });
          }

          if (!resolvedProposal) {
            const knownTitles = (threadState.lastConfirmedProposals || [])
              .map((proposal) => proposal.title)
              .filter(Boolean);
            if (knownTitles.length > 0) {
              assistantText = `Which activity do you mean? I can check attendees for: ${knownTitles.join(', ')}`;
            } else {
              assistantText =
                'Please name the activity first, or ask "What events are confirmed?" and then ask who is coming.';
            }
          } else {
            const attendees = await fetchAttendeesForProposal({
              authToken,
              proposalId: resolvedProposal.id,
              activeGroupId,
            });
            threadState.lastReferencedProposalId = resolvedProposal.id;
            assistantText = formatAttendeesAnswer({
              proposalTitle: resolvedProposal.title || 'this activity',
              attendees,
            });
          }
        } else if (intent === 'propose_activity') {
          const preview = await buildActivityProposalPreview(rawMessage);
          assistantText = preview.assistantText;
          actionProposal = preview.actionProposal;
          responseMode = 'action_proposal';
        } else {
          assistantText = await generateNaturalLanguageAnswer({
            userMessage: rawMessage,
            intent: 'unsupported',
            rows: [],
          });
        }

        threadStateById.set(threadId, threadState);

        sendJson(res, 200, {
          threadId,
          mode: responseMode,
          assistantMessage: {
            id: randomUUID(),
            role: 'assistant',
            content: assistantText,
            createdAt: new Date().toISOString(),
          },
          ...(actionProposal ? { actionProposal } : {}),
        });
      });
    } catch (error) {
      sendJson(res, 500, { error: String(error) });
    }
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    sendJson(res, 200, {
      ok: true,
      service: 'ai-dev-orchestrator',
      openRouterConfigured: Boolean(openRouterApiKey),
      openRouterModel,
    });
    return;
  }

  sendJson(res, 404, { error: 'Not found' });
});

server.listen(port, () => {
  console.info(`[ai-orchestrator] listening on http://localhost:${port}`);
  console.info(
    `[ai-orchestrator] openrouter: ${openRouterApiKey ? 'enabled' : 'disabled'} (${openRouterModel})`
  );
});
