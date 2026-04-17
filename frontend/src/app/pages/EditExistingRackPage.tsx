import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Server,
  ArrowLeft,
  Search,
  Clock,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Database,
  BadgeCheck,
  Trash2,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { format } from 'date-fns';
import { deleteRack, listRacks, type RackSummary } from '../api/racks';
import { DEFAULT_RACK_DEPTH_INCHES } from '../utils/rackUnits';
import { DeviceDatabaseModal } from '../components/DeviceDatabaseModal';
import { AppHeaderBrand } from '../components/AppHeaderBrand';

const RACKS_PER_PAGE = 8;

function parseDateStart(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

function parseDateEnd(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999);
}

export function EditExistingRackPage() {
  const navigate = useNavigate();
  const [deviceDatabaseOpen, setDeviceDatabaseOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  /** yyyy-mm-dd or '' */
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');
  const [minDevices, setMinDevices] = useState('');
  const [maxDevices, setMaxDevices] = useState('');
  const [rows, setRows] = useState<RackSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void listRacks()
      .then((list) => {
        if (!cancelled) setRows(list);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load racks');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredRacks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return rows.filter((rack) => {
      if (q) {
        const name = rack.name.toLowerCase();
        const by = (rack.savedByDisplayName ?? '').trim().toLowerCase();
        if (!name.includes(q) && !by.includes(q)) return false;
      }
      const created = rack.createdAt ? new Date(rack.createdAt) : null;
      if (createdFrom || createdTo) {
        if (!created) return false;
        if (createdFrom && created < parseDateStart(createdFrom)) return false;
        if (createdTo && created > parseDateEnd(createdTo)) return false;
      }
      const minN = minDevices.trim() === '' ? null : parseInt(minDevices, 10);
      const maxN = maxDevices.trim() === '' ? null : parseInt(maxDevices, 10);
      if (minN != null && Number.isFinite(minN) && rack.deviceCount < minN) return false;
      if (maxN != null && Number.isFinite(maxN) && rack.deviceCount > maxN) return false;
      return true;
    });
  }, [rows, searchQuery, createdFrom, createdTo, minDevices, maxDevices]);

  const pageCount = Math.max(1, Math.ceil(filteredRacks.length / RACKS_PER_PAGE));
  const safePage = Math.min(page, pageCount - 1);
  const pagedRacks = filteredRacks.slice(
    safePage * RACKS_PER_PAGE,
    safePage * RACKS_PER_PAGE + RACKS_PER_PAGE,
  );

  useEffect(() => {
    setPage(0);
  }, [searchQuery, createdFrom, createdTo, minDevices, maxDevices]);

  useEffect(() => {
    setPage((p) => Math.min(p, Math.max(0, pageCount - 1)));
  }, [pageCount]);

  const openRackInPlanner = (rackId: string) => {
    const q = encodeURIComponent(rackId);
    navigate(`/rack?rack=${q}`, { state: { openRackId: rackId } });
  };

  const clearFilters = () => {
    setCreatedFrom('');
    setCreatedTo('');
    setMinDevices('');
    setMaxDevices('');
  };

  const hasActiveFilters =
    Boolean(createdFrom || createdTo || minDevices.trim() !== '' || maxDevices.trim() !== '');

  const handleDiscard = async (e: React.MouseEvent, rack: RackSummary) => {
    e.preventDefault();
    e.stopPropagation();
    if (
      !confirm(
        `Delete saved rack "${rack.name}"? This cannot be undone.`,
      )
    ) {
      return;
    }
    setDeletingId(rack.id);
    try {
      await deleteRack(rack.id);
      setRows((prev) => prev.filter((r) => r.id !== rack.id));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete rack');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="rack-workspace-root relative min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-100">
      <div
        className="rack-workspace-grid-overlay pointer-events-none absolute inset-0 opacity-[0.08]"
        aria-hidden
      >
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '50px 50px',
          }}
        />
      </div>
      <div className="relative z-10">
        <header className="border-b-4 border-[#CC0000] bg-gradient-to-r from-[#003366] via-[#004080] to-[#003366] shadow-xl">
          <div className="mx-auto max-w-[1800px] px-6 py-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="no-print group rounded-lg p-2 transition-all hover:bg-white/10"
                  aria-label="Back to home"
                >
                  <ArrowLeft className="size-6 text-white transition-colors group-hover:text-[#CC0000]" />
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="no-print flex items-center gap-3 rounded-lg text-left transition-all hover:bg-white/5"
                  aria-label="Home"
                >
                  <div className="relative">
                    <div className="absolute inset-0 bg-[#CC0000] opacity-50 blur-lg" />
                    <div className="relative rounded-lg bg-[#CC0000] p-3 shadow-lg">
                      <Server className="size-7 text-white" />
                    </div>
                  </div>
                  <AppHeaderBrand mode="edit" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => setDeviceDatabaseOpen(true)}
                className="no-print flex shrink-0 items-center gap-2.5 rounded-lg border border-white/30 bg-white/10 px-5 py-3 text-base font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/20"
              >
                <Database className="size-5 shrink-0" />
                Edit database
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-6 py-8">
          <div className="overflow-hidden rounded-xl border-2 border-slate-600/80 bg-slate-800/90 shadow-xl shadow-black/30 backdrop-blur-sm">
            <div className="border-b-2 border-slate-600/80 bg-slate-900/60 p-6">
              <div className="mx-auto flex max-w-2xl flex-col gap-3 sm:flex-row sm:items-stretch sm:gap-3">
                <div className="relative min-w-0 flex-1">
                  <Search className="absolute left-4 top-1/2 size-6 -translate-y-1/2 text-slate-500" />
                  <input
                    type="search"
                    placeholder="Search by rack name or who saved it…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-lg border-2 border-slate-600 bg-slate-900/80 py-4 pl-14 pr-4 text-lg font-medium text-slate-100 placeholder:text-slate-500 transition-all focus:border-[#CC0000] focus:outline-none focus:ring-2 focus:ring-red-500/30"
                  />
                </div>
                <div className="flex shrink-0 items-center gap-2 sm:min-w-0">
                  <button
                    type="button"
                    onClick={() => setFiltersOpen((o) => !o)}
                    className={`inline-flex h-full min-h-[3.5rem] flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-semibold transition-colors sm:flex-initial sm:px-5 ${
                      filtersOpen || hasActiveFilters
                        ? 'border-sky-500 bg-sky-950/50 text-sky-200'
                        : 'border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700'
                    }`}
                  >
                    <SlidersHorizontal className="size-4 shrink-0" />
                    Filters
                    {hasActiveFilters && (
                      <span className="rounded-full bg-sky-600 px-2 py-0.5 text-xs text-white">On</span>
                    )}
                  </button>
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="inline-flex min-h-[3.5rem] items-center justify-center gap-1 rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-slate-800/80 hover:text-slate-200"
                      title="Clear date and device count filters"
                    >
                      <X className="size-4 shrink-0" />
                      <span className="hidden sm:inline">Clear filters</span>
                    </button>
                  )}
                </div>
              </div>
              {filtersOpen && (
                <div className="mx-auto mt-4 max-w-2xl rounded-lg border border-slate-600 bg-slate-900/80 p-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Date created</p>
                  <div className="mb-4 grid gap-3 sm:grid-cols-2">
                    <label className="block text-sm text-slate-300">
                      <span className="mb-1 block text-xs text-slate-500">From</span>
                      <input
                        type="date"
                        value={createdFrom}
                        onChange={(e) => setCreatedFrom(e.target.value)}
                        className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100"
                      />
                    </label>
                    <label className="block text-sm text-slate-300">
                      <span className="mb-1 block text-xs text-slate-500">To</span>
                      <input
                        type="date"
                        value={createdTo}
                        onChange={(e) => setCreatedTo(e.target.value)}
                        className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100"
                      />
                    </label>
                  </div>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Devices placed on rack
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-sm text-slate-300">
                      <span className="mb-1 block text-xs text-slate-500">Minimum count</span>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        placeholder="Any"
                        value={minDevices}
                        onChange={(e) => setMinDevices(e.target.value)}
                        className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100 placeholder:text-slate-600"
                      />
                    </label>
                    <label className="block text-sm text-slate-300">
                      <span className="mb-1 block text-xs text-slate-500">Maximum count</span>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        placeholder="Any"
                        value={maxDevices}
                        onChange={(e) => setMaxDevices(e.target.value)}
                        className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100 placeholder:text-slate-600"
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6">
              {loading && (
                <div className="flex items-center justify-center gap-2 py-16 text-slate-400">
                  <Loader2 className="size-6 animate-spin" />
                  Loading saved racks…
                </div>
              )}
              {error && <p className="py-8 text-center text-sm text-red-400">{error}</p>}
              {!loading && !error && filteredRacks.length === 0 && (
                <div className="py-16 text-center">
                  <Server className="mx-auto mb-4 size-20 text-slate-600" />
                  <p className="text-xl font-bold text-slate-200">
                    {rows.length === 0 ? 'No racks saved yet' : 'No racks match'}
                  </p>
                  <p className="mt-2 text-sm text-slate-400">
                    {rows.length === 0
                      ? 'Build a rack and use Save rack from the planner.'
                      : 'Try a different search or adjust filters.'}
                  </p>
                </div>
              )}
              {!loading && !error && filteredRacks.length > 0 && (
                <div>
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-600/60 pb-4">
                    <p className="text-sm text-slate-400">
                      Showing{' '}
                      <span className="font-semibold text-slate-200">
                        {filteredRacks.length === 0 ? 0 : safePage * RACKS_PER_PAGE + 1}–
                        {Math.min((safePage + 1) * RACKS_PER_PAGE, filteredRacks.length)}
                      </span>{' '}
                      of <span className="font-semibold text-slate-200">{filteredRacks.length}</span> rack
                      {filteredRacks.length !== 1 ? 's' : ''}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPage((p) => Math.max(0, p - 1))}
                        disabled={safePage <= 0}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-200 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <ChevronLeft className="size-4" />
                        Previous
                      </button>
                      <span className="text-sm tabular-nums text-slate-500">
                        Page {safePage + 1} / {pageCount}
                      </span>
                      <button
                        type="button"
                        onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                        disabled={safePage >= pageCount - 1}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-200 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Next
                        <ChevronRight className="size-4" />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {pagedRacks.map((rack) => (
                      <div
                        key={rack.id}
                        className="group relative rounded-xl border-2 border-slate-600 bg-slate-900/70 transition-all hover:border-slate-500 hover:bg-slate-900/90 hover:shadow-lg hover:shadow-black/20"
                      >
                        <button
                          type="button"
                          aria-label={`Open ${rack.name} in rack planner`}
                          onClick={() => openRackInPlanner(rack.id)}
                          className="w-full rounded-xl p-6 pr-14 text-left"
                        >
                          <div className="mb-4 flex items-start justify-between">
                            <div className="min-w-0 flex-1">
                              <h3 className="flex items-center gap-2 text-xl font-black text-slate-100 transition-colors group-hover:text-[#f87171]">
                                {rack.savedByVerified && (
                                  <span title="Verified Fox employee save" className="inline-flex shrink-0">
                                    <BadgeCheck className="size-7 text-sky-400" aria-label="Verified save" />
                                  </span>
                                )}
                                <span>{rack.name}</span>
                              </h3>
                              <p className="mt-1 text-sm text-slate-400">
                                <span className="font-medium text-slate-300">Saved by</span>{' '}
                                {rack.savedByDisplayName?.trim() ? rack.savedByDisplayName : 'Unknown'}
                              </p>
                            </div>
                            <ChevronRight className="ml-2 size-7 shrink-0 text-slate-600 transition-all group-hover:translate-x-0.5 group-hover:text-[#f87171]" />
                          </div>

                          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                            <div className="rounded-lg border border-slate-600/80 bg-slate-800/80 px-3 py-2">
                              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Devices</p>
                              <p className="text-xl font-black text-slate-100">{rack.deviceCount}</p>
                              <p className="text-[10px] text-slate-500">on rack</p>
                            </div>
                            <div className="rounded-lg border border-slate-600/80 bg-slate-800/80 px-3 py-2">
                              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Height</p>
                              <p className="text-xl font-black text-slate-100">{rack.totalHeight}U</p>
                            </div>
                            <div className="rounded-lg border border-slate-600/80 bg-slate-800/80 px-3 py-2">
                              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Depth</p>
                              <p className="text-xl font-black text-slate-100">
                                {rack.rackDepthInches ?? DEFAULT_RACK_DEPTH_INCHES}&quot;
                              </p>
                            </div>
                            <div className="rounded-lg border border-slate-600/80 bg-slate-800/80 px-3 py-2">
                              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Updated</p>
                              <p className="text-sm font-bold leading-tight text-slate-100">
                                {format(new Date(rack.updatedAt), 'MM/dd/yy')}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-600/80 pt-4 text-xs text-slate-500">
                            <div className="flex items-center gap-2">
                              <Clock className="size-4 shrink-0" />
                              <span>Modified {format(new Date(rack.updatedAt), 'MMM d, yyyy · h:mm a')}</span>
                            </div>
                            {rack.createdAt && (
                              <span className="text-slate-600">
                                Created {format(new Date(rack.createdAt), 'MMM d, yyyy')}
                              </span>
                            )}
                          </div>
                        </button>

                        <button
                          type="button"
                          disabled={deletingId === rack.id}
                          onClick={(e) => void handleDiscard(e, rack)}
                          className="absolute right-3 top-3 rounded-lg border border-slate-600 bg-slate-800/90 p-2 text-slate-400 transition-colors hover:border-red-800/60 hover:bg-red-950/40 hover:text-red-300 disabled:opacity-50"
                          title="Delete this saved rack"
                          aria-label={`Delete saved rack ${rack.name}`}
                        >
                          {deletingId === rack.id ? (
                            <Loader2 className="size-5 animate-spin" />
                          ) : (
                            <Trash2 className="size-5" />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>

        <DeviceDatabaseModal isOpen={deviceDatabaseOpen} onClose={() => setDeviceDatabaseOpen(false)} />
      </div>
    </div>
  );
}
