import { generateId } from '@/lib/utils';
import type { Proposal, ProposalContribution } from '@/types';

const STORAGE_KEY = 'mtup-proposal-contributions-v1';
let cachedRows: ProposalContribution[] | null = null;

function normalize(raw: unknown): ProposalContribution[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is ProposalContribution => {
    const c = item as Partial<ProposalContribution> | null;
    return Boolean(
      c &&
        typeof c.id === 'string' &&
        typeof c.proposalId === 'string' &&
        typeof c.userId === 'string' &&
        typeof c.kind === 'string' &&
        c.value &&
        typeof c.value === 'object' &&
        typeof c.createdAt === 'string' &&
        typeof c.provenance === 'string'
    );
  });
}

function readAll(): ProposalContribution[] {
  if (cachedRows) return [...cachedRows];
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    cachedRows = normalize(JSON.parse(raw));
    return [...cachedRows];
  } catch {
    return [];
  }
}

function writeAll(rows: ProposalContribution[]): void {
  cachedRows = normalize(rows);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cachedRows));
}

function parseDateInputs(input: string): string[] {
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
  const exacts = trimmed.match(/\d{4}-\d{2}-\d{2}/g);
  return exacts ? Array.from(new Set(exacts)) : [];
}

export const proposalThreadStore = {
  replaceAll(rows: ProposalContribution[]): void {
    writeAll(rows);
  },

  clear(): void {
    writeAll([]);
  },

  listAll(): ProposalContribution[] {
    return readAll().sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },

  listForProposal(proposalId: string): ProposalContribution[] {
    return this.listAll().filter((row) => row.proposalId === proposalId);
  },

  add(contribution: ProposalContribution): void {
    const rows = readAll();
    const nextRows = rows.filter((row) => row.id !== contribution.id);
    nextRows.push(contribution);
    writeAll(nextRows);
  },

  addMany(contributions: ProposalContribution[]): void {
    const rows = readAll();
    const byId = new Map(rows.map((row) => [row.id, row]));
    contributions.forEach((contribution) => {
      byId.set(contribution.id, contribution);
    });
    writeAll(Array.from(byId.values()));
  },

  addImplicitProposerAffirmation(proposal: Proposal): ProposalContribution | null {
    const rows = readAll();
    const exists = rows.some(
      (row) =>
        row.proposalId === proposal.id &&
        row.userId === proposal.createdBy &&
        row.kind === 'affirmation' &&
        row.provenance === 'implicit_proposer'
    );
    if (exists) return null;
    const contribution = {
      id: generateId(),
      proposalId: proposal.id,
      userId: proposal.createdBy,
      kind: 'affirmation',
      field: 'general',
      value: { status: 'available_as_proposed', assumed: true },
      createdAt: new Date().toISOString(),
      provenance: 'implicit_proposer',
    } satisfies ProposalContribution;
    rows.push(contribution);
    writeAll(rows);
    return contribution;
  },

  addExplicitAffirmation(proposalId: string, userId: string): ProposalContribution {
    const contribution: ProposalContribution = {
      id: generateId(),
      proposalId,
      userId,
      kind: 'affirmation',
      field: 'general',
      value: { status: 'available_as_proposed' },
      createdAt: new Date().toISOString(),
      provenance: 'explicit_click',
    };
    this.add(contribution);
    return contribution;
  },

  hasExplicitAffirmation(proposalId: string, userId: string): boolean {
    return readAll().some(
      (row) =>
        row.proposalId === proposalId &&
        row.userId === userId &&
        row.kind === 'affirmation' &&
        row.provenance === 'explicit_click'
    );
  },

  addDateFieldChange(
    proposalId: string,
    userId: string,
    dateText: string
  ): { contribution: ProposalContribution; auditContribution: ProposalContribution; impliedDates: string[] } {
    const impliedDates = parseDateInputs(dateText);
    const contribution: ProposalContribution = {
      id: generateId(),
      proposalId,
      userId,
      kind: 'field_change',
      field: 'date',
      value: {
        dateText: dateText.trim(),
        impliedAvailability: 'available_for_suggested_dates',
        ...(impliedDates.length > 0 ? { impliedDates } : {}),
      },
      createdAt: new Date().toISOString(),
      provenance: 'manual_entry',
    };
    this.add(contribution);

    // Also add an explicit availability-shaped contribution for auditability of the assumption.
    const auditContribution: ProposalContribution = {
      id: generateId(),
      proposalId,
      userId,
      kind: 'availability',
      field: 'date',
      value: {
        status: 'available',
        source: 'date_suggestion',
        dateText: dateText.trim(),
        ...(impliedDates.length > 0 ? { dates: impliedDates } : {}),
      },
      createdAt: new Date().toISOString(),
      provenance: 'inferred_from_delta',
    };
    this.add(auditContribution);

    return { contribution, auditContribution, impliedDates };
  },

  addFieldChange(
    proposalId: string,
    userId: string,
    field: 'time' | 'place' | 'requirements',
    text: string
  ): ProposalContribution {
    const contribution: ProposalContribution = {
      id: generateId(),
      proposalId,
      userId,
      kind: 'field_change',
      field,
      value: {
        text: text.trim(),
      },
      createdAt: new Date().toISOString(),
      provenance: 'manual_entry',
    };
    this.add(contribution);
    return contribution;
  },

  ensureImplicitAffirmationsForProposals(proposals: Proposal[]): void {
    let changed = false;
    const rows = readAll();
    for (const proposal of proposals) {
      const exists = rows.some(
        (row) =>
          row.proposalId === proposal.id &&
          row.userId === proposal.createdBy &&
          row.kind === 'affirmation' &&
          row.provenance === 'implicit_proposer'
      );
      if (exists) continue;
      rows.push({
        id: generateId(),
        proposalId: proposal.id,
        userId: proposal.createdBy,
        kind: 'affirmation',
        field: 'general',
        value: { status: 'available_as_proposed', assumed: true },
        createdAt: proposal.createdAt || new Date().toISOString(),
        provenance: 'implicit_proposer',
      });
      changed = true;
    }
    if (changed) writeAll(rows);
  },
};
