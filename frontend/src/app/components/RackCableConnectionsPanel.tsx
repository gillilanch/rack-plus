import { useEffect, useMemo, useState } from 'react';
import type { RackDevice } from '../types/rack';
import type { Device } from '../data/equipment';
import { findConnection, type ConnectionSolution } from '../utils/cableFinder';
import { normalizeRackDeviceForCableFinder } from '../utils/rackCableDevice';
import { DeviceSelector } from './DeviceSelector';
import { ConnectionResults } from './ConnectionResults';
import { QuickPresets } from './QuickPresets';
import { ArrowRight, Cable, RefreshCw } from 'lucide-react';

interface RackCableConnectionsPanelProps {
  devices: RackDevice[];
}

export function RackCableConnectionsPanel({ devices }: RackCableConnectionsPanelProps) {
  const cableDevices = useMemo(
    () => devices.map((d) => normalizeRackDeviceForCableFinder(d)),
    [devices],
  );
  const idToRack = useMemo(() => new Map(devices.map((d) => [d.id, d])), [devices]);

  const [fromId, setFromId] = useState<string | null>(null);
  const [toId, setToId] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [solutions, setSolutions] = useState<ConnectionSolution[]>([]);

  const fromDevice = fromId ? idToRack.get(fromId) ?? null : null;
  const toDevice = toId ? idToRack.get(toId) ?? null : null;

  const fromCable = fromDevice ? normalizeRackDeviceForCableFinder(fromDevice) : null;
  const toCable = toDevice ? normalizeRackDeviceForCableFinder(toDevice) : null;

  const handleFindCable = () => {
    if (fromCable && toCable) {
      setSolutions(findConnection(fromCable, toCable));
      setShowResults(true);
    }
  };

  const handleReset = () => {
    setFromId(null);
    setToId(null);
    setSolutions([]);
    setShowResults(false);
  };

  const handlePresetSelect = (from: Device, to: Device) => {
    setFromId(from.id);
    setToId(to.id);
    setSolutions(findConnection(from, to));
    setShowResults(true);
  };

  const canFind = fromId !== null && toId !== null && fromId !== toId;
  const rackDeviceIds = useMemo(() => new Set(devices.map((d) => d.id)), [devices]);

  useEffect(() => {
    if (fromId === null || toId === null) {
      setShowResults(false);
      setSolutions([]);
    }
  }, [fromId, toId]);

  if (devices.length === 0) {
    return null;
  }

  return (
    <div className="shrink-0 border-t border-slate-600/80 pt-6">
      <div className="mb-4 rounded-xl border border-slate-600/90 bg-slate-950/70 p-4 ring-1 ring-slate-800/80">
        <h3 className="text-base font-bold tracking-tight text-slate-100">Connections between rack devices</h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          Pick two devices from this rack (same list as above). We suggest cables and adapters from their ports.
          Add or edit ports on each device via the rack editor when needed.
        </p>
      </div>

      <QuickPresets
        devices={cableDevices}
        onSelectPreset={handlePresetSelect}
        requiredDeviceIds={rackDeviceIds}
        variant="embedded"
        embeddedSurface="dark"
      />

      <div className="rounded-xl border border-slate-600/90 bg-slate-950/50 p-4 ring-1 ring-slate-800/60">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_auto_1fr]">
          <DeviceSelector
            devices={cableDevices}
            selectedDevice={fromCable}
            onSelectDevice={((d: Device | null) => setFromId(d?.id ?? null)) as (d: Device) => void}
            label="From (source)"
            placeholder="Select source…"
            variant="dark"
          />
          <div className="hidden items-center justify-center pt-8 lg:flex">
            <ArrowRight className="size-7 text-cyan-500/60" />
          </div>
          <DeviceSelector
            devices={cableDevices}
            selectedDevice={toCable}
            onSelectDevice={((d: Device | null) => setToId(d?.id ?? null)) as (d: Device) => void}
            label="To (destination)"
            placeholder="Select destination…"
            variant="dark"
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleFindCable}
            disabled={!canFind}
            className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all ${
              canFind
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-950/40 hover:bg-cyan-500'
                : 'cursor-not-allowed bg-slate-800 text-slate-600'
            }`}
          >
            <Cable className="size-4" />
            Find cable path
          </button>
          {(fromId || toId) && (
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:border-slate-500 hover:bg-slate-800"
            >
              <RefreshCw className="size-4" />
              Reset
            </button>
          )}
        </div>
        {fromId !== null && toId !== null && fromId === toId && (
          <p className="mt-2 text-sm text-amber-400/95">Choose two different devices.</p>
        )}
      </div>

      {showResults && fromCable && toCable && (
        <div className="mt-4 rounded-xl border border-slate-600/90 bg-slate-950/60 p-4 ring-1 ring-slate-800/70">
          {solutions.length === 0 ? (
            <p className="text-sm text-slate-400">
              No compatible path found from these port definitions. Open a device on the rack and add inputs/outputs
              that match your gear.
            </p>
          ) : (
            <ConnectionResults
              solutions={solutions}
              fromDevice={fromCable}
              toDevice={toCable}
              variant="dark"
            />
          )}
        </div>
      )}
    </div>
  );
}
