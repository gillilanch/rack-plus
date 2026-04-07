import { useCallback, useEffect, useMemo, useState } from 'react';
import { X, Search, ChevronDown, ChevronRight, Copy, Pencil, Trash2, Plus, Database } from 'lucide-react';
import type { Device } from '../data/equipment';
import { devices as builtInDevices } from '../data/equipment';
import {
  deleteCustomDevice,
  FOX_EQUIPMENT_CHANGED_EVENT,
  getCustomDevices,
  saveCustomDevice,
  updateCustomDevice,
} from '../utils/customDevices';
import { AddDeviceModal } from './AddDeviceModal';


interface DeviceDatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function matchesSearch(device: Device, q: string): boolean {
  if (!q.trim()) return true;
  const s = q.trim().toLowerCase();
  return (
    device.name.toLowerCase().includes(s) ||
    device.category.toLowerCase().includes(s) ||
    device.ports.some((p) => p.type.toLowerCase().includes(s))
  );
}

export function DeviceDatabaseModal({ isOpen, onClose }: DeviceDatabaseModalProps) {
  const [tab, setTab] = useState<'catalog' | 'fox'>('fox');
  const [search, setSearch] = useState('');
  const [custom, setCustom] = useState<Device[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [cloneSource, setCloneSource] = useState<Device | null>(null);

  const refreshCustom = useCallback(() => setCustom(getCustomDevices()), []);

  useEffect(() => {
    if (!isOpen) return;
    refreshCustom();
    setSearch('');
  }, [isOpen, refreshCustom]);

  useEffect(() => {
    const fn = () => refreshCustom();
    window.addEventListener(FOX_EQUIPMENT_CHANGED_EVENT, fn);
    return () => window.removeEventListener(FOX_EQUIPMENT_CHANGED_EVENT, fn);
  }, [refreshCustom]);

  const filteredBuiltIn = useMemo(
    () => builtInDevices.filter((d) => matchesSearch(d, search)),
    [search],
  );
  const filteredCustom = useMemo(
    () => custom.filter((d) => matchesSearch(d, search)),
    [custom, search],
  );

  const existingNamesForForm = useMemo(() => {
    const fromBuiltIn = builtInDevices.map((d) => d.name);
    const fromCustom = custom.filter((d) => d.id !== editingDevice?.id).map((d) => d.name);
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

  const openClone = (d: Device) => {
    setEditingDevice(null);
    setCloneSource(d);
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
    if (!window.confirm(`Remove “${d.name}” from your Fox equipment database?`)) return;
    deleteCustomDevice(d.id);
    refreshCustom();
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
            Built-in catalog is read-only. Your <span className="font-medium">Fox equipment database</span> is stored in
            this browser and is used for manual add autocomplete and cable suggestions.
          </p>

          <div className="flex gap-1 border-b border-gray-200 px-5 pt-3">
            <button
              type="button"
              onClick={() => setTab('fox')}
              className={`rounded-t-lg px-4 py-2 text-sm font-medium transition-colors ${
                tab === 'fox'
                  ? 'bg-gray-100 text-gray-900'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              Fox equipment ({custom.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('catalog')}
              className={`rounded-t-lg px-4 py-2 text-sm font-medium transition-colors ${
                tab === 'catalog'
                  ? 'bg-gray-100 text-gray-900'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              Built-in catalog ({builtInDevices.length})
            </button>
          </div>

          <div className="shrink-0 border-b border-gray-100 px-5 py-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, category, or connector…"
                className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {tab === 'fox' && (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={openAdd}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-blue-300 bg-blue-50/50 py-3 text-sm font-medium text-blue-800 hover:bg-blue-50"
                >
                  <Plus className="size-4" />
                  Add device to Fox database
                </button>

                {filteredCustom.length === 0 && (
                  <p className="py-8 text-center text-sm text-gray-500">
                    {search.trim() ? 'No saved devices match your search.' : 'No custom devices yet.'}
                  </p>
                )}

                {filteredCustom.map((d) => (
                  <DeviceDbRow
                    key={d.id}
                    device={d}
                    variant="fox"
                    expanded={expandedIds.has(d.id)}
                    onToggle={() => toggleExpand(d.id)}
                    onEdit={() => openEdit(d)}
                    onDelete={() => handleDelete(d)}
                  />
                ))}
              </div>
            )}

            {tab === 'catalog' && (
              <div className="space-y-3">
                {filteredBuiltIn.length === 0 && (
                  <p className="py-8 text-center text-sm text-gray-500">No devices match your search.</p>
                )}
                {filteredBuiltIn.map((d) => (
                  <DeviceDbRow
                    key={d.id}
                    device={d}
                    variant="catalog"
                    expanded={expandedIds.has(d.id)}
                    onToggle={() => toggleExpand(d.id)}
                    onCopy={() => openClone(d)}
                  />
                ))}
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
  variant,
  expanded,
  onToggle,
  onEdit,
  onDelete,
  onCopy,
}: {
  device: Device;
  variant: 'catalog' | 'fox';
  expanded: boolean;
  onToggle: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onCopy?: () => void;
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
          <div className="truncate font-medium text-gray-900">{device.name}</div>
          <div className="text-xs text-gray-500">
            {device.category} · {device.ports.length} port{device.ports.length !== 1 ? 's' : ''}
            {variant === 'catalog' && (
              <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-gray-600">
                Built-in
              </span>
            )}
            {variant === 'fox' && (
              <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-amber-800">
                Fox
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 gap-1">
          {variant === 'catalog' && onCopy && (
            <button
              type="button"
              onClick={onCopy}
              className="flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
              title="Copy to Fox database"
            >
              <Copy className="size-3.5" />
              Copy
            </button>
          )}
          {variant === 'fox' && onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"
              title="Edit"
            >
              <Pencil className="size-4" />
            </button>
          )}
          {variant === 'fox' && onDelete && (
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
