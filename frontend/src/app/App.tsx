import { useState } from 'react';
import { Database, Server } from 'lucide-react';
import { RackPlanner } from './components/RackPlanner';
import { DeviceDatabaseModal } from './components/DeviceDatabaseModal';

export default function App() {
  const [deviceDatabaseOpen, setDeviceDatabaseOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-white">
      <header className="bg-gradient-to-r from-[#003366] via-[#004080] to-[#003366] shadow-xl border-b-4 border-[#CC0000]">
        <div className="max-w-[1800px] mx-auto px-6 py-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="absolute inset-0 bg-[#CC0000] blur-lg opacity-50" />
                  <div className="relative bg-[#CC0000] p-3 rounded-lg shadow-lg">
                    <Server className="size-7 text-white" />
                  </div>
                </div>
                <div>
                  <div className="flex items-baseline gap-2">
                    <h1 className="text-3xl font-black text-white tracking-tight">RACK+</h1>
                  </div>
                  <p className="text-blue-100 text-sm font-semibold tracking-wide">
                    Rack. Connect. Configure.
                  </p>
                </div>
              </div>
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
        <RackPlanner />
      </main>

      <DeviceDatabaseModal
        isOpen={deviceDatabaseOpen}
        onClose={() => setDeviceDatabaseOpen(false)}
      />
    </div>
  );
}
