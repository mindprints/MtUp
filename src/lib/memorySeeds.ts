import { generateId } from '@/lib/utils';
import type { MemoryRecord } from '@/types';

type SeedProfile = {
  userId: string;
  displayName: string;
  records: Array<{
    factType: string;
    durability: MemoryRecord['durability'];
    value: Record<string, unknown>;
  }>;
};

type GroupSeedRecord = {
  factType: string;
  durability: MemoryRecord['durability'];
  value: Record<string, unknown>;
};

const STOCKHOLM_GROUP_SEED_RECORDS: GroupSeedRecord[] = [
  {
    factType: 'group_location_cluster',
    durability: 'durable',
    value: {
      city: 'Stockholm',
      commonAreas: ['Sodermalm', 'Norrmalm', 'Kungsholmen'],
      transitPreference: 'T-bana friendly',
    },
  },
  {
    factType: 'group_budget_norm',
    durability: 'durable',
    value: {
      defaultDinnerBudgetSek: '250-450',
      note: 'Flexible for special occasions if planned ahead',
    },
  },
  {
    factType: 'group_planning_norm',
    durability: 'durable',
    value: {
      note: 'Weeknight plans work best with lead time; weekend trips need narrowing earlier',
      style: 'iterative',
    },
  },
];

const STOCKHOLM_SEED_PROFILES: SeedProfile[] = [
  {
    userId: '1',
    displayName: 'Alice',
    records: [
      {
        factType: 'home_area',
        durability: 'durable',
        value: { city: 'Stockholm', area: 'Soderort', note: 'Prefers shorter travel on weekdays' },
      },
      {
        factType: 'food_preference',
        durability: 'durable',
        value: { likes: ['vegetarian-friendly', 'cozy cafes'], dislikes: ['very noisy bars'] },
      },
      {
        factType: 'availability_recurring_constraint',
        durability: 'durable',
        value: { availability: 'unavailable', modality: 'in_person', weekday: 'tuesday', recurrence: 'weekly' },
      },
    ],
  },
  {
    userId: '2',
    displayName: 'Bob',
    records: [
      {
        factType: 'food_preference',
        durability: 'durable',
        value: { likes: ['ramen', 'seafood', 'late dinners'], budgetBand: 'mid' },
      },
      {
        factType: 'venue_preference',
        durability: 'durable',
        value: { priorities: ['walkability', 'near transit'], city: 'Stockholm' },
      },
      {
        factType: 'availability_time_preference',
        durability: 'seasonal',
        value: { availability: 'available', modality: 'general', recurrence: 'unspecified', after: '19:00' },
      },
    ],
  },
  {
    userId: '3',
    displayName: 'Charlie',
    records: [
      {
        factType: 'trip_style_preference',
        durability: 'durable',
        value: { likes: ['nature escapes', 'train travel'], pace: 'relaxed' },
      },
      {
        factType: 'budget_preference',
        durability: 'durable',
        value: { level: 'careful', note: 'Prefers planning and shared costs upfront' },
      },
      {
        factType: 'availability_recurring_constraint',
        durability: 'durable',
        value: { availability: 'unavailable', modality: 'general', weekday: 'monday', recurrence: 'weekly' },
      },
    ],
  },
  {
    userId: '4',
    displayName: 'Diana',
    records: [
      {
        factType: 'social_preference',
        durability: 'durable',
        value: { groupSize: 'small_to_medium', note: 'Likes intentional plans over spontaneous' },
      },
      {
        factType: 'venue_preference',
        durability: 'durable',
        value: { likes: ['design-forward cafes', 'wine bars'], city: 'Stockholm' },
      },
      {
        factType: 'availability_constraint',
        durability: 'seasonal',
        value: { availability: 'unavailable', modality: 'in_person', month: 'july', note: 'Usually away part of summer' },
      },
    ],
  },
  {
    userId: '5',
    displayName: 'Eve',
    records: [
      {
        factType: 'activity_preference',
        durability: 'durable',
        value: { likes: ['board games', 'casual dinners', 'waterfront walks'] },
      },
      {
        factType: 'availability_recurring_constraint',
        durability: 'durable',
        value: { availability: 'available', modality: 'general', weekday: 'thursday', recurrence: 'weekly', after: '18:30' },
      },
      {
        factType: 'location_preference',
        durability: 'durable',
        value: { city: 'Stockholm', note: 'Happy to meet central or south side with good transit' },
      },
    ],
  },
];

export function buildStockholmSeedMemoryRecords(groupId: string | null): MemoryRecord[] {
  const nowIso = new Date().toISOString();
  const personRecords = STOCKHOLM_SEED_PROFILES.flatMap((profile) =>
    profile.records.map((record, index) => ({
      id: generateId(),
      groupId,
      scopeType: 'person' as const,
      scopeId: profile.userId,
      factType: record.factType,
      value: {
        ...record.value,
        seedProfile: profile.displayName,
        fictionalSeed: true,
      },
      status: 'reported' as const,
      durability: record.durability,
      sourceKind: 'manual_seed' as const,
      sourceRef: `stockholm-seed:${profile.userId}:${record.factType}:${index}`,
      observedAt: nowIso,
      updatedAt: nowIso,
    }))
  );
  const groupRecords = STOCKHOLM_GROUP_SEED_RECORDS.map((record, index) => ({
    id: generateId(),
    groupId,
    scopeType: 'group' as const,
    scopeId: groupId || 'seed-stockholm-group',
    factType: record.factType,
    value: {
      ...record.value,
      seedProfile: 'Stockholm Group',
      fictionalSeed: true,
    },
    status: 'reported' as const,
    durability: record.durability,
    sourceKind: 'manual_seed' as const,
    sourceRef: `stockholm-seed:group:${record.factType}:${index}`,
    observedAt: nowIso,
    updatedAt: nowIso,
  }));

  return [...personRecords, ...groupRecords];
}
