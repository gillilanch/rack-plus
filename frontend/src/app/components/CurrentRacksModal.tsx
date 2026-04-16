import { useEffect, useState } from 'react';
import { X, Loader2, FolderOpen, BadgeCheck } from 'lucide-react';
import { listRacks, type RackSummary } from '../api/racks';
import { DEFAULT_RACK_DEPTH_INCHES } from '../utils/rackUnits';
import { formatDistanceToNow } from 'date-fns';

/* should  */
type Props = {
  isOpen: boolean;
  onClose: () => void;
  currentRackId: string | null;
  onOpenRack: (id: string) => void | Promise<void>;
};

export function CurrentRacksModal({ isOpen, onClose, currentRackId, onOpenRack }: Props) {
  const [rows, setRows] = useState<RackSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
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
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="no-print fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[min(90vh,32rem)] w-full max-w-lg flex-col rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <FolderOpen className="size-5 text-gray-700" />
            <h2 className="text-lg font-semibold text-gray-900">Current racks</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>
        <p className="border-b border-gray-100 px-5 py-2 text-xs text-gray-500">
          Global list — all saved racks on this server. Open one to edit it here.
        </p>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-12 text-gray-600">
              <Loader2 className="size-5 animate-spin" />
              Loading…
            </div>
          )}
          {error && <p className="px-2 py-4 text-sm text-red-600">{error}</p>}
          {!loading && !error && rows.length === 0 && (
            <p className="px-2 py-8 text-center text-sm text-gray-500">No racks yet. Save one from the planner.</p>
          )}
          {!loading && !error && rows.length > 0 && (
            <ul className="space-y-1">
              {rows.map((r) => {
                const active = r.id === currentRackId;
                return (
                  <li key={r.id}>
                    <div className="flex items-center gap-2 rounded-lg border border-gray-100 px-3 py-2 hover:bg-gray-50">
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-1.5 truncate font-medium text-gray-900">
                          {r.savedByVerified && (
                            <BadgeCheck
                              className="size-5 shrink-0 text-[#003366]"
                              aria-label="Verified save"
                              title="Verified Fox employee save"
                            />
                          )}
                          <span className="truncate">
                            {r.name}
                            {active && (
                              <span className="ml-2 text-xs font-normal text-blue-600">(current)</span>
                            )}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500">
                          {r.deviceCount} device{r.deviceCount !== 1 ? 's' : ''} on rack · {r.totalHeight}U ·{' '}
                          {r.rackDepthInches ?? DEFAULT_RACK_DEPTH_INCHES}&quot; deep ·{' '}
                          {r.savedByDisplayName?.trim() ? (
                            <>by {r.savedByDisplayName}</>
                          ) : (
                            <>by Unknown</>
                          )}{' '}
                          · updated {formatDistanceToNow(new Date(r.updatedAt), { addSuffix: true })}
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={openingId !== null}
                        onClick={() => {
                          setOpeningId(r.id);
                          void (async () => {
                            try {
                              await onOpenRack(r.id);
                              onClose();
                            } finally {
                              setOpeningId(null);
                            }
                          })();
                        }}
                        className="shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        {openingId === r.id ? 'Opening…' : 'Open'}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
