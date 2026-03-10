import { describe, expect, it } from 'vitest';
import {
  buildResolverVariantPlan,
  collectResolverSeedCandidates,
  formatResolverOptionLabel,
} from '@/lib/resolverUtils';
import type { DecisionOption, DecisionVote, Proposal, ProposalContribution } from '@/types';

function makeProposal(overrides: Partial<Proposal> = {}): Proposal {
  return {
    id: 'proposal-1',
    title: 'Cardgame Night',
    type: 'event',
    emoji: '🎲',
    createdBy: 'user-1',
    authoredBy: 'user-1',
    createdAt: '2026-03-06T12:00:00.000Z',
    status: 'proposed',
    specifics: {
      requirements: 'Quiet table',
    },
    ...overrides,
  };
}

function makeOption(
  id: string,
  dimension: 'time' | 'place' | 'requirement',
  label: string
): DecisionOption {
  return {
    id,
    proposalId: 'proposal-1',
    dimension,
    label,
    createdBy: 'user-1',
    createdAt: '2026-03-06T12:00:00.000Z',
  };
}

function makeSingleVote(optionId: string, userId: string): DecisionVote {
  return {
    id: `${userId}-${optionId}`,
    proposalId: 'proposal-1',
    dimension: 'time',
    userId,
    rankedOptionIds: [optionId],
    updatedAt: '2026-03-06T12:00:00.000Z',
  };
}

function makeContribution(
  field: 'date' | 'time' | 'place' | 'requirements',
  value: Record<string, unknown>
): ProposalContribution {
  return {
    id: `contribution-${field}`,
    proposalId: 'proposal-1',
    userId: 'user-2',
    kind: 'field_change',
    field,
    value,
    createdAt: '2026-03-06T12:00:00.000Z',
    provenance: 'manual_entry',
  };
}

describe('collectResolverSeedCandidates', () => {
  it('harvests time seeds from baseline, thread changes, and comments', () => {
    const proposal = makeProposal({
      specifics: {
        time: '18:00',
      },
      comments: [
        {
          id: 'comment-1',
          userId: 'user-2',
          proposalId: 'proposal-1',
          text: 'when: 7:30pm',
          createdAt: '2026-03-06T12:00:00.000Z',
        },
        {
          id: 'comment-2',
          userId: 'user-3',
          proposalId: 'proposal-1',
          text: '19:00 also works for me',
          createdAt: '2026-03-06T13:00:00.000Z',
        },
      ],
    });

    const seeds = collectResolverSeedCandidates(proposal, 'time', [
      makeContribution('time', { text: '20:15' }),
    ]);

    expect(seeds.map((seed) => seed.label)).toEqual(expect.arrayContaining(['18:00', '19:30', '19:00', '20:15']));
  });

  it('harvests place seeds from prefixed comments', () => {
    const proposal = makeProposal({
      comments: [
        {
          id: 'comment-place',
          userId: 'user-2',
          proposalId: 'proposal-1',
          text: 'place: Cafe Nizza',
          createdAt: '2026-03-06T12:00:00.000Z',
        },
        {
          id: 'comment-where',
          userId: 'user-3',
          proposalId: 'proposal-1',
          text: 'where: Hornstull',
          createdAt: '2026-03-06T13:00:00.000Z',
        },
      ],
    });

    const seeds = collectResolverSeedCandidates(proposal, 'place', []);

    expect(seeds.map((seed) => seed.label)).toEqual(expect.arrayContaining(['Cafe Nizza', 'Hornstull']));
  });

  it('keeps event date alternatives distinct inside the time dimension', () => {
    const proposal = makeProposal({
      specifics: {
        date: '2026-03-20',
        time: '15:00',
      },
    });

    const seeds = collectResolverSeedCandidates(proposal, 'time', [
      makeContribution('date', { dateText: '2026-03-22' }),
      makeContribution('time', { text: '15:00' }),
      {
        ...makeContribution('date', { dateText: '2026-03-24' }),
        id: 'contribution-date-2',
        createdAt: '2026-03-06T12:01:00.000Z',
      },
      {
        ...makeContribution('time', { text: '15:00' }),
        id: 'contribution-time-2',
        createdAt: '2026-03-06T12:01:01.000Z',
      },
    ]);

    expect(seeds).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: '15:00', metadata: expect.objectContaining({ startDate: '2026-03-20' }) }),
        expect.objectContaining({ label: '15:00', metadata: expect.objectContaining({ startDate: '2026-03-22' }) }),
        expect.objectContaining({ label: '15:00', metadata: expect.objectContaining({ startDate: '2026-03-24' }) }),
      ])
    );
  });
});

describe('formatResolverOptionLabel', () => {
  it('shows event dates alongside time labels when metadata is present', () => {
    expect(
      formatResolverOptionLabel(
        {
          ...makeOption('time-1', 'time', '15:00'),
          metadata: { startDate: '2026-03-22', endDate: '2026-03-22' },
        },
        'time'
      )
    ).toBe('2026-03-22 | 15:00');
  });
});

