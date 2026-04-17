import { useVirtualizer } from '@tanstack/react-virtual';
import { useCallback, useEffect, useMemo, useRef, startTransition, useState } from 'react';
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
  Download,
} from 'lucide-react';
import type { Device } from '../data/equipment';
import { devices as builtInDevices } from '../data/equipment';
import {
  addFoxEmployeeExtra,
  fetchEmployeesCatalog,
  removeFoxEmployeeExtra,
} from '../api/employees';
import {
  deleteCustomDevice,
  FOX_EQUIPMENT_CHANGED_EVENT,
  getCustomDevices,
  saveCustomDevice,
  updateCustomDevice,
} from '../utils/customDevices';
import { FOX_EMPLOYEES_CHANGED_EVENT, mergeFoxEmployeeLists } from '../utils/foxEmployeeExtras';
import { AddDeviceModal } from './AddDeviceModal';
import { getDeviceDisplayName, getDeviceSearchBlob } from '../utils/deviceDisplay';
import {
  deleteCatalogDeviceOnServer,
  FOX_SERVER_CATALOG_CHANGED_EVENT,
  getServerCatalogDevices,
  prefetchServerCatalogDevices,
} from '../utils/serverCatalogCache';
import {
  getHiddenBuiltinDeviceIds,
  getHiddenServerCatalogDeviceIds,
  hideBuiltinDeviceId,
  hideServerCatalogDeviceId,
} from '../utils/deviceDatabaseHiddenIds';
import { buildEquipmentDatabaseCsv } from '../utils/rackTemplateCsv';

interface DeviceDatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type DbTab = 'equipment' | 'employees';

