import type { Proposal } from '@/types';

export type ProposalCardDrafts = Record<
  string,
  {
    dateSuggestion: string;
    startDateSuggestion: string;
    endDateSuggestion: string;
    timeSuggestion: string;
    placeSuggestion: string;
    isSuggestModalOpen?: boolean;
  }
>;

type ParsedDateRange = {
  startDate: string;
  endDate: string;
};

export type ProposalFlowEditDraft = {
  title: string;
  startDate: string;
  endDate: string;
  time: string;
  place: string;
};

export function parseIsoDatesFromText(input: string): string[] {
  const trimmed = input.trim();
  if (!trimmed) return [];
  const rangeMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})\s+to\s+(\d{4}-\d{2}-\d{2})$/i);
  if (rangeMatch) {
    const start = new Date(`${rangeMatch[1]}T00:00:00Z`);
    const end = new Date(`${rangeMatch[2]}T00:00:00Z`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];
    const out: string[] = [];
    const cursor = new Date(start);
    while (cursor <= end && out.length < 62) {
      out.push(cursor.toISOString().slice(0, 10));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return out;
  }
  const dates = trimmed.match(/\d{4}-\d{2}-\d{2}/g);
  return dates ? Array.from(new Set(dates)) : [];
}

export function parseDateRangeFromText(input: string): ParsedDateRange {
  const dates = parseIsoDatesFromText(input);
  if (dates.length === 0) {
    return { startDate: '', endDate: '' };
  }
  return {
    startDate: dates[0] || '',
    endDate: dates[dates.length - 1] || '',
  };
}

export function formatDateRangeText(startDate: string | null | undefined, endDate: string | null | undefined): string {
  if (!startDate && !endDate) return '';
  const normalizedStart = startDate || endDate;
  const normalizedEnd = endDate || startDate;
  if (!normalizedStart) return '';
  return normalizedStart === normalizedEnd ? normalizedStart : `${normalizedStart} to ${normalizedEnd}`;
}

export function formatTo24HourTimeText(input: string): string {
  if (!input.trim()) return input;
  return input.replace(/\b(\d{1,2})(?::(\d{2}))?\s*([ap])(?:\.?m\.?)?\b/gi, (_, h, m, meridiem) => {
    const rawHour = Number(h);
    if (Number.isNaN(rawHour) || rawHour < 1 || rawHour > 12) return _;
    const minute = typeof m === 'string' ? m : '00';
    const normalizedHour =
      meridiem.toLowerCase() === 'p' ? (rawHour % 12) + 12 : rawHour % 12;
    return `${String(normalizedHour).padStart(2, '0')}:${minute}`;
  });
}

export function formatProposalBaseline(proposal: Proposal): string {
  const parts = [
    proposal.specifics?.date ? `Date: ${proposal.specifics.date}` : null,
    proposal.specifics?.time ? `Time: ${proposal.specifics.time}` : null,
    proposal.specifics?.location ? `Place: ${proposal.specifics.location}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' | ') : 'No logistics set yet';
}

export function proposalCardTheme(index: number) {
  const themes = [
    {
      shell:
        'border-rose-200 bg-rose-50/80 dark:border-rose-900/40 dark:bg-rose-950/10',
      tile:
        'border-rose-200 bg-white text-rose-800 dark:border-rose-900/40 dark:bg-slate-900 dark:text-rose-200',
      accent: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-200',
    },
    {
      shell:
        'border-sky-200 bg-sky-50/80 dark:border-sky-900/40 dark:bg-sky-950/10',
      tile:
        'border-sky-200 bg-white text-sky-800 dark:border-sky-900/40 dark:bg-slate-900 dark:text-sky-200',
      accent: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-200',
    },
    {
      shell:
        'border-amber-200 bg-amber-50/80 dark:border-amber-900/40 dark:bg-amber-950/10',
      tile:
        'border-amber-200 bg-white text-amber-800 dark:border-amber-900/40 dark:bg-slate-900 dark:text-amber-200',
      accent: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200',
    },
    {
      shell:
        'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/40 dark:bg-emerald-950/10',
      tile:
        'border-emerald-200 bg-white text-emerald-800 dark:border-emerald-900/40 dark:bg-slate-900 dark:text-emerald-200',
      accent: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200',
    },
  ] as const;
  return themes[index % themes.length];
}

export function ProposalFlag({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'neutral' | 'good' | 'warm' | 'info';
}) {
  const toneClass =
    tone === 'good'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-200'
      : tone === 'warm'
        ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200'
        : tone === 'info'
          ? 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900/50 dark:bg-sky-950/20 dark:text-sky-200'
          : 'border-gray-200 bg-white text-gray-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200';
  return <span className={`rounded-full border px-2 py-0.5 text-[10px] ${toneClass}`}>{label}</span>;
}

export function userInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('');
}

export function buildProposalFlowEditDraft(proposal: Proposal): ProposalFlowEditDraft {
  const parsedRange = parseDateRangeFromText(proposal.specifics?.date || '');
  return {
    title: proposal.title || '',
    startDate: parsedRange.startDate,
    endDate: parsedRange.endDate,
    time: proposal.specifics?.time || '',
    place: proposal.specifics?.location || '',
  };
}
