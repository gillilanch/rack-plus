import { ConnectionSolution } from '../utils/cableFinder';
import { Device } from '../data/equipment';
import { getDeviceDisplayName } from '../utils/deviceDisplay';
import { ArrowRight } from 'lucide-react';

interface ConnectionDiagramProps {
  fromDevice: Device;
  toDevice: Device;
  solution: ConnectionSolution;
  variant?: 'light' | 'dark';
}

export function ConnectionDiagram({ fromDevice, toDevice, solution, variant = 'light' }: ConnectionDiagramProps) {
  if (solution.type === 'impossible') return null;

  const dark = variant === 'dark';

  const shell = dark
    ? 'mt-4 rounded-xl border border-slate-600 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 ring-1 ring-slate-800/80'
    : 'mt-4 rounded-lg border border-gray-300 bg-gradient-to-r from-gray-50 to-gray-100 p-4';

  const title = dark ? 'mb-3 text-xs font-bold uppercase tracking-wide text-cyan-200/90' : 'mb-3 text-xs font-semibold uppercase text-gray-500';

  const fromToLabel = dark ? 'text-[11px] font-semibold uppercase tracking-wide text-cyan-300/90' : 'text-xs text-gray-500';

  const name = dark ? 'text-sm font-semibold text-slate-50' : 'font-semibold text-sm text-gray-900';

  const fromBox = dark
    ? 'rounded-lg border-2 border-cyan-500/70 bg-slate-950/90 px-3 py-2 shadow-inner shadow-black/40 ring-1 ring-cyan-500/20'
    : 'rounded-lg border-2 border-blue-400 bg-white px-3 py-2 shadow-sm';

  const toBox = dark
    ? 'rounded-lg border-2 border-violet-500/70 bg-slate-950/90 px-3 py-2 shadow-inner shadow-black/40 ring-1 ring-violet-500/20'
    : 'rounded-lg border-2 border-purple-400 bg-white px-3 py-2 shadow-sm';

  const adapterBox = dark
    ? 'rounded-lg border-2 border-amber-500/60 bg-amber-950/35 px-3 py-2 shadow-inner ring-1 ring-amber-500/15'
    : 'rounded-lg border-2 border-yellow-400 bg-yellow-50 px-3 py-2 shadow-sm';

  const adapterLabel = dark ? 'text-[11px] font-semibold uppercase text-amber-200/90' : 'text-xs text-yellow-700';

  const cableBox = dark
    ? 'rounded-lg border-2 border-emerald-500/60 bg-emerald-950/30 px-3 py-2 shadow-inner ring-1 ring-emerald-500/15'
    : 'rounded-lg border-2 border-green-400 bg-green-50 px-3 py-2 shadow-sm';

  const cableLabel = dark ? 'text-[11px] font-semibold uppercase text-emerald-300/90' : 'text-xs text-green-700';

  const arrow = dark ? 'size-4 shrink-0 text-slate-500' : 'size-4 shrink-0 text-gray-400';

  const adapterName = dark ? 'text-sm font-medium text-slate-100' : 'font-medium text-sm text-gray-900';

  return (
    <div className={shell}>
      <div className={title}>Connection path</div>

      <div className="flex flex-wrap items-center gap-2">
        <div className={fromBox}>
          <div className={fromToLabel}>From (source)</div>
          <div className={name}>{getDeviceDisplayName(fromDevice)}</div>
        </div>

        <ArrowRight className={arrow} />

        {solution.adapters && solution.adapters.length > 0 && (
          <>
            <div className={adapterBox}>
              <div className={adapterLabel}>Adapter</div>
              <div className={adapterName}>
                {solution.adapters[0].inputType} → {solution.adapters[0].outputType}
              </div>
            </div>
            <ArrowRight className={arrow} />
          </>
        )}

        {solution.cable && (
          <>
            <div className={cableBox}>
              <div className={cableLabel}>Cable</div>
              <div className={adapterName}>{solution.cable.name}</div>
            </div>
            <ArrowRight className={arrow} />
          </>
        )}

        {solution.adapters && solution.adapters.length > 1 && (
          <>
            <div className={adapterBox}>
              <div className={adapterLabel}>Adapter</div>
              <div className={adapterName}>
                {solution.adapters[1].inputType} → {solution.adapters[1].outputType}
              </div>
            </div>
            <ArrowRight className={arrow} />
          </>
        )}

        <div className={toBox}>
          <div className={fromToLabel}>To (destination)</div>
          <div className={name}>{getDeviceDisplayName(toDevice)}</div>
        </div>
      </div>
    </div>
  );
}
