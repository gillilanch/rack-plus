import { ConnectionSolution } from '../utils/cableFinder';
import { Cable, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { Device } from '../data/equipment';
import { ConnectionDiagram } from './ConnectionDiagram';

interface ConnectionResultsProps {
  solutions: ConnectionSolution[];
  fromDevice: Device;
  toDevice: Device;
  variant?: 'light' | 'dark';
}

export function ConnectionResults({ solutions, fromDevice, toDevice, variant = 'light' }: ConnectionResultsProps) {
  if (solutions.length === 0) return null;

  const dark = variant === 'dark';

  const h3 = dark ? 'text-lg font-bold text-slate-100' : 'text-lg font-semibold text-gray-900';

  const cardBase = 'rounded-xl border-2 p-4';
  const cardImpossible = dark
    ? `${cardBase} border-red-800/80 bg-red-950/40`
    : `${cardBase} border-red-200 bg-red-50`;
  const cardHigh = dark
    ? `${cardBase} border-emerald-700/70 bg-emerald-950/35`
    : `${cardBase} border-green-300 bg-green-50`;
  const cardMed = dark
    ? `${cardBase} border-amber-600/70 bg-amber-950/30`
    : `${cardBase} border-yellow-300 bg-yellow-50`;

  const iconImp = dark ? 'text-red-400' : 'text-red-600';
  const iconHigh = dark ? 'text-emerald-400' : 'text-green-600';
  const iconMed = dark ? 'text-amber-400' : 'text-yellow-600';

  const badgeImp = dark ? 'bg-red-950/80 text-red-200 ring-1 ring-red-800/60' : 'bg-red-200 text-red-800';
  const badgeDirect = dark ? 'bg-emerald-950/80 text-emerald-200 ring-1 ring-emerald-800/50' : 'bg-green-200 text-green-800';
  const badgeAdap = dark ? 'bg-sky-950/80 text-sky-200 ring-1 ring-sky-800/50' : 'bg-blue-200 text-blue-800';
  const badgeConv = dark ? 'bg-amber-950/80 text-amber-200 ring-1 ring-amber-800/50' : 'bg-yellow-200 text-yellow-800';

  const confBadge = dark
    ? 'bg-slate-800 text-slate-200 ring-1 ring-slate-600'
    : 'bg-gray-200 text-gray-700';

  const title = dark ? 'font-medium text-slate-50' : 'font-medium text-gray-900';
  const sub = dark ? 'text-sm text-slate-400' : 'text-sm text-gray-600';
  const adaptersTitle = dark ? 'mb-1 text-sm font-semibold text-slate-300' : 'mb-1 text-sm font-medium text-gray-700';
  const adapterLi = dark ? 'text-sm text-slate-300' : 'text-sm text-gray-600';
  const noteBox = dark
    ? 'rounded-lg bg-slate-950/80 p-2 text-sm text-slate-300 ring-1 ring-slate-700/80'
    : 'rounded bg-white/50 bg-opacity-50 p-2 text-sm text-gray-700';

  return (
    <div className="space-y-4">
      <h3 className={h3}>Cable recommendations</h3>

      {solutions.map((solution, idx) => (
        <div
          key={idx}
          className={
            solution.type === 'impossible'
              ? cardImpossible
              : solution.confidence === 'high'
                ? cardHigh
                : cardMed
          }
        >
          <div className="flex items-start gap-3">
            <div
              className={`mt-1 ${
                solution.type === 'impossible' ? iconImp : solution.confidence === 'high' ? iconHigh : iconMed
              }`}
            >
              {solution.type === 'impossible' ? (
                <AlertCircle className="size-6" />
              ) : solution.type === 'direct' ? (
                <CheckCircle2 className="size-6" />
              ) : (
                <Info className="size-6" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span
                  className={`inline-block rounded px-2 py-0.5 text-xs font-semibold uppercase ${
                    solution.type === 'impossible'
                      ? badgeImp
                      : solution.type === 'direct'
                        ? badgeDirect
                        : solution.type === 'adapter'
                          ? badgeAdap
                          : badgeConv
                  }`}
                >
                  {solution.type === 'direct'
                    ? 'Direct connection'
                    : solution.type === 'adapter'
                      ? 'Adapter required'
                      : solution.type === 'converter'
                        ? 'Converter required'
                        : 'No connection available'}
                </span>

                <span className={`inline-block rounded px-2 py-0.5 text-xs ${confBadge}`}>
                  {solution.confidence} confidence
                </span>
              </div>

              {solution.cable && (
                <div className="mb-2">
                  <div className={`flex items-center gap-2 ${title}`}>
                    <Cable className="size-4 shrink-0" />
                    <span>{solution.cable.name}</span>
                  </div>
                  <div className={`ml-6 ${sub}`}>
                    {solution.cable.connectorA} ↔ {solution.cable.connectorB}
                    {solution.cable.notes && <span className="ml-2 italic">• {solution.cable.notes}</span>}
                  </div>
                </div>
              )}

              {solution.adapters && solution.adapters.length > 0 && (
                <div className="mb-2 ml-6">
                  <div className={adaptersTitle}>Required adapters</div>
                  <ul className="space-y-1">
                    {solution.adapters.map((adapter, adapterIdx) => (
                      <li key={adapterIdx} className={adapterLi}>
                        • {adapter.name}
                        {adapter.notes && (
                          <span className={`ml-2 italic ${dark ? 'text-slate-500' : 'text-gray-500'}`}>
                            ({adapter.notes})
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {solution.notes && (
                <div className={noteBox}>
                  <strong className={dark ? 'text-slate-200' : ''}>Note:</strong> {solution.notes}
                </div>
              )}

              {solution.type !== 'impossible' && (
                <ConnectionDiagram
                  fromDevice={fromDevice}
                  toDevice={toDevice}
                  solution={solution}
                  variant={variant}
                />
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
