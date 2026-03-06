import { useState } from 'react';
import { memoryStore } from '@/lib/memoryStore';
import type { MemoryRecord } from '@/types';

type MemoryStatusFilter = MemoryRecord['status'] | 'all';
type MemoryTypeFilter = 'all' | 'availability_';

type MemoryExplorerProps = {
    activeGroupId: string | null;
    summarizeMemoryRecord: (record: MemoryRecord) => string;
};

export function MemoryExplorer({ activeGroupId, summarizeMemoryRecord }: MemoryExplorerProps) {
    const [memoryStatusFilter, setMemoryStatusFilter] = useState<MemoryStatusFilter>('all');
    const [memoryTypeFilter, setMemoryTypeFilter] = useState<MemoryTypeFilter>('all');

    const allMemoryRecords = memoryStore.listForGroupFiltered(activeGroupId, {
        status: memoryStatusFilter,
        factTypePrefix: memoryTypeFilter,
    });

    return (
        <div className="mt-3 rounded border border-emerald-200 bg-white p-3 dark:border-emerald-900/50 dark:bg-slate-900">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
                    Memory Explorer
                </p>
                <p className="text-[11px] text-gray-600 dark:text-slate-300">v1 in-panel view</p>
            </div>
            <div className="mb-3 flex flex-wrap gap-2">
                <label className="text-[11px] text-gray-700 dark:text-slate-200">
                    Status
                    <select
                        value={memoryStatusFilter}
                        onChange={(e) => setMemoryStatusFilter(e.target.value as MemoryStatusFilter)}
                        className="ml-1 rounded border border-gray-300 bg-white px-1.5 py-1 text-[11px] text-gray-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:[color-scheme:dark]"
                    >
                        <option value="all">All</option>
                        <option value="reported">Reported</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="inferred">Inferred</option>
                        <option value="needs_confirmation">Needs confirmation</option>
                        <option value="contradicted">Contradicted</option>
                    </select>
                </label>
                <label className="text-[11px] text-gray-700 dark:text-slate-200">
                    Type
                    <select
                        value={memoryTypeFilter}
                        onChange={(e) => setMemoryTypeFilter(e.target.value as MemoryTypeFilter)}
                        className="ml-1 rounded border border-gray-300 bg-white px-1.5 py-1 text-[11px] text-gray-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:[color-scheme:dark]"
                    >
                        <option value="all">All</option>
                        <option value="availability_">Availability only</option>
                    </select>
                </label>
            </div>
            <div className="max-h-60 space-y-2 overflow-y-auto">
                {allMemoryRecords.length === 0 ? (
                    <p className="text-xs text-gray-600 dark:text-slate-300">
                        No memory records match the current filters.
                    </p>
                ) : (
                    allMemoryRecords.map((record) => (
                        <div
                            key={`explorer-${record.id}`}
                            className="rounded border border-gray-200 bg-gray-50 px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                        >
                            <div className="flex flex-wrap items-center gap-1.5">
                                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] dark:bg-slate-800">
                                    {record.status}
                                </span>
                                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] dark:bg-slate-800">
                                    {record.factType}
                                </span>
                                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] dark:bg-slate-800">
                                    {typeof record.value.seedProfile === 'string'
                                        ? String(record.value.seedProfile)
                                        : `user ${record.scopeId}`}
                                </span>
                                <span className="text-[10px] text-gray-500 dark:text-slate-400">
                                    {new Date(record.observedAt).toLocaleString()}
                                </span>
                            </div>
                            <p className="mt-1 text-gray-700 dark:text-slate-200">
                                {summarizeMemoryRecord(record)}
                            </p>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
