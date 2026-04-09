import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Server, ArrowLeft, Search, Clock, ChevronRight, Loader2, Database, BadgeCheck } from 'lucide-react';
import { format } from 'date-fns';
import { listRacks, type RackSummary } from '../api/racks';
import { DeviceDatabaseModal } from '../components/DeviceDatabaseModal';

export function EditExistingRackPage() {
  const navigate = useNavigate();
  const [deviceDatabaseOpen, setDeviceDatabaseOpen] = useState(false);
  const [selectedRack, setSelectedRack] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [rows, setRows] = useState<RackSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const openSelected = () => {
    if (!selectedRack) return;
    const q = encodeURIComponent(selectedRack);
    // Query param survives reloads; state helps SPA handoff in the same navigation.
    navigate(`/rack?rack=${q}`, { state: { openRackId: selectedRack } });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-white">
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
        <div className="overflow-hidden rounded-xl border-2 border-slate-200 bg-white shadow-xl">
          <div className="border-b-2 border-slate-200 bg-slate-50 p-6">
            <div className="relative mx-auto max-w-2xl">
              <Search className="absolute left-4 top-1/2 size-6 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                placeholder="Search racks by name…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border-2 border-slate-300 py-4 pl-14 pr-4 text-lg font-medium transition-all focus:border-[#CC0000] focus:outline-none focus:ring-2 focus:ring-red-500/20"
              />
            </div>
          </div>

          <div className="p-6">
            {loading && (
              <div className="flex items-center justify-center gap-2 py-16 text-slate-600">
                <Loader2 className="size-6 animate-spin" />
                Loading saved racks…
              </div>
            )}
            {error && <p className="py-8 text-center text-sm text-red-600">{error}</p>}
            {!loading && !error && filteredRacks.length === 0 && (
              <div className="py-16 text-center">
                <Server className="mx-auto mb-4 size-20 text-slate-300" />
                <p className="text-xl font-bold text-slate-600">
                  {rows.length === 0 ? 'No racks saved yet' : 'No racks found'}
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  {rows.length === 0
                    ? 'Build a rack and use Save rack from the planner.'
                    : 'Try adjusting your search.'}
                </p>
              </div>
            )}
            {!loading && !error && filteredRacks.length > 0 && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {filteredRacks.map((rack) => (
                  <button
                    key={rack.id}
                    type="button"
                    onClick={() => setSelectedRack(rack.id)}
                    className={`rounded-xl border-2 p-6 text-left transition-all group hover:shadow-lg ${
                      selectedRack === rack.id
                        ? 'border-[#CC0000] bg-red-50 shadow-md'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="mb-4 flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <h3 className="flex items-center gap-2 text-xl font-black text-slate-800 transition-colors group-hover:text-[#CC0000]">
                          {rack.savedByVerified && (
                            <BadgeCheck
                              className="size-7 shrink-0 text-[#003366]"
                              aria-label="Verified save"
                              title="Verified Fox employee save"
                            />
                          )}
                          <span>{rack.name}</span>
                        </h3>
                        <p className="mt-1 text-sm text-slate-600">
                          <span className="font-medium text-slate-700">Saved by</span>{' '}
                          {rack.savedByDisplayName?.trim()
                            ? rack.savedByDisplayName
                            : 'Unknown'}
                        </p>
                      </div>
                      <ChevronRight
                        className={`ml-2 size-7 shrink-0 transition-all ${
                          selectedRack === rack.id
                            ? 'translate-x-1 text-[#CC0000]'
                            : 'text-slate-300 group-hover:text-slate-400'
                        }`}
                      />
                    </div>

                    <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <div className="rounded-lg bg-slate-100 px-3 py-2">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Devices</p>
                        <p className="text-xl font-black text-slate-800">{rack.deviceCount}</p>
                        <p className="text-[10px] text-slate-500">on rack</p>
                      </div>
                      <div className="rounded-lg bg-slate-100 px-3 py-2">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Height</p>
                        <p className="text-xl font-black text-slate-800">{rack.totalHeight}U</p>
                      </div>
                      <div className="rounded-lg bg-slate-100 px-3 py-2">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Width</p>
                        <p className="text-xl font-black text-slate-800">{rack.rackWidthInches}&quot;</p>
                      </div>
                      <div className="rounded-lg bg-slate-100 px-3 py-2">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Updated</p>
                        <p className="text-sm font-bold leading-tight text-slate-800">
                          {format(new Date(rack.updatedAt), 'MM/dd/yy')}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-200 pt-4">
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Clock className="size-4 shrink-0" />
                        <span>Modified {format(new Date(rack.updatedAt), 'MMM d, yyyy · h:mm a')}</span>
                      </div>
                      <div
                        className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
                          selectedRack === rack.id ? 'bg-[#CC0000] text-white' : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {selectedRack === rack.id ? 'Selected' : 'Select'}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedRack && !loading && !error && filteredRacks.length > 0 && (
            <div className="border-t-2 border-slate-200 bg-slate-50 p-6">
              <div className="mx-auto max-w-2xl">
                <button
                  type="button"
                  onClick={openSelected}
                  className="w-full rounded-lg bg-[#CC0000] px-8 py-4 text-sm font-black uppercase tracking-wider text-white shadow-lg transition-all hover:bg-red-700"
                >
                  Open &amp; edit
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      <DeviceDatabaseModal isOpen={deviceDatabaseOpen} onClose={() => setDeviceDatabaseOpen(false)} />
    </div>
  );
}
