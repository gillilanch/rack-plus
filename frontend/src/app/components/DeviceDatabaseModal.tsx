import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  X,
  Search,
  ChevronDown,
  ChevronRight,
  Pencil,
  Trash2,
  Plus,
  Database,
  Users,
} from 'lucide-react';
import type { Device } from '../data/equipment';
import { devices as builtInDevices } from '../data/equipment';
import { listFoxEmployees } from '../api/employees';
import {
  deleteCustomDevice,
  FOX_EQUIPMENT_CHANGED_EVENT,
  getCustomDevices,
  saveCustomDevice,
  updateCustomDevice,
} from '../utils/customDevices';
import {
  addFoxEmployeeExtra,
  FOX_EMPLOYEES_CHANGED_EVENT,
  getFoxEmployeeExtras,
  mergeFoxEmployeeLists,
  removeFoxEmployeeExtra,
} from '../utils/foxEmployeeExtras';
import { AddDeviceModal } from './AddDeviceModal';
import { getDeviceDisplayName, getDeviceSearchBlob } from '../utils/deviceDisplay';

interface DeviceDatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type DbTab = 'equipment' | 'employees';

function matchesSearch(device: Device, q: string): boolean {
  if (!q.trim()) return true;
  const s = q.trim().toLowerCase();
  const ru = device.heightInU != null ? `${device.heightInU}u` : '';
  const rw = device.deviceWidthInches != null ? `${device.deviceWidthInches}` : '';
  return (
    getDeviceSearchBlob(device).includes(s) ||
    device.category.toLowerCase().includes(s) ||
    ru.includes(s) ||
    rw.includes(s) ||
    device.ports.some((p) => p.type.toLowerCase().includes(s))
  );
}

function matchesName(n: string, q: string): boolean {
  if (!q.trim()) return true;
  return n.toLowerCase().includes(q.trim().toLowerCase());
}

