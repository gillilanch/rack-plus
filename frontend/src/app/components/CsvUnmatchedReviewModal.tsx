import { X, Database, Package, Ban } from 'lucide-react';

export type CsvUnmatchedQueueItem = {
  id: string;
  name: string;
  heightInU: number;
  category: string;
  physicalHeightInches?: number;
  manufacturer?: string;
  model?: string;
  deviceWidthInches?: number;
  deviceDepthInches?: number;
  sheetPower?: string;
  /** Import row had a column header containing this substring (case-insensitive). */
  sheetHadHeightColumn?: boolean;
  sheetHadDepthColumn?: boolean;
  sheetHadWidthColumn?: boolean;
};

type Props = {
  isOpen: boolean;
  items: CsvUnmatchedQueueItem[];
  onClose: () => void;
  onReject: (id: string) => void;
  onAddToRackOnly: (id: string) => void;
  onAddToDatabase: (id: string) => void;
};

export function CsvUnmatchedReviewModal({
  isOpen,
  items,
  onClose,
  onReject,
  onAddToRackOnly,
  onAddToDatabase,
}: Props) {
  if (!isOpen || items.length === 0) return null;

  return (
    <div
      className="no-print fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-labelledby="csv-unmatched-title"
      aria-modal="true"
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-600/80 bg-slate-900 shadow-2xl ring-1 ring-slate-500/30">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-600/80 px-5 py-4">
          <div>
            <h2 id="csv-unmatched-title" className="font-cable-ui text-lg font-bold text-slate-100">
              Names not in device database
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              These values from your CSV did not match the built-in or Fox equipment list. Choose what to do for each.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-700 hover:text-slate-200"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <ul className="space-y-4">
            {items.map((item) => (
              <li
                key={item.id}
                className="rounded-lg border border-slate-600/70 bg-slate-800/70 p-4 shadow-sm"
              >
                <div className="mb-3 font-medium text-slate-100">{item.name}</div>
                <div className="mb-3 text-xs text-slate-400">
                  {item.heightInU}U · {item.category}
                  {item.physicalHeightInches != null && ` · ${item.physicalHeightInches}"`}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onAddToDatabase(item.id)}
                    className="flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-2 text-xs font-medium text-white hover:bg-sky-500"
                  >
                    <Database className="size-3.5" />
                    Add &amp; save to database
                  </button>
                  <button
                    type="button"
                    onClick={() => onAddToRackOnly(item.id)}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-500/80 bg-slate-800/80 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700/90"
                  >
                    <Package className="size-3.5" />
                    Add to rack only
                  </button>
                  <button
                    type="button"
                    onClick={() => onReject(item.id)}
                    className="flex items-center gap-1.5 rounded-lg border border-red-800/60 bg-red-950/50 px-3 py-2 text-xs font-medium text-red-200 hover:bg-red-950/80"
                  >
                    <Ban className="size-3.5" />
                    Reject
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="shrink-0 border-t border-slate-600/80 px-5 py-3 text-center text-xs text-slate-500">
          Close this panel when you are done — remaining rows will stay here until you act on them.
        </div>
      </div>
    </div>
  );
}
