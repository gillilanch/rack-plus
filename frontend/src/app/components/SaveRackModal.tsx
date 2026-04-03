import { useEffect, useState } from 'react';
import { X, Loader2 } from 'lucide-react';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  initialName: string;
  hasRackId: boolean;
  onUpdateCurrent: (name: string) => Promise<void>;
  onSaveAsNew: (name: string) => Promise<void>;
};

export function SaveRackModal({
  isOpen,
  onClose,
  initialName,
  hasRackId,
  onUpdateCurrent,
  onSaveAsNew,
}: Props) {
  const [name, setName] = useState(initialName);
  const [busy, setBusy] = useState<'update' | 'new' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName(initialName);
      setError(null);
      setBusy(null);
    }
  }, [isOpen, initialName]);

  if (!isOpen) return null;

  const trimmed = name.trim();
  const canSubmit = trimmed.length > 0 && !busy;

  const run = async (mode: 'update' | 'new') => {
    if (!canSubmit) return;
    setError(null);
    setBusy(mode);
    try {
      if (mode === 'update') await onUpdateCurrent(trimmed);
      else await onSaveAsNew(trimmed);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="no-print fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Save rack</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>
        <label className="mb-2 block text-sm font-medium text-gray-700">Rack name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="e.g. Truck A / Studio 1"
        />
        {error && (
          <p className="mb-3 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          {hasRackId && (
            <button
              type="button"
              disabled={!canSubmit}
              onClick={() => void run('update')}
              className="flex items-center justify-center gap-2 rounded-lg bg-[#003366] px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {busy === 'update' && <Loader2 className="size-4 animate-spin" />}
              Save to this rack
            </button>
          )}
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => void run('new')}
            className="flex items-center justify-center gap-2 rounded-lg bg-[#003366] px-4 py-2 text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {busy === 'new' && <Loader2 className="size-4 animate-spin" />}
            Save as new rack
          </button>
        </div>
        <p className="mt-3 text-xs text-gray-500">
          New racks appear for everyone under <strong>Current racks</strong> (global list).
        </p>
      </div>
    </div>
  );
}
