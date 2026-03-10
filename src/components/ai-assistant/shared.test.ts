import { describe, expect, it } from 'vitest';
import {
  buildProposalFlowEditDraft,
  formatSejourTimeText,
  getProposalTimeSummary,
  normalizeTimeInputValue,
  parseSejourTimeText,
} from '@/components/ai-assistant/shared';

describe('normalizeTimeInputValue', () => {
  it('rounds typed times to the nearest 15-minute slot', () => {
    expect(normalizeTimeInputValue('10:07')).toBe('10:00');
    expect(normalizeTimeInputValue('10:08')).toBe('10:15');
    expect(normalizeTimeInputValue('23:59')).toBe('23:45');
  });

  it('normalizes simple 12-hour input before rounding', () => {
    expect(normalizeTimeInputValue('7pm')).toBe('19:00');
    expect(normalizeTimeInputValue('7:08pm')).toBe('19:15');
  });

  it('preserves non-clock free text values', () => {
    expect(normalizeTimeInputValue('Evening')).toBe('Evening');
  });
});

describe('buildProposalFlowEditDraft', () => {
  it('loads persisted proposal times on the 15-minute grid', () => {
    const draft = buildProposalFlowEditDraft({
      id: 'p1',
      title: 'Dinner',
      type: 'event',
      emoji: '🍽️',
      createdBy: 'u1',
      authoredBy: 'u1',
      createdAt: '2026-03-07T12:00:00.000Z',
      status: 'proposed',
      specifics: {
        date: '2026-03-08',
        time: '18:07',
        location: 'Town',
      },
    });

    expect(draft.time).toBe('18:00');
  });

  it('loads sejour start and end times separately', () => {
    const draft = buildProposalFlowEditDraft({
      id: 'p2',
      title: 'Weekend Away',
      type: 'sejour',
      emoji: '🧳',
      createdBy: 'u1',
      authoredBy: 'u1',
      createdAt: '2026-03-07T12:00:00.000Z',
      status: 'proposed',
      specifics: {
        date: '2026-03-08 to 2026-03-10',
        startTime: '08:07',
        endTime: '17:08',
        location: 'Town',
      },
    });

    expect(draft.startTime).toBe('08:00');
    expect(draft.endTime).toBe('17:15');
    expect(draft.time).toBe('');
  });
});

describe('getProposalTimeSummary', () => {
  it('formats sejour start and end times as a range', () => {
    expect(
      getProposalTimeSummary({
        id: 'p3',
        title: 'Weekend Away',
        type: 'sejour',
        emoji: '🧳',
        createdBy: 'u1',
        authoredBy: 'u1',
        createdAt: '2026-03-07T12:00:00.000Z',
        status: 'proposed',
        specifics: {
          startTime: '08:00',
          endTime: '17:15',
        },
      })
    ).toBe('08:00 -> 17:15');
  });
});

describe('sejour alternative time helpers', () => {
  it('formats partial and complete sejour time ranges', () => {
    expect(formatSejourTimeText('08:00', '17:15')).toBe('08:00 -> 17:15');
    expect(formatSejourTimeText('08:00', '')).toBe('08:00');
    expect(formatSejourTimeText('', '')).toBe('');
  });

  it('extracts start and end times from stored range text', () => {
    expect(parseSejourTimeText('08:00 -> 17:15')).toEqual({
      startTime: '08:00',
      endTime: '17:15',
    });

    // edge cases
    expect(parseSejourTimeText('08:00')).toEqual({
      startTime: '08:00',
      endTime: undefined,
    });
    expect(parseSejourTimeText('')).toEqual({
      startTime: undefined,
      endTime: undefined,
    });
    expect(parseSejourTimeText('invalid')).toEqual({
      startTime: undefined,
      endTime: undefined,
    });
  });
});
