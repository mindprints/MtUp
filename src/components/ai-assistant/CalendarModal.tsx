import { Modal } from '@/components/Modal';

export type CalendarPopupState = {
    proposalId: string;
    proposalTitle: string;
    anchorMonthIso: string;
    originalDates: string[];
    alternativeDates: string[];
};

function shiftIsoDateByDays(isoDate: string, deltaDays: number): string | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null;
    const date = new Date(`${isoDate}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) return null;
    date.setUTCDate(date.getUTCDate() + deltaDays);
    return date.toISOString().slice(0, 10);
}

function getMonthIsoFromDateIso(dateIso: string): string | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) return null;
    return dateIso.slice(0, 7);
}

function getMonthBoundaries(monthIso: string): { firstDayIso: string; lastDayIso: string } | null {
    const [yearText, monthText] = monthIso.split('-');
    const year = Number(yearText);
    const month = Number(monthText);
    if (!year || !month) return null;
    const firstDayIso = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const lastDayIso = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    return { firstDayIso, lastDayIso };
}

function collectCalendarMonthIsos(
    originalDates: string[],
    alternativeDates: string[],
    anchorMonthIso: string
): string[] {
    const monthSet = new Set<string>();
    [...originalDates, ...alternativeDates].forEach((dateIso) => {
        const monthIso = getMonthIsoFromDateIso(dateIso);
        if (monthIso) monthSet.add(monthIso);
    });
    if (monthSet.size === 0) {
        const anchorMonth = anchorMonthIso.slice(0, 7);
        monthSet.add(anchorMonth);
    }
    return Array.from(monthSet).sort();
}

function formatIsoMonthLabel(anchorIso: string): string {
    const [yearText, monthText] = anchorIso.split('-');
    const year = Number(yearText);
    const month = Number(monthText);
    if (!year || !month) return anchorIso;
    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December',
    ];
    return `${monthNames[month - 1]} ${year}`;
}

function buildMonthCells(anchorIso: string): Array<{ iso: string | null; day: number | null }> {
    const [yearText, monthText] = anchorIso.split('-');
    const year = Number(yearText);
    const month = Number(monthText);
    if (!year || !month) return [];

    const daysInMonth = new Date(year, month, 0).getDate();
    const firstWeekday = new Date(year, month - 1, 1).getDay();
    const leadingBlanks = (firstWeekday + 6) % 7; // Monday-first grid

    const cells: Array<{ iso: string | null; day: number | null }> = [];
    for (let i = 0; i < leadingBlanks; i += 1) {
        cells.push({ iso: null, day: null });
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
        const iso = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        cells.push({ iso, day });
    }
    while (cells.length % 7 !== 0) {
        cells.push({ iso: null, day: null });
    }
    return cells;
}

type CalendarModalProps = {
    calendarPopup: CalendarPopupState | null;
    onClose: () => void;
};

export function CalendarModal({ calendarPopup, onClose }: CalendarModalProps) {
    return (
        <Modal
            isOpen={Boolean(calendarPopup)}
            onClose={onClose}
            title={calendarPopup ? `${calendarPopup.proposalTitle} calendar` : 'Proposal calendar'}
        >
            {calendarPopup &&
                (() => {
                    const originalDateSet = new Set(calendarPopup.originalDates);
                    const alternativeDateSet = new Set(calendarPopup.alternativeDates);
                    const monthIsos = collectCalendarMonthIsos(
                        calendarPopup.originalDates,
                        calendarPopup.alternativeDates,
                        calendarPopup.anchorMonthIso
                    );

                    return (
                        <div className="space-y-4 text-xs">
                            {monthIsos.map((monthIso) => {
                                const monthBoundaries = getMonthBoundaries(monthIso);
                                const originalContinuesFromPreviousMonth =
                                    Boolean(monthBoundaries?.firstDayIso) &&
                                    originalDateSet.has(monthBoundaries!.firstDayIso) &&
                                    originalDateSet.has(shiftIsoDateByDays(monthBoundaries!.firstDayIso, -1) || '');
                                const originalContinuesToNextMonth =
                                    Boolean(monthBoundaries?.lastDayIso) &&
                                    originalDateSet.has(monthBoundaries!.lastDayIso) &&
                                    originalDateSet.has(shiftIsoDateByDays(monthBoundaries!.lastDayIso, 1) || '');
                                const alternativeContinuesFromPreviousMonth =
                                    Boolean(monthBoundaries?.firstDayIso) &&
                                    alternativeDateSet.has(monthBoundaries!.firstDayIso) &&
                                    alternativeDateSet.has(shiftIsoDateByDays(monthBoundaries!.firstDayIso, -1) || '');
                                const alternativeContinuesToNextMonth =
                                    Boolean(monthBoundaries?.lastDayIso) &&
                                    alternativeDateSet.has(monthBoundaries!.lastDayIso) &&
                                    alternativeDateSet.has(shiftIsoDateByDays(monthBoundaries!.lastDayIso, 1) || '');

                                return (
                                    <div key={`calendar-month-${monthIso}`} className="space-y-2">
                                        <p className="text-sm font-semibold text-gray-800 dark:text-slate-100">
                                            {formatIsoMonthLabel(monthIso)}
                                        </p>
                                        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-medium text-gray-500 dark:text-slate-400">
                                            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label) => (
                                                <div key={`weekday-${monthIso}-${label}`}>{label}</div>
                                            ))}
                                        </div>
                                        <div className="grid grid-cols-7 gap-1">
                                            {buildMonthCells(monthIso).map((cell, index) => {
                                                if (!cell.iso || !cell.day) {
                                                    return (
                                                        <div
                                                            key={`blank-${monthIso}-${index}`}
                                                            className="h-8 rounded-md bg-transparent"
                                                        />
                                                    );
                                                }
                                                const prevIso = shiftIsoDateByDays(cell.iso, -1);
                                                const nextIso = shiftIsoDateByDays(cell.iso, 1);
                                                const isOriginal = originalDateSet.has(cell.iso);
                                                const isAlternative = alternativeDateSet.has(cell.iso);
                                                const hasPrevOriginal = Boolean(prevIso && originalDateSet.has(prevIso));
                                                const hasNextOriginal = Boolean(nextIso && originalDateSet.has(nextIso));
                                                const hasPrevAlternative = Boolean(prevIso && alternativeDateSet.has(prevIso));
                                                const hasNextAlternative = Boolean(nextIso && alternativeDateSet.has(nextIso));

                                                return (
                                                    <div
                                                        key={`${monthIso}-${cell.iso}`}
                                                        className="relative h-8 overflow-hidden rounded-md border border-gray-200 bg-white text-gray-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                                                    >
                                                        {isOriginal && (
                                                            <div
                                                                className={`absolute top-1 h-2 bg-sky-300 dark:bg-sky-700 ${hasPrevOriginal ? 'left-0' : 'left-0.5 rounded-l-md'
                                                                    } ${hasNextOriginal ? 'right-0' : 'right-0.5 rounded-r-md'}`}
                                                            />
                                                        )}
                                                        {isAlternative && (
                                                            <div
                                                                className={`absolute bottom-1 h-2 bg-amber-300 dark:bg-amber-700 ${hasPrevAlternative ? 'left-0' : 'left-0.5 rounded-l-md'
                                                                    } ${hasNextAlternative ? 'right-0' : 'right-0.5 rounded-r-md'}`}
                                                            />
                                                        )}
                                                        <div className="relative z-10 flex h-full items-center justify-center text-[11px] font-medium">
                                                            {cell.day}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        {(originalContinuesFromPreviousMonth ||
                                            originalContinuesToNextMonth ||
                                            alternativeContinuesFromPreviousMonth ||
                                            alternativeContinuesToNextMonth) && (
                                                <div className="flex flex-wrap items-center gap-2 text-[10px]">
                                                    {originalContinuesFromPreviousMonth && (
                                                        <span className="rounded-full bg-sky-100 px-2 py-0.5 text-sky-700 dark:bg-sky-900/30 dark:text-sky-200">
                                                            Original sejour continues from previous month
                                                        </span>
                                                    )}
                                                    {originalContinuesToNextMonth && (
                                                        <span className="rounded-full bg-sky-100 px-2 py-0.5 text-sky-700 dark:bg-sky-900/30 dark:text-sky-200">
                                                            Original sejour continues to next month
                                                        </span>
                                                    )}
                                                    {alternativeContinuesFromPreviousMonth && (
                                                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
                                                            Alternative sejour continues from previous month
                                                        </span>
                                                    )}
                                                    {alternativeContinuesToNextMonth && (
                                                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
                                                            Alternative sejour continues to next month
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                    </div>
                                );
                            })}
                            <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                                <span className="inline-flex items-center gap-1">
                                    <span className="h-2.5 w-2.5 rounded-full bg-sky-400 dark:bg-sky-300" />
                                    Original dates (top line)
                                </span>
                                <span className="inline-flex items-center gap-1">
                                    <span className="h-2.5 w-2.5 rounded-full bg-amber-400 dark:bg-amber-300" />
                                    Alternative dates (bottom line)
                                </span>
                            </div>
                        </div>
                    );
                })()}
        </Modal>
    );
}
