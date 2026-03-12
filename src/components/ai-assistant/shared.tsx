import type { Proposal } from '@/types';

export type ProposalCardDrafts = Record<
  string,
  {
    dateSuggestion: string;
    startDateSuggestion: string;
    endDateSuggestion: string;
    timeSuggestion: string;
    startTimeSuggestion: string;
    endTimeSuggestion: string;
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
  startTime: string;
  endTime: string;
  place: string;
};

export const TIME_INPUT_STEP_SECONDS = 15 * 60;

export const TIME_INPUT_OPTIONS = Array.from({ length: 24 * 4 }, (_, index) => {
  const totalMinutes = index * 15;
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  const value = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  return { value, label: value };
});

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
  return dates ? Array.from(new Set(dates)).sort() : [];
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

export function normalizeTimeInputValue(input: string): string {
  const trimmed = formatTo24HourTimeText(input).trim();
  if (!trimmed) return '';
  const match = trimmed.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!match) return input;

  const totalMinutes = Number(match[1]) * 60 + Number(match[2]);
  const roundedMinutes = Math.round(totalMinutes / 15) * 15;
  const normalizedMinutes = Math.min(roundedMinutes, (24 * 60) - 15);
  const hour = Math.floor(normalizedMinutes / 60);
  const minute = normalizedMinutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function QuarterHourTimeSelect({
  value,
  onChange,
  ariaLabel,
  className,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
}) {
  const normalizedValue = normalizeTimeInputValue(value);
  return (
    <select
      value={normalizedValue}
      onChange={(event) => onChange(event.target.value)}
      aria-label={ariaLabel}
      disabled={disabled}
      className={className}
    >
      <option value="">Select time</option>
      {TIME_INPUT_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function formatSejourTimeText(startTime: string, endTime: string): string {
  const normalizedStartTime = normalizeTimeInputValue(startTime).trim();
  const normalizedEndTime = normalizeTimeInputValue(endTime).trim();
  if (!normalizedStartTime && !normalizedEndTime) return '';
  if (normalizedStartTime && normalizedEndTime) {
    return `${normalizedStartTime} -> ${normalizedEndTime}`;
  }
  return normalizedStartTime || normalizedEndTime;
}

export function parseSejourTimeText(input: string): { startTime: string | undefined; endTime: string | undefined } {
  const normalized = formatTo24HourTimeText(input || '');
  const matches = normalized.match(/\b([01]\d|2[0-3]):([0-5]\d)\b/g) || [];
  return {
    startTime: matches[0] ? normalizeTimeInputValue(matches[0]) : undefined,
    endTime: matches[1] ? normalizeTimeInputValue(matches[1]) : undefined,
  };
}

type SejourDateTimeRowProps = {
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onStartTimeChange: (value: string) => void;
  onEndTimeChange: (value: string) => void;
  startDateLabel: string;
  startTimeLabel: string;
  endDateLabel: string;
  endTimeLabel: string;
  startDateAriaLabel: string;
  startTimeAriaLabel: string;
  endDateAriaLabel: string;
  endTimeAriaLabel: string;
  dateInputClassName: string;
  timeSelectClassName: string;
  labelClassName?: string;
  separatorClassName?: string;
  disabled?: boolean;
};

export function SejourDateTimeRow({
  startDate,
  endDate,
  startTime,
  endTime,
  onStartDateChange,
  onEndDateChange,
  onStartTimeChange,
  onEndTimeChange,
  startDateLabel,
  startTimeLabel,
  endDateLabel,
  endTimeLabel,
  startDateAriaLabel,
  startTimeAriaLabel,
  endDateAriaLabel,
  endTimeAriaLabel,
  dateInputClassName,
  timeSelectClassName,
  labelClassName = 'text-xs text-gray-700 dark:text-slate-200',
  separatorClassName = 'text-xs font-semibold text-gray-400 dark:text-slate-500',
  disabled = false,
}: SejourDateTimeRowProps) {
  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-end md:gap-3">
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-2">
        <label className={labelClassName}>
          <span className="mb-1 block">{startDateLabel}</span>
          <input
            type="date"
            value={startDate}
            onChange={(event) => onStartDateChange(event.target.value)}
            aria-label={startDateAriaLabel}
            disabled={disabled}
            className={dateInputClassName}
          />
        </label>
        <div className={`hidden pb-2 md:flex md:items-center md:justify-center ${separatorClassName}`}>-</div>
        <label className={labelClassName}>
          <span className="mb-1 block">{startTimeLabel}</span>
          <QuarterHourTimeSelect
            value={startTime}
            onChange={onStartTimeChange}
            ariaLabel={startTimeAriaLabel}
            disabled={disabled}
            className={timeSelectClassName}
          />
        </label>
      </div>
      <div className={`hidden md:flex md:items-center md:justify-center md:pb-2 ${separatorClassName}`}>---</div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-2">
        <label className={labelClassName}>
          <span className="mb-1 block">{endDateLabel}</span>
          <input
            type="date"
            value={endDate}
            min={startDate || undefined}
            onChange={(event) => onEndDateChange(event.target.value)}
            aria-label={endDateAriaLabel}
            disabled={disabled}
            className={dateInputClassName}
          />
        </label>
        <div className={`hidden pb-2 md:flex md:items-center md:justify-center ${separatorClassName}`}>-</div>
        <label className={labelClassName}>
          <span className="mb-1 block">{endTimeLabel}</span>
          <QuarterHourTimeSelect
            value={endTime}
            onChange={onEndTimeChange}
            ariaLabel={endTimeAriaLabel}
            disabled={disabled}
            className={timeSelectClassName}
          />
        </label>
      </div>
    </div>
  );
}

export function formatProposalBaseline(proposal: Proposal): string {
  const parts = [
    proposal.specifics?.date ? `Date: ${proposal.specifics.date}` : null,
    getProposalTimeSummary(proposal) ? `Time: ${getProposalTimeSummary(proposal)}` : null,
    proposal.specifics?.location ? `Place: ${proposal.specifics.location}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' | ') : 'No logistics set yet';
}

const overlayDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
});

function formatOverlayDateLabel(isoDate: string): string {
  const parsed = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return '';
  return overlayDateFormatter.format(parsed);
}

export function getProposalOverlayRubric(proposal: Proposal): string {
  const dates = parseIsoDatesFromText(proposal.specifics?.date || '');
  const startDate = dates[0] || '';
  const endDate = dates[dates.length - 1] || '';

  if (proposal.type === 'sejour') {
    const startLabel = startDate ? formatOverlayDateLabel(startDate) : '';
    const endLabel = endDate ? formatOverlayDateLabel(endDate) : '';
    if (startLabel && endLabel) {
      return startLabel === endLabel ? startLabel : `${startLabel} - ${endLabel}`;
    }
    return startLabel || endLabel;
  }

  const dateLabel = startDate ? formatOverlayDateLabel(startDate) : '';
  const timeLabel = getProposalTimeSummary(proposal);
  return [dateLabel, timeLabel].filter(Boolean).join(' • ');
}

export function getProposalStartTime(proposal: Proposal): string {
  if (proposal.type === 'sejour') {
    return normalizeTimeInputValue(proposal.specifics?.startTime || proposal.specifics?.time || '');
  }
  return normalizeTimeInputValue(proposal.specifics?.time || '');
}

export function getProposalEndTime(proposal: Proposal): string {
  if (proposal.type === 'sejour') {
    return normalizeTimeInputValue(proposal.specifics?.endTime || proposal.specifics?.time || '');
  }
  return normalizeTimeInputValue(proposal.specifics?.time || '');
}

export function getProposalTimeSummary(proposal: Proposal): string {
  if (proposal.type === 'sejour') {
    return formatSejourTimeText(getProposalStartTime(proposal), getProposalEndTime(proposal));
  }
  return getProposalStartTime(proposal);
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
  const startTime = getProposalStartTime(proposal);
  const endTime = getProposalEndTime(proposal);
  return {
    title: proposal.title || '',
    startDate: parsedRange.startDate,
    endDate: parsedRange.endDate,
    time: proposal.type === 'sejour' ? '' : startTime,
    startTime: proposal.type === 'sejour' ? startTime : '',
    endTime: proposal.type === 'sejour' ? endTime : '',
    place: proposal.specifics?.location || '',
  };
}
