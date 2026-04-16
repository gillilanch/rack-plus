import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Server, ArrowLeft, Search, Clock, ChevronRight, ChevronLeft, Loader2, Database, BadgeCheck } from 'lucide-react';
import { format } from 'date-fns';
import { listRacks, type RackSummary } from '../api/racks';
import { DEFAULT_RACK_DEPTH_INCHES } from '../utils/rackUnits';
import { DeviceDatabaseModal } from '../components/DeviceDatabaseModal';

const RACKS_PER_PAGE = 8;

export function EditExistingRackPage() {
  const navigate = useNavigate();
  const [deviceDatabaseOpen, setDeviceDatabaseOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [rows, setRows] = useState<RackSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);

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

  const filteredRacks = rows.filter((rack) =>
    rack.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const pageCount = Math.max(1, Math.ceil(filteredRacks.length / RACKS_PER_PAGE));
  const safePage = Math.min(page, pageCount - 1);
  const pagedRacks = filteredRacks.slice(
    safePage * RACKS_PER_PAGE,
    safePage * RACKS_PER_PAGE + RACKS_PER_PAGE,
  );

  useEffect(() => {
    setPage(0);
  }, [searchQuery]);

  useEffect(() => {
    setPage((p) => Math.min(p, Math.max(0, pageCount - 1)));
  }, [pageCount]);

  const openRackInPlanner = (rackId: string) => {
    const q = encodeURIComponent(rackId);
    // Query param survives reloads; state helps SPA handoff in the same navigation.
    navigate(`/rack?rack=${q}`, { state: { openRackId: rackId } });
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
                <div>
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-3xl font-black tracking-tight text-white">RACK+</span>
                    <span className="rounded bg-white px-2 py-0.5 text-xs font-black tracking-wider text-[#CC0000]">
                      PRO
                    </span>
                  </div>
                  <p className="text-sm font-semibold tracking-wide text-blue-100">FOX BROADCAST ENGINEERING</p>
                  <p className="mt-0.5 text-xs font-bold uppercase tracking-wide text-blue-200/90">
                    Saved racks
                  </p>
                </div>
              </button>
            </div>
            <button
              type="button"
              onClick={() => setDeviceDatabaseOpen(true)}
              className="no-print flex shrink-0 items-center gap-2 rounded-lg border border-white/30 bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/20"
            >
              <Database className="size-4" />
              Device database
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="overflow-hidden rounded-xl border-2 border-slate-600/80 bg-slate-800/90 shadow-xl shadow-black/30 backdrop-blur-sm">
          <div className="border-b-2 border-slate-600/80 bg-slate-900/60 p-6">
            <div className="relative mx-auto max-w-2xl">
              <Search className="absolute left-4 top-1/2 size-6 -translate-y-1/2 text-slate-500" />
              <input
                type="search"
                placeholder="Search racks by name…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border-2 border-slate-600 bg-slate-900/80 py-4 pl-14 pr-4 text-lg font-medium text-slate-100 placeholder:text-slate-500 transition-all focus:border-[#CC0000] focus:outline-none focus:ring-2 focus:ring-red-500/30"
              />
            </div>
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
                  {rows.length === 0 ? 'No racks saved yet' : 'No racks found'}
                </p>
                <p className="mt-2 text-sm text-slate-400">
                  {rows.length === 0
                    ? 'Build a rack and use Save rack from the planner.'
                    : 'Try adjusting your search.'}
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
                  <button
                    key={rack.id}
                    type="button"
                    aria-label={`Open ${rack.name} in rack planner`}
                    onClick={() => openRackInPlanner(rack.id)}
                    className="rounded-xl border-2 border-slate-600 bg-slate-900/70 p-6 text-left transition-all group hover:border-slate-500 hover:bg-slate-900/90 hover:shadow-lg hover:shadow-black/20"
                  >
                    <div className="mb-4 flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <h3 className="flex items-center gap-2 text-xl font-black text-slate-100 transition-colors group-hover:text-[#f87171]">
                          {rack.savedByVerified && (
                            <BadgeCheck
                              className="size-7 shrink-0 text-sky-400"
                              aria-label="Verified save"
                              title="Verified Fox employee save"
                            />
                          )}
                          <span>{rack.name}</span>
                        </h3>
                        <p className="mt-1 text-sm text-slate-400">
                          <span className="font-medium text-slate-300">Saved by</span>{' '}
                          {rack.savedByDisplayName?.trim()
                            ? rack.savedByDisplayName
                            : 'Unknown'}
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

                    <div className="flex items-center justify-between border-t border-slate-600/80 pt-4">
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Clock className="size-4 shrink-0" />
                        <span>Modified {format(new Date(rack.updatedAt), 'MMM d, yyyy · h:mm a')}</span>
                      </div>
                      <div className="rounded-full border border-slate-600 bg-slate-800 px-3 py-1 text-xs font-bold uppercase tracking-wider text-slate-300 group-hover:border-[#CC0000] group-hover:bg-[#CC0000] group-hover:text-white">
                        Open
                      </div>
                    </div>
                  </button>
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
