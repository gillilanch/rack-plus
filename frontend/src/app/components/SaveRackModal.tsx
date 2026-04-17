import { useEffect, useMemo, useState } from 'react';
import { X, Loader2, CheckCircle2 } from 'lucide-react';
import { listFoxEmployeesMerged } from '../api/employees';
import type { RackSaveAttribution } from '../api/racks';
import { FOX_EMPLOYEES_CHANGED_EVENT } from '../utils/foxEmployeeExtras';

export type SaveRackMode = 'current' | 'new' | 'create';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  initialRackName: string;
  /** True when this rack already exists on the server (not a local-only draft). */
  hasPersistedRack: boolean;
  onSave: (mode: SaveRackMode, rackName: string, attribution: RackSaveAttribution) => Promise<void>;
};

export function SaveRackModal({
  isOpen,
  onClose,
  initialRackName,
  hasPersistedRack,
  onSave,
}: Props) {
  const [rackName, setRackName] = useState(initialRackName);
  const [savedBy, setSavedBy] = useState('');
  const [employees, setEmployees] = useState<string[]>([]);
  const [employeesError, setEmployeesError] = useState<string | null>(null);
  const [busy, setBusy] = useState<SaveRackMode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guestConfirmOpen, setGuestConfirmOpen] = useState(false);
  const [pendingMode, setPendingMode] = useState<SaveRackMode | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setRackName(initialRackName);
    setSavedBy('');
    setError(null);
    setBusy(null);
    setGuestConfirmOpen(false);
    setPendingMode(null);
    setEmployeesError(null);
    let cancelled = false;
    void listFoxEmployeesMerged()
      .then((names) => {
        if (!cancelled) setEmployees(names);
      })
      .catch(() => {
        if (!cancelled) setEmployeesError('Could not load employee list; you can still type a name.');
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, initialRackName]);

  useEffect(() => {
    if (!isOpen) return;
    const reload = () => {
      void listFoxEmployeesMerged()
        .then((names) => setEmployees(names))
        .catch(() => setEmployeesError('Could not load employee list; you can still type a name.'));
    };
    window.addEventListener(FOX_EMPLOYEES_CHANGED_EVENT, reload);
    return () => window.removeEventListener(FOX_EMPLOYEES_CHANGED_EVENT, reload);
  }, [isOpen]);

  const filteredEmployees = useMemo(() => {
    const q = savedBy.trim().toLowerCase();
    if (!q) return employees.slice(0, 12);
    return employees.filter((n) => n.toLowerCase().includes(q)).slice(0, 12);
  }, [employees, savedBy]);

  if (!isOpen) return null;

  const trimmedRack = rackName.trim();
  const canName = trimmedRack.length > 0 && !busy;

  const runSave = async (mode: SaveRackMode, attribution: RackSaveAttribution) => {
    setError(null);
    setBusy(mode);
    try {
      await onSave(mode, trimmedRack, attribution);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(null);
      setGuestConfirmOpen(false);
      setPendingMode(null);
    }
  };

  const startSave = (mode: SaveRackMode) => {
    if (!canName) return;
    const by = savedBy.trim();
    if (!by) {
      setPendingMode(mode);
      setGuestConfirmOpen(true);
      return;
    }
    void runSave(mode, { saveAsGuest: false, savedByNameRaw: by });
  };

  const confirmGuestSave = () => {
    if (!pendingMode || !canName) return;
    void runSave(pendingMode, { saveAsGuest: true, savedByNameRaw: '' });
  };

  return (
    <>
      <div className="no-print fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
        <div className="w-full max-w-md rounded-xl border border-slate-600 bg-slate-900 p-6 shadow-2xl ring-1 ring-slate-500/25">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-100">Save rack</h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              aria-label="Close"
            >
              <X className="size-5" />
            </button>
          </div>

          <label className="mb-2 block text-sm font-medium text-slate-300">Rack name</label>
          <input
            type="text"
            value={rackName}
            onChange={(e) => setRackName(e.target.value)}
            className="mb-4 w-full rounded-lg border border-slate-600 bg-slate-950/80 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
            placeholder="e.g. Truck A / Studio 1"
          />

          <label className="mb-2 block text-sm font-medium text-slate-300">
            Saved by (Fox employee)
          </label>
          <p className="mb-1 text-xs text-slate-500">
            Start typing to match the engineering directory. Leave empty only if you intend to save as{' '}
            <strong className="text-slate-300">Guest</strong> (uncertified).
          </p>
          <input
            type="text"
            value={savedBy}
            onChange={(e) => setSavedBy(e.target.value)}
            list="fox-employee-options"
            className="mb-1 w-full rounded-lg border border-slate-600 bg-slate-950/80 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
            placeholder="Employee name…"
            autoComplete="off"
          />
          <datalist id="fox-employee-options">
            {employees.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
          {employeesError && <p className="mb-2 text-xs text-amber-400">{employeesError}</p>}
          {filteredEmployees.length > 0 && savedBy.trim() && (
            <ul className="mb-4 max-h-28 overflow-y-auto rounded-md border border-slate-600 bg-slate-800/80 text-sm text-slate-200">
              {filteredEmployees.map((n) => (
                <li key={n}>
                  <button
                    type="button"
                    className="w-full px-3 py-1.5 text-left hover:bg-slate-700"
                    onClick={() => setSavedBy(n)}
                  >
                    {n}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {error && (
            <p className="mb-3 text-sm text-red-400" role="alert">
              {error}
            </p>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-500 px-4 py-2 text-slate-200 hover:bg-slate-800"
            >
              Cancel
            </button>
            {hasPersistedRack && (
              <button
                type="button"
                disabled={!canName}
                onClick={() => startSave('current')}
                className="flex items-center justify-center gap-2 rounded-lg bg-[#003366] px-4 py-2 text-white hover:bg-[#004080] disabled:opacity-50"
              >
                {busy === 'current' && <Loader2 className="size-4 animate-spin" />}
                Save to this rack
              </button>
            )}
            {hasPersistedRack && (
              <button
                type="button"
                disabled={!canName}
                onClick={() => startSave('new')}
                className="flex items-center justify-center gap-2 rounded-lg border border-sky-500/60 bg-slate-800 px-4 py-2 text-sky-200 hover:bg-slate-700 disabled:opacity-50"
              >
                {busy === 'new' && <Loader2 className="size-4 animate-spin" />}
                Save as new rack
              </button>
            )}
            {!hasPersistedRack && (
              <button
                type="button"
                disabled={!canName}
                onClick={() => startSave('create')}
                className="flex items-center justify-center gap-2 rounded-lg bg-[#003366] px-4 py-2 text-white hover:bg-[#004080] disabled:opacity-50"
              >
                {busy === 'create' && <Loader2 className="size-4 animate-spin" />}
                Save rack
              </button>
            )}
          </div>
          <p className="mt-3 flex items-start gap-2 text-xs text-slate-500">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-sky-400" aria-hidden />
            <span>
              Verified saves (name matches the directory) show a blue checkmark on rack lists. Guest saves
              are uncertified.
            </span>
          </p>
        </div>
      </div>

      {guestConfirmOpen && (
        <div className="no-print fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-xl border border-slate-600 bg-slate-900 p-6 shadow-2xl ring-1 ring-slate-500/25">
            <h3 className="text-lg font-semibold text-slate-100">Save under Guest?</h3>
            <p className="mt-2 text-sm text-slate-400">
              You did not select a Fox employee. This save will be recorded as an{' '}
              <strong className="text-slate-200">uncertified guest</strong> and will not show a verified checkmark.
            </p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="rounded-lg border border-slate-500 px-4 py-2 text-slate-200 hover:bg-slate-800"
                onClick={() => {
                  setGuestConfirmOpen(false);
                  setPendingMode(null);
                }}
              >
                No
              </button>
              <button
                type="button"
                className="rounded-lg bg-[#003366] px-4 py-2 text-white hover:bg-[#004080]"
                onClick={() => void confirmGuestSave()}
              >
                Yes, save as Guest
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