type EquipmentSource = 'builtin' | 'server' | 'local';

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
  const [catalogPrefill, setCatalogPrefill] = useState<Device | null>(null);

  const [directoryNames, setDirectoryNames] = useState<string[]>([]);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [directoryError, setDirectoryError] = useState<string | null>(null);
  const [extraNames, setExtraNames] = useState<string[]>([]);
  const [newEmployeeName, setNewEmployeeName] = useState('');
  const [newEmployeeError, setNewEmployeeError] = useState<string | null>(null);

  const [serverCatalog, setServerCatalog] = useState<Device[]>([]);
  const [serverCatalogLoading, setServerCatalogLoading] = useState(false);
  const [serverCatalogError, setServerCatalogError] = useState<string | null>(null);
  /** Bumps when client-side hidden-id sets change so the equipment list re-derives. */
  const [hiddenCatalogRev, setHiddenCatalogRev] = useState(0);

  const refreshCustom = useCallback(() => setCustom(getCustomDevices()), []);

  const loadEmployeeCatalog = useCallback(async () => {
    setDirectoryLoading(true);
    setDirectoryError(null);
    try {
      const c = await fetchEmployeesCatalog();
      setDirectoryNames(c.directory);
      setExtraNames(c.extras);
    } catch {
      setDirectoryError('Could not load employees from this server.');
      setDirectoryNames([]);
      setExtraNames([]);
    } finally {
      setDirectoryLoading(false);
    }
  }, []);

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
    setServerCatalogLoading(true);
    setServerCatalogError(null);
    void prefetchServerCatalogDevices().then((ok) => {
      if (cancelled) return;
      setServerCatalogLoading(false);
      const devices = getServerCatalogDevices();
      setServerCatalog(devices);
      if (!ok) {
        setServerCatalogError(
          devices.length === 0
            ? 'Could not load the AVCAD catalog from this server. If the UI runs on another origin than the API, set VITE_API_BASE_URL to your backend (e.g. http://127.0.0.1:4000).'
            : 'Could not refresh the catalog from the server; showing the last loaded list.',
        );
      } else {
        setServerCatalogError(null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    void loadEmployeeCatalog();
  }, [isOpen, loadEmployeeCatalog]);

  useEffect(() => {
    if (!isOpen) return;
    const fn = () => setServerCatalog(getServerCatalogDevices());
    window.addEventListener(FOX_SERVER_CATALOG_CHANGED_EVENT, fn);
    return () => window.removeEventListener(FOX_SERVER_CATALOG_CHANGED_EVENT, fn);
  }, [isOpen]);

  useEffect(() => {
    const fn = () => refreshCustom();
    window.addEventListener(FOX_EQUIPMENT_CHANGED_EVENT, fn);
    return () => window.removeEventListener(FOX_EQUIPMENT_CHANGED_EVENT, fn);
  }, [refreshCustom]);

  useEffect(() => {
    const fn = () => {
      void loadEmployeeCatalog();
    };
    window.addEventListener(FOX_EMPLOYEES_CHANGED_EVENT, fn);
    return () => window.removeEventListener(FOX_EMPLOYEES_CHANGED_EVENT, fn);
  }, [loadEmployeeCatalog]);

  const replacedCatalogIds = useMemo(
    () =>
      new Set(
        custom
          .map((d) => d.replacesCatalogDeviceId)
          .filter((x): x is string => typeof x === 'string' && x.length > 0),
      ),
    [custom],
  );

  const unifiedEquipment = useMemo(() => {
    const hiddenBuiltin = getHiddenBuiltinDeviceIds();
    const hiddenServer = getHiddenServerCatalogDeviceIds();
    const rows: { key: string; device: Device; source: EquipmentSource }[] = [];
    for (const d of builtInDevices) {
      if (replacedCatalogIds.has(d.id) || hiddenBuiltin.has(d.id)) continue;
      rows.push({ key: `builtin:${d.id}`, device: d, source: 'builtin' });
    }
    for (const d of serverCatalog) {
      if (replacedCatalogIds.has(d.id) || hiddenServer.has(d.id)) continue;
      rows.push({ key: `srv:${d.id}`, device: d, source: 'server' });
    }
    for (const d of custom) {
      rows.push({ key: `local:${d.id}`, device: d, source: 'local' });
    }
    rows.sort((a, b) =>
      getDeviceDisplayName(a.device).localeCompare(getDeviceDisplayName(b.device), undefined, {
        sensitivity: 'base',
      }),
    );
    return rows;
  }, [serverCatalog, custom, replacedCatalogIds, hiddenCatalogRev]);

  const filteredUnified = useMemo(
    () => unifiedEquipment.filter((row) => matchesSearch(row.device, search)),
    [unifiedEquipment, search],
  );

  const employeeRows = useMemo(() => {
    const merged = mergeFoxEmployeeLists(directoryNames, extraNames);
    const dirLc = new Set(directoryNames.map((n) => n.trim().toLowerCase()).filter(Boolean));
    return merged.map((name) => {
      const lc = name.trim().toLowerCase();
      const inExtra = extraNames.some((e) => e.trim().toLowerCase() === lc);
      const canRemove = inExtra && !dirLc.has(lc);
      return { name, canRemove };
    });
  }, [directoryNames, extraNames]);

  const filteredEmployeeRows = useMemo(
    () => employeeRows.filter((r) => matchesName(r.name, employeeSearch)),
    [employeeRows, employeeSearch],
  );

  const employeeUniqueCount = useMemo(
    () => mergeFoxEmployeeLists(directoryNames, extraNames).length,
    [directoryNames, extraNames],
  );

  const existingNamesForForm = useMemo(() => {
    const fromBuiltIn = builtInDevices.map((d) => getDeviceDisplayName(d));
    const fromCustom = custom.filter((d) => d.id !== editingDevice?.id).map((d) => getDeviceDisplayName(d));
    const fromServer = serverCatalog.map((d) => getDeviceDisplayName(d));
    return [...fromBuiltIn, ...fromCustom, ...fromServer];
  }, [custom, editingDevice?.id, serverCatalog]);

  /** Only mount visible rows so closing the edit modal does not block the main thread reconciling the full catalog. */
  const deviceDbScrollRef = useRef<HTMLDivElement>(null);
  const equipmentVirtualizer = useVirtualizer({
    count: tab === 'equipment' ? filteredUnified.length : 0,
    getScrollElement: () => deviceDbScrollRef.current,
    estimateSize: () => 100,
    gap: 12,
    overscan: 10,
    getItemKey: (index) => filteredUnified[index]?.key ?? `eq-${index}`,
  });

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDownloadEquipmentCsv = useCallback(() => {
    const csv = buildEquipmentDatabaseCsv(unifiedEquipment.map((row) => row.device));
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'equipment_database.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [unifiedEquipment]);

  const closeEditor = () => {
    startTransition(() => {
      setEditorOpen(false);
      setEditingDevice(null);
      setCatalogPrefill(null);
    });
  };

  const openAdd = () => {
    setEditingDevice(null);
    setCatalogPrefill(null);
    setEditorOpen(true);
  };

  const openEdit = (d: Device) => {
    setCatalogPrefill(null);
    setEditingDevice(d);
    setEditorOpen(true);
  };

  /** Edit a built-in or server row: saves as a browser device that hides the original catalog entry. */
  const openEditCatalogRow = (d: Device) => {
    setEditingDevice(null);
    setCatalogPrefill(d);
    setEditorOpen(true);
  };

  const handleSaveDevice = (device: Device) => {
    if (editingDevice && !catalogPrefill) {
      updateCustomDevice(device);
    } else {
      saveCustomDevice(device);
    }
    refreshCustom();
  };

  const handleDeleteEquipment = useCallback(
    async (device: Device, source: EquipmentSource) => {
      const label = getDeviceDisplayName(device);
      if (!window.confirm(`Remove “${label}”?`)) return;

      if (source === 'local') {
        deleteCustomDevice(device.id);
        refreshCustom();
        return;
      }

      if (source === 'builtin') {
        hideBuiltinDeviceId(device.id);
        setHiddenCatalogRev((n) => n + 1);
        return;
      }

      if (source === 'server') {
        const result = await deleteCatalogDeviceOnServer(device.id);
        if (result === 'ok') {
          setServerCatalog(getServerCatalogDevices());
          return;
        }
        hideServerCatalogDeviceId(device.id);
        setHiddenCatalogRev((n) => n + 1);
      }
    },
    [refreshCustom],
  );

  const handleAddEmployee = async () => {
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
    const r = await addFoxEmployeeExtra(t);
    if (!r.ok) {
      setNewEmployeeError(r.reason);
      return;
    }
    setNewEmployeeName('');
    await loadEmployeeCatalog();
  };

  const handleRemoveExtra = async (name: string) => {
    if (!window.confirm(`Remove “${name}” from names added on this server?`)) return;
    const ok = await removeFoxEmployeeExtra(name);
    if (ok) await loadEmployeeCatalog();
    else window.alert('Could not remove that name. Try again.');
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
          className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-slate-600/80 bg-slate-900 shadow-2xl ring-1 ring-slate-500/25"
          role="dialog"
          aria-labelledby="device-db-title"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex shrink-0 items-center justify-between border-b border-slate-600/80 px-5 py-4">
            <div className="flex items-center gap-2">
              <Database className="size-6 text-sky-400" />
              <h2 id="device-db-title" className="font-cable-ui text-xl font-bold text-slate-100">
                Edit database
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-700 hover:text-slate-200"
              aria-label="Close"
            >
              <X className="size-6" />
            </button>
          </div>

          <p className="border-b border-slate-600/80 px-5 py-3 text-sm text-slate-400">
            <span className="font-medium text-slate-200">Equipment</span> — search the list, add devices, or open a row to
            view details and edit. <span className="font-medium text-slate-200">Fox employees</span> is the name list used
            when saving racks.
          </p>

          <div className="flex gap-1 border-b border-slate-600/80 px-5 pt-3">
            <button
              type="button"
              onClick={() => setTab('equipment')}
              className={`rounded-t-lg px-4 py-2 text-sm font-medium transition-colors ${
                tab === 'equipment'
                  ? 'bg-slate-800 text-slate-100'
                  : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
              }`}
            >
              Equipment ({unifiedEquipment.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('employees')}
              className={`flex items-center gap-1.5 rounded-t-lg px-4 py-2 text-sm font-medium transition-colors ${
                tab === 'employees'
                  ? 'bg-slate-800 text-slate-100'
                  : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
              }`}
            >
              <Users className="size-4" />
              Fox employees ({employeeUniqueCount})
            </button>
          </div>

          {tab === 'equipment' && (
            <div className="shrink-0 space-y-3 border-b border-slate-600/80 px-5 py-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
                <button
                  type="button"
                  onClick={openAdd}
                  className="flex min-h-[2.75rem] flex-1 items-center justify-center gap-2 rounded-lg border-2 border-dashed border-sky-700/60 bg-sky-950/35 px-3 py-3 text-sm font-medium text-sky-100 transition-colors hover:bg-sky-950/55"
                >
                  <Plus className="size-4 shrink-0" />
                  Add device to your equipment
                </button>
                <button
                  type="button"
                  onClick={handleDownloadEquipmentCsv}
                  disabled={unifiedEquipment.length === 0}
                  className="flex min-h-[2.75rem] shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-600 bg-slate-800/90 px-4 py-3 text-sm font-medium text-slate-100 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 sm:min-w-[11rem]"
                  title={
                    unifiedEquipment.length === 0
                      ? 'No devices to export'
                      : 'Download all equipment as CSV (same columns as rack template)'
                  }
                >
                  <Download className="size-4 shrink-0" />
                  Download CSV
                </button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, category, or connector…"
                  className="w-full rounded-lg border border-slate-600 bg-slate-800/80 py-2 pl-10 pr-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>
          )}

          {tab === 'employees' && (
            <div className="shrink-0 space-y-3 border-b border-slate-600/80 px-5 py-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1">
                  <label
                    htmlFor="fox-emp-add"
                    className="mb-1 block text-xs font-semibold uppercase text-slate-500"
                  >
                    Add name
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
                    className="w-full rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddEmployee}
                  className="flex shrink-0 items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500"
                >
                  <Plus className="size-4" />
                  Add name
                </button>
              </div>
              {newEmployeeError && <p className="text-sm text-red-400">{newEmployeeError}</p>}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                <input
                  type="search"
                  value={employeeSearch}
                  onChange={(e) => setEmployeeSearch(e.target.value)}
                  placeholder="Search employees…"
                  className="w-full rounded-lg border border-slate-600 bg-slate-800/80 py-2 pl-10 pr-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>
          )}

          <div
            ref={deviceDbScrollRef}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 [scrollbar-gutter:stable]"
          >
            {tab === 'equipment' && (
              <div className="space-y-3">
                {serverCatalogLoading && (
                  <p className="text-sm text-slate-400">Loading…</p>
                )}
                {serverCatalogError && (
                  <p className="mb-2 rounded-lg border border-amber-800/60 bg-amber-950/40 px-3 py-2 text-sm text-amber-100">
                    {serverCatalogError}
                  </p>
                )}
                {!serverCatalogLoading && !serverCatalogError && serverCatalog.length === 0 && (
                  <p className="text-sm text-slate-400">
                    No catalog entries yet. Sync the equipment list from the admin tools or your sheet workflow, then
                    open this dialog again.
                  </p>
                )}
                {!serverCatalogLoading && unifiedEquipment.length > 0 && filteredUnified.length === 0 && (
                  <p className="text-sm text-slate-400">No rows match your search.</p>
                )}
                {!serverCatalogLoading && unifiedEquipment.length === 0 && (
                  <p className="text-sm text-slate-400">
                    No equipment loaded yet. Add a device above or sync the catalog.
                  </p>
                )}
                {filteredUnified.length > 0 && (
                  <ul
                    className="relative w-full list-none p-0"
                    style={{ height: `${equipmentVirtualizer.getTotalSize()}px` }}
                  >
                    {equipmentVirtualizer.getVirtualItems().map((virtualRow) => {
                      const { key, device, source } = filteredUnified[virtualRow.index]!;
                      return (
                        <li
                          key={virtualRow.key}
                          data-index={virtualRow.index}
                          ref={equipmentVirtualizer.measureElement}
                          className="absolute left-0 top-0 w-full list-none"
                          style={{
                            transform: `translateY(${virtualRow.start}px)`,
                          }}
                        >
                          <DeviceDbRow
                            rowKey={key}
                            device={device}
                            expanded={expandedIds.has(key)}
                            onToggle={() => toggleExpand(key)}
                            onEdit={
                              source === 'local'
                                ? () => openEdit(device)
                                : () => openEditCatalogRow(device)
                            }
                            onDelete={() => void handleDeleteEquipment(device, source)}
                          />
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}

            {tab === 'employees' && (
              <div className="space-y-4">
                {directoryLoading && <p className="text-sm text-slate-400">Loading…</p>}
                {directoryError && (
                  <p className="rounded-lg border border-amber-800/60 bg-amber-950/40 px-3 py-2 text-sm text-amber-100">
                    {directoryError}
                  </p>
                )}

                {!directoryLoading && filteredEmployeeRows.length === 0 && (
                  <p className="text-sm text-slate-400">
                    {employeeSearch.trim()
                      ? 'No names match your search.'
                      : 'No names yet. Use the form above to add someone.'}
                  </p>
                )}
                <ul className="space-y-1">
                  {filteredEmployeeRows.map(({ name, canRemove }) => (
                    <li
                      key={name}
                      className="flex items-center justify-between gap-2 rounded-lg border border-slate-600/70 bg-slate-800/50 px-3 py-2 text-sm"
                    >
                      <span className="min-w-0 truncate font-medium text-slate-100">{name}</span>
                      {canRemove ? (
                        <button
                          type="button"
                          onClick={() => void handleRemoveExtra(name)}
                          className="shrink-0 rounded p-1.5 text-red-400 transition-colors hover:bg-red-950/50"
                          title="Remove name"
                          aria-label={`Remove ${name}`}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      ) : (
                        <span className="w-8 shrink-0" aria-hidden />
                      )}
                    </li>
                  ))}
                </ul>
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
        catalogPrefill={catalogPrefill}
        surface="dark"
      />
    </>
  );
}

function DeviceDbRow({
  rowKey,
  device,
  expanded,
  onToggle,
  onEdit,
  onDelete,
}: {
  rowKey: string;
  device: Device;
  expanded: boolean;
  onToggle: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className="list-none">
      <div className="rounded-lg border border-slate-600/70 bg-slate-800/60 shadow-sm">
        <div className="flex items-center gap-2 p-3">
          <button
            type="button"
            onClick={onToggle}
            className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-700 hover:text-slate-200"
            aria-expanded={expanded}
            aria-controls={`device-db-detail-${rowKey}`}
          >
            {expanded ? <ChevronDown className="size-5" /> : <ChevronRight className="size-5" />}
          </button>
          <div className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => onEdit?.()}
              className="w-full truncate text-left font-medium text-slate-100 hover:text-sky-200 hover:underline"
            >
              {getDeviceDisplayName(device)}
            </button>
            <div className="text-xs text-slate-400">
              {device.heightInU != null ? `${device.heightInU}U` : '1U'} ·{' '}
              {device.deviceWidthInches != null ? `${device.deviceWidthInches}"` : '19"'} · {device.category} ·{' '}
              {device.ports.length} port{device.ports.length !== 1 ? 's' : ''}
            </div>
          </div>
          <div className="flex shrink-0 gap-1">
            {onEdit && (
              <button
                type="button"
                onClick={onEdit}
                className="rounded-lg p-2 text-slate-300 transition-colors hover:bg-slate-700"
                title="Edit"
              >
                <Pencil className="size-4" />
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="rounded-lg p-2 text-red-400 transition-colors hover:bg-red-950/50"
                title="Remove"
              >
                <Trash2 className="size-4" />
              </button>
            )}
          </div>
        </div>
        {expanded && (
          <div
            id={`device-db-detail-${rowKey}`}
            className="space-y-3 border-t border-slate-600/70 px-4 py-3 text-sm text-slate-300"
          >
            <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
              <div className="sm:col-span-2">
                <dt className="font-semibold uppercase text-slate-500">Device id</dt>
                <dd className="font-mono text-slate-200">{device.id}</dd>
              </div>
              {(device.manufacturer?.trim() || device.model?.trim()) && (
                <>
                  <div>
                    <dt className="font-semibold uppercase text-slate-500">Manufacturer</dt>
                    <dd>{device.manufacturer?.trim() || '—'}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold uppercase text-slate-500">Model</dt>
                    <dd>{device.model?.trim() || '—'}</dd>
                  </div>
                </>
              )}
              {device.name?.trim() && (
                <div className="sm:col-span-2">
                  <dt className="font-semibold uppercase text-slate-500">Legacy / display name</dt>
                  <dd>{device.name}</dd>
                </div>
              )}
              <div>
                <dt className="font-semibold uppercase text-slate-500">Category</dt>
                <dd>{device.category}</dd>
              </div>
              <div>
                <dt className="font-semibold uppercase text-slate-500">Rack height (U)</dt>
                <dd>{device.heightInU ?? '—'}</dd>
              </div>
              <div>
                <dt className="font-semibold uppercase text-slate-500">Rack width (in)</dt>
                <dd>{device.deviceWidthInches != null ? device.deviceWidthInches : '—'}</dd>
              </div>
              <div>
                <dt className="font-semibold uppercase text-slate-500">Depth (in)</dt>
                <dd>
                  {device.deviceDepthInches != null && Number.isFinite(device.deviceDepthInches)
                    ? device.deviceDepthInches
                    : '—'}
                </dd>
              </div>
              <div>
                <dt className="font-semibold uppercase text-slate-500">Face height (in)</dt>
                <dd>
                  {device.physicalHeightInches != null && Number.isFinite(device.physicalHeightInches)
                    ? device.physicalHeightInches
                    : '—'}
                </dd>
              </div>
              {device.sheetPower?.trim() && (
                <div className="sm:col-span-2">
                  <dt className="font-semibold uppercase text-slate-500">Power / PSU</dt>
                  <dd>{device.sheetPower}</dd>
                </div>
              )}
              {device.notes?.trim() && (
                <div className="sm:col-span-2">
                  <dt className="font-semibold uppercase text-slate-500">Notes</dt>
                  <dd className="whitespace-pre-wrap">{device.notes}</dd>
                </div>
              )}
            </dl>
            <div>
              <div className="mb-2 text-xs font-semibold uppercase text-slate-500">Ports</div>
              {device.ports.length === 0 ? (
                <p className="text-slate-500">No ports defined.</p>
              ) : (
                <ul className="space-y-1">
                  {device.ports.map((p, i) => (
                    <li key={i} className="flex flex-wrap gap-2 text-xs">
                      <span className="font-medium text-slate-100">{p.type}</span>
                      <span className="text-slate-500">({p.direction})</span>
                      {p.label && <span className="text-slate-400">{p.label}</span>}
                      {p.count != null && p.count > 1 && <span className="text-slate-500">×{p.count}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