describe('buildResolverVariantPlan', () => {
  it('creates two capped variants from leading time/place combinations', () => {
    const proposal = makeProposal({
      specifics: {
        date: '2026-03-20',
        time: '19:00',
        location: 'Original Place',
        requirements: 'Quiet table',
      },
    });

    const timeOptions = [
      makeOption('time-1', 'time', '18:00'),
      makeOption('time-2', 'time', '20:00'),
    ];
    const placeOptions = [
      makeOption('place-1', 'place', 'Cafe A'),
      makeOption('place-2', 'place', 'Cafe B'),
    ];

    const plan = buildResolverVariantPlan(
      proposal,
      [
        {
          dimension: 'time',
          mode: 'single',
          status: 'open',
          options: timeOptions,
          votes: [
            makeSingleVote('time-1', 'user-1'),
            makeSingleVote('time-1', 'user-2'),
            makeSingleVote('time-2', 'user-3'),
          ],
        },
        {
          dimension: 'place',
          mode: 'single',
          status: 'open',
          options: placeOptions,
          votes: [
            {
              id: 'vote-place-1',
              proposalId: 'proposal-1',
              dimension: 'place',
              userId: 'user-1',
              rankedOptionIds: ['place-1'],
              updatedAt: '2026-03-06T12:00:00.000Z',
            },
            {
              id: 'vote-place-2',
              proposalId: 'proposal-1',
              dimension: 'place',
              userId: 'user-2',
              rankedOptionIds: ['place-2'],
              updatedAt: '2026-03-06T12:00:00.000Z',
            },
          ],
        },
        {
          dimension: 'requirement',
          mode: 'multi',
          status: 'open',
          options: [],
          votes: [],
        },
      ]
    );

    expect(plan.reason).toBeNull();
    expect(plan.drafts).toHaveLength(2);
    expect(plan.drafts[0]?.title).toBe('Cardgame Night (Variant A)');
    expect(plan.drafts[1]?.title).toBe('Cardgame Night (Variant B)');
    expect(plan.drafts[0]?.specifics?.requirements).toBe('Quiet table');
    expect(plan.drafts[0]?.chosenTimeLabel).toBeTruthy();
    expect(plan.drafts[0]?.chosenPlaceLabel).toBeTruthy();
  });

  it('suppresses variants when matching child proposals already exist', () => {
    const proposal = makeProposal();
    const existingVariant: Proposal = makeProposal({
      id: 'proposal-variant-a',
      title: 'Cardgame Night (Variant A)',
      createdBy: 'user-2',
      authoredBy: 'user-1',
      specifics: {
        time: '18:00',
        location: 'Cafe A',
        requirements: 'Quiet table',
        resolver: {
          variantOfProposalId: 'proposal-1',
          variantLabel: 'Variant A',
          originalProposalTitle: 'Cardgame Night',
          originalProposalCreatedBy: 'user-1',
          forkedAt: '2026-03-06T13:00:00.000Z',
          forkedBy: 'user-2',
          chosenTimeLabel: '18:00',
          chosenPlaceLabel: 'Cafe A',
        },
      },
    });

    const plan = buildResolverVariantPlan(
      proposal,
      [
        {
          dimension: 'time',
          mode: 'single',
          status: 'open',
          options: [makeOption('time-1', 'time', '18:00'), makeOption('time-2', 'time', '20:00')],
          votes: [
            makeSingleVote('time-1', 'user-1'),
            makeSingleVote('time-2', 'user-2'),
          ],
        },
        {
          dimension: 'place',
          mode: 'single',
          status: 'open',
          options: [makeOption('place-1', 'place', 'Cafe A'), makeOption('place-2', 'place', 'Cafe B')],
          votes: [
            {
              id: 'vote-place-1',
              proposalId: 'proposal-1',
              dimension: 'place',
              userId: 'user-1',
              rankedOptionIds: ['place-1'],
              updatedAt: '2026-03-06T12:00:00.000Z',
            },
            {
              id: 'vote-place-2',
              proposalId: 'proposal-1',
              dimension: 'place',
              userId: 'user-2',
              rankedOptionIds: ['place-2'],
              updatedAt: '2026-03-06T12:00:00.000Z',
            },
          ],
        },
        {
          dimension: 'requirement',
          mode: 'multi',
          status: 'open',
          options: [],
          votes: [],
        },
      ],
      [existingVariant]
    );

    expect(plan.drafts).toHaveLength(0);
    expect(plan.reason).toMatch(/Matching variants already exist/);
  });

  it('does not offer variants when there is only one distinct path', () => {
    const proposal = makeProposal();

    const plan = buildResolverVariantPlan(proposal, [
      {
        dimension: 'time',
        mode: 'single',
        status: 'open',
        options: [makeOption('time-1', 'time', '18:00')],
        votes: [makeSingleVote('time-1', 'user-1')],
      },
      {
        dimension: 'place',
        mode: 'single',
        status: 'confirmed',
        options: [makeOption('place-1', 'place', 'Cafe A')],
        votes: [],
      },
      {
        dimension: 'requirement',
        mode: 'multi',
        status: 'open',
        options: [],
        votes: [],
      },
    ]);

    expect(plan.drafts).toHaveLength(0);
    expect(plan.reason).toMatch(/Need at least one unresolved dimension with two viable options/);
  });
});