export function DeviceDatabaseModal({ isOpen, onClose }: DeviceDatabaseModalProps) {
  const [tab, setTab] = useState<DbTab>('equipment');
  const [search, setSearch] = useState('');
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [custom, setCustom] = useState<Device[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [cloneSource, setCloneSource] = useState<Device | null>(null);

  const [directoryNames, setDirectoryNames] = useState<string[]>([]);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [directoryError, setDirectoryError] = useState<string | null>(null);
  const [extraNames, setExtraNames] = useState<string[]>([]);
  const [newEmployeeName, setNewEmployeeName] = useState('');
  const [newEmployeeError, setNewEmployeeError] = useState<string | null>(null);

  const refreshCustom = useCallback(() => setCustom(getCustomDevices()), []);
  const refreshExtras = useCallback(() => setExtraNames(getFoxEmployeeExtras()), []);

  useEffect(() => {
    if (!isOpen) return;
    refreshCustom();
    setSearch('');
    setEmployeeSearch('');
    setNewEmployeeName('');
    setNewEmployeeError(null);
  }, [isOpen, refreshCustom]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setDirectoryLoading(true);
    setDirectoryError(null);
    void listFoxEmployees()
      .then((names) => {
        if (!cancelled) setDirectoryNames(names);
      })
      .catch(() => {
        if (!cancelled) setDirectoryError('Could not load the Fox directory from this server.');
      })
      .finally(() => {
        if (!cancelled) setDirectoryLoading(false);
      });
    refreshExtras();
    return () => {
      cancelled = true;
    };
  }, [isOpen, refreshExtras]);

  useEffect(() => {
    const fn = () => refreshCustom();
    window.addEventListener(FOX_EQUIPMENT_CHANGED_EVENT, fn);
    return () => window.removeEventListener(FOX_EQUIPMENT_CHANGED_EVENT, fn);
  }, [refreshCustom]);

  useEffect(() => {
    const fn = () => refreshExtras();
    window.addEventListener(FOX_EMPLOYEES_CHANGED_EVENT, fn);
    return () => window.removeEventListener(FOX_EMPLOYEES_CHANGED_EVENT, fn);
  }, [refreshExtras]);

  const filteredCustom = useMemo(
    () => custom.filter((d) => matchesSearch(d, search)),
    [custom, search],
  );

  const filteredDirectory = useMemo(
    () => directoryNames.filter((n) => matchesName(n, employeeSearch)),
    [directoryNames, employeeSearch],
  );

  const filteredExtras = useMemo(
    () => extraNames.filter((n) => matchesName(n, employeeSearch)),
    [extraNames, employeeSearch],
  );

  const employeeUniqueCount = useMemo(
    () => mergeFoxEmployeeLists(directoryNames).length,
    [directoryNames, extraNames],
  );

  const existingNamesForForm = useMemo(() => {
    const fromBuiltIn = builtInDevices.map((d) => getDeviceDisplayName(d));
    const fromCustom = custom.filter((d) => d.id !== editingDevice?.id).map((d) => getDeviceDisplayName(d));
    return [...fromBuiltIn, ...fromCustom];
  }, [custom, editingDevice?.id]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setEditingDevice(null);
    setCloneSource(null);
  };

  const openAdd = () => {
    setEditingDevice(null);
    setCloneSource(null);
    setEditorOpen(true);
  };

  const openEdit = (d: Device) => {
    setCloneSource(null);
    setEditingDevice(d);
    setEditorOpen(true);
  };

  const handleSaveDevice = (device: Device) => {
    if (editingDevice) {
      updateCustomDevice(device);
    } else {
      saveCustomDevice(device);
    }
    refreshCustom();
  };

  const handleDelete = (d: Device) => {
    if (!window.confirm(`Remove “${getDeviceDisplayName(d)}” from your Fox equipment database?`)) return;
    deleteCustomDevice(d.id);
    refreshCustom();
  };

  const handleAddEmployee = () => {
    setNewEmployeeError(null);
    const t = newEmployeeName.trim();
    if (!t) {
      setNewEmployeeError('Enter a name.');
      return;
    }
    if (directoryNames.some((n) => n.toLowerCase() === t.toLowerCase())) {
      setNewEmployeeError('That name is already in the Fox directory on this server.');
      return;
    }
    const r = addFoxEmployeeExtra(t);
    if (!r.ok) {
      setNewEmployeeError(r.reason);
      return;
    }
    setNewEmployeeName('');
    refreshExtras();
  };

  const handleRemoveExtra = (name: string) => {
    if (!window.confirm(`Remove “${name}” from names added on this browser?`)) return;
    removeFoxEmployeeExtra(name);
    refreshExtras();
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        onClick={() => {
          if (!editorOpen) onClose();
        }}
        role="presentation"
      >
        <div
          className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
          role="dialog"
          aria-labelledby="device-db-title"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-5 py-4">
            <div className="flex items-center gap-2">
              <Database className="size-6 text-blue-600" />
              <h2 id="device-db-title" className="text-xl font-bold text-gray-900">
                Device database
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              aria-label="Close"
            >
              <X className="size-6" />
            </button>
          </div>

          <p className="border-b border-gray-100 px-5 py-3 text-sm text-gray-600">
            <span className="font-medium">Fox equipment</span> is stored in this browser and powers manual add
            autocomplete and cable suggestions. <span className="font-medium">Fox employees</span> lists the
            directory from this server plus any names you add locally (also used when saving a rack).
          </p>

          <div className="flex gap-1 border-b border-gray-200 px-5 pt-3">
            <button
              type="button"
              onClick={() => setTab('equipment')}
              className={`rounded-t-lg px-4 py-2 text-sm font-medium transition-colors ${
                tab === 'equipment'
                  ? 'bg-gray-100 text-gray-900'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              Fox equipment ({custom.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('employees')}
              className={`flex items-center gap-1.5 rounded-t-lg px-4 py-2 text-sm font-medium transition-colors ${
                tab === 'employees'
                  ? 'bg-gray-100 text-gray-900'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Users className="size-4" />
              Fox employees ({employeeUniqueCount})
            </button>
          </div>

          {tab === 'equipment' && (
            <div className="shrink-0 border-b border-gray-100 px-5 py-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search Fox equipment by name, category, or connector…"
                  className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {tab === 'employees' && (
            <div className="shrink-0 space-y-3 border-b border-gray-100 px-5 py-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1">
                  <label htmlFor="fox-emp-add" className="mb-1 block text-xs font-semibold uppercase text-gray-500">
                    Add name (this browser)
                  </label>
                  <input
                    id="fox-emp-add"
                    type="text"
                    value={newEmployeeName}
                    onChange={(e) => {
                      setNewEmployeeName(e.target.value);
                      setNewEmployeeError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddEmployee();
                    }}
                    placeholder="e.g. Jamie Fox"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddEmployee}
                  className="flex shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  <Plus className="size-4" />
                  Add name
                </button>
              </div>
              {newEmployeeError && <p className="text-sm text-red-600">{newEmployeeError}</p>}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="search"
                  value={employeeSearch}
                  onChange={(e) => setEmployeeSearch(e.target.value)}
                  placeholder="Search employees…"
                  className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {tab === 'equipment' && (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={openAdd}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-blue-300 bg-blue-50/50 py-3 text-sm font-medium text-blue-800 hover:bg-blue-50"
                >
                  <Plus className="size-4" />
                  Add device to Fox equipment
                </button>

                {filteredCustom.length === 0 && (
                  <p className="py-8 text-center text-sm text-gray-500">
                    {search.trim() ? 'No Fox equipment matches your search.' : 'No Fox equipment saved yet.'}
                  </p>
                )}

                {filteredCustom.map((d) => (
                  <DeviceDbRow
                    key={d.id}
                    device={d}
                    expanded={expandedIds.has(d.id)}
                    onToggle={() => toggleExpand(d.id)}
                    onEdit={() => openEdit(d)}
                    onDelete={() => handleDelete(d)}
                  />
                ))}
              </div>
            )}

            {tab === 'employees' && (
              <div className="space-y-6">
                {directoryLoading && (
                  <p className="text-sm text-gray-500">Loading Fox directory from server…</p>
                )}
                {directoryError && (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    {directoryError} You can still manage names added on this browser.
                  </p>
                )}

                <section>
                  <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">
                    Fox directory 
                  </h3>
                  {!directoryLoading && filteredDirectory.length === 0 && (
                    <p className="text-sm text-gray-500">
                      {employeeSearch.trim() ? 'No directory names match your search.' : 'No names returned from server.'}
                    </p>
                  )}
                  <ul className="space-y-1">
                    {filteredDirectory.map((name) => (
                      <li
                        key={`dir:${name}`}
                        className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 bg-gray-50/80 px-3 py-2 text-sm"
                      >
                        <span className="min-w-0 truncate font-medium text-gray-900">{name}</span>
                        <span className="shrink-0 rounded bg-white px-2 py-0.5 text-[10px] font-semibold uppercase text-gray-600 ring-1 ring-gray-200">
                          Server
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>

                <section>
                 
                  <ul className="space-y-1">
                    {filteredExtras.map((name) => (
                      <li
                        key={`extra:${name}`}
                        className="flex items-center justify-between gap-2 rounded-lg border border-amber-100 bg-amber-50/50 px-3 py-2 text-sm"
                      >
                        <span className="min-w-0 truncate font-medium text-gray-900">{name}</span>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="rounded bg-white px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-900 ring-1 ring-amber-200">
                            Local
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveExtra(name)}
                            className="rounded p-1.5 text-red-600 hover:bg-red-50"
                            title="Remove from this browser"
                            aria-label={`Remove ${name}`}
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
            )}
          </div>
        </div>
      </div>

      <AddDeviceModal
        isOpen={editorOpen}
        onClose={closeEditor}
        onSaveDevice={handleSaveDevice}
        existingDeviceNames={existingNamesForForm}
        editingDevice={editingDevice}
        cloneSource={cloneSource}
      />
    </>
  );
}

function DeviceDbRow({
  device,
  expanded,
  onToggle,
  onEdit,
  onDelete,
}: {
  device: Device;
  expanded: boolean;
  onToggle: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 p-3">
        <button
          type="button"
          onClick={onToggle}
          className="rounded p-1 text-gray-500 hover:bg-gray-100"
          aria-expanded={expanded}
        >
          {expanded ? <ChevronDown className="size-5" /> : <ChevronRight className="size-5" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium text-gray-900">{getDeviceDisplayName(device)}</div>
          <div className="text-xs text-gray-500">
            {device.heightInU != null ? `${device.heightInU}U` : '1U'} ·{' '}
            {device.deviceWidthInches != null ? `${device.deviceWidthInches}"` : '19"'} · {device.category} ·{' '}
            {device.ports.length} port{device.ports.length !== 1 ? 's' : ''}
            <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-amber-800">
              Fox equipment
            </span>
          </div>
        </div>
        <div className="flex shrink-0 gap-1">
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"
              title="Edit"
            >
              <Pencil className="size-4" />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="rounded-lg p-2 text-red-600 hover:bg-red-50"
              title="Remove"
            >
              <Trash2 className="size-4" />
            </button>
          )}
        </div>
      </div>
      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3 text-sm text-gray-700">
          <div className="mb-2 text-xs font-semibold uppercase text-gray-500">Ports</div>
          {device.ports.length === 0 ? (
            <p className="text-gray-500">No ports defined.</p>
          ) : (
            <ul className="space-y-1">
              {device.ports.map((p, i) => (
                <li key={i} className="flex flex-wrap gap-2 text-xs">
                  <span className="font-medium text-gray-900">{p.type}</span>
                  <span className="text-gray-500">({p.direction})</span>
                  {p.label && <span className="text-gray-600">{p.label}</span>}
                  {p.count != null && p.count > 1 && <span className="text-gray-500">×{p.count}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
