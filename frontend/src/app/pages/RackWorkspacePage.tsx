import { useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { ArrowLeft, Database, Server } from 'lucide-react';
import { RackPlanner } from '../components/RackPlanner';
import { DeviceDatabaseModal } from '../components/DeviceDatabaseModal';

type RackLocationState = { openRackLibrary?: boolean; openRackId?: string } | null;

export function RackWorkspacePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const locState = location.state as RackLocationState;
  const rackFromQuery = searchParams.get('rack')?.trim() || undefined;
  const openRackIdFromState = locState?.openRackId;
  const openRackId = rackFromQuery ?? openRackIdFromState;
  const forceNewRack = searchParams.get('new') === '1' || searchParams.get('new') === 'true';
  const openRackLibrary =
    Boolean(locState?.openRackLibrary) && !openRackId && !rackFromQuery && !forceNewRack;
  const [deviceDatabaseOpen, setDeviceDatabaseOpen] = useState(false);

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

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <RackPlanner
          key={openRackId ? `rack-open:${openRackId}` : forceNewRack ? `rack-new:${location.key}` : location.key}
          initialOpenRackLibrary={openRackLibrary}
          initialRackIdToLoad={openRackId}
          forceNewRack={forceNewRack}
        />
      </main>

      <DeviceDatabaseModal isOpen={deviceDatabaseOpen} onClose={() => setDeviceDatabaseOpen(false)} />
      </div>
    </div>
  );
}
