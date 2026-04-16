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
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-5 py-4">
          <div>
            <h2 id="csv-unmatched-title" className="text-lg font-bold text-gray-900">
              Names not in device database
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              These values from your CSV did not match the built-in or Fox equipment list. Choose what to do for each.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
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
                className="rounded-lg border border-gray-200 bg-gray-50 p-4 shadow-sm"
              >
                <div className="mb-3 font-medium text-gray-900">{item.name}</div>
                <div className="mb-3 text-xs text-gray-500">
                  {item.heightInU}U · {item.category}
                  {item.physicalHeightInches != null && ` · ${item.physicalHeightInches}"`}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onAddToDatabase(item.id)}
                    className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700"
                  >
                    <Database className="size-3.5" />
                    Add &amp; save to database
                  </button>
                  <button
                    type="button"
                    onClick={() => onAddToRackOnly(item.id)}
                    className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-800 hover:bg-gray-50"
                  >
                    <Package className="size-3.5" />
                    Add to rack only
                  </button>
                  <button
                    type="button"
                    onClick={() => onReject(item.id)}
                    className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-800 hover:bg-red-100"
                  >
                    <Ban className="size-3.5" />
                    Reject
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="shrink-0 border-t border-gray-100 px-5 py-3 text-center text-xs text-gray-500">
          Close this panel when you are done — remaining rows will stay here until you act on them.
        </div>
      </div>
    </div>
  );
}
