import { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { RackDevice } from '../types/rack';
import { getDeviceDisplayName } from '../utils/deviceDisplay';
import { Port, ConnectorType } from '../data/equipment';
import { DEFAULT_INCHES_PER_RU, inchesFromRU, ruFromInches } from '../utils/rackUnits';

interface RackDeviceEditorProps {
  device: RackDevice | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (device: RackDevice) => void;
  /** Inches per 1U from rack settings (default 1.75"). */
  inchesPerRU?: number;
}

const connectorTypes: ConnectorType[] = [
  'HDMI', 'SDI', 'XLR', 'USB-C', 'USB-A', 'Thunderbolt',
  '3.5mm', '1/4 TRS', 'RCA', 'DisplayPort', 'Mini DisplayPort',
  'DVI', 'VGA', 'Ethernet', 'BNC', 'TS',
];

/** Matches ManualDeviceAdd; rack rows often store these display labels (not only Device['category']). */
const RACK_CATEGORY_OPTIONS = [
  'Camera',
  'Interface',
  'Monitor',
  'Audio',
  'Laptop',
  'Recording',
  'Network',
  'Power',
  'Other',
] as const;

function normalizeCategoryForEditor(category: string): string {
  if (category === 'Recording Deck') return 'Recording';
  return category;
}

function categorySelectOptions(current: string): string[] {
  const display = normalizeCategoryForEditor(current);
  const base = [...RACK_CATEGORY_OPTIONS];
  if (!base.includes(display as (typeof RACK_CATEGORY_OPTIONS)[number])) {
    return [display, ...base];
  }
  return base;
}

export function RackDeviceEditor({
  device,
  isOpen,
  onClose,
  onSave,
  inchesPerRU: inchesPerRUProp,
}: RackDeviceEditorProps) {
  const inchesPerRU =
    inchesPerRUProp != null && Number.isFinite(inchesPerRUProp) && inchesPerRUProp > 0
      ? inchesPerRUProp
      : DEFAULT_INCHES_PER_RU;
  const [editedDevice, setEditedDevice] = useState<RackDevice | null>(null);

  useEffect(() => {
    if (device) {
      const d = { ...device };
      if (d.category === 'Recording Deck') {
        (d as RackDevice).category = 'Recording' as RackDevice['category'];
      }
      setEditedDevice(d);
    }
  }, [device]);

  if (!isOpen || !editedDevice) return null;

  const handleAddPort = () => {
    setEditedDevice({
      ...editedDevice,
      ports: [...editedDevice.ports, { type: 'HDMI', direction: 'output', label: '' }],
    });
  };

  const handleRemovePort = (index: number) => {
    setEditedDevice({
      ...editedDevice,
      ports: editedDevice.ports.filter((_, i) => i !== index),
    });
  };

  const handlePortChange = (index: number, field: keyof Port, value: any) => {
    const newPorts = [...editedDevice.ports];
    newPorts[index] = { ...newPorts[index], [field]: value };
    setEditedDevice({ ...editedDevice, ports: newPorts });
  };

  const handleSave = () => {
    const m = (editedDevice.manufacturer ?? '').trim();
    const md = (editedDevice.model ?? '').trim();
    const name = getDeviceDisplayName({
      name: editedDevice.name,
      manufacturer: m,
      model: md,
    });
    onSave({ ...editedDevice, manufacturer: m, model: md, name });
    onClose();
  };

  return (
    <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Configure Device I/O</h2>
            <p className="text-sm text-gray-600 mt-1">{getDeviceDisplayName(editedDevice)}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="size-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Category & rack height (applies to unassigned and placed devices) */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h3 className="mb-3 text-sm font-medium text-gray-800">Manufacturer & model</h3>
            <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="rack-edit-mfr" className="mb-1 block text-xs font-medium text-gray-600">
                  Manufacturer
                </label>
                <input
                  id="rack-edit-mfr"
                  type="text"
                  value={editedDevice.manufacturer ?? ''}
                  onChange={(e) =>
                    setEditedDevice({ ...editedDevice, manufacturer: e.target.value })
                  }
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor="rack-edit-model" className="mb-1 block text-xs font-medium text-gray-600">
                  Model / model number
                </label>
                <input
                  id="rack-edit-model"
                  type="text"
                  value={editedDevice.model ?? ''}
                  onChange={(e) => setEditedDevice({ ...editedDevice, model: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <h3 className="mb-3 text-sm font-medium text-gray-800">Category & height</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="rack-edit-category" className="mb-1 block text-xs font-medium text-gray-600">
                  Category
                </label>
                <select
                  id="rack-edit-category"
                  value={normalizeCategoryForEditor(editedDevice.category)}
                  onChange={(e) =>
                    setEditedDevice({
                      ...editedDevice,
                      category: e.target.value as RackDevice['category'],
                    })
                  }
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {categorySelectOptions(editedDevice.category).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="rack-edit-u" className="mb-1 block text-xs font-medium text-gray-600">
                  Rack height (U)
                </label>
                <input
                  id="rack-edit-u"
                  type="number"
                  min={1}
                  max={100}
                  value={editedDevice.heightInU}
                  onChange={(e) => {
                    const u = Math.max(1, Math.min(100, parseInt(e.target.value, 10) || 1));
                    setEditedDevice({
                      ...editedDevice,
                      heightInU: u,
                      physicalHeightInches: inchesFromRU(u, inchesPerRU),
                    });
                  }}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  1U = {inchesPerRU}&quot; (rack settings)
                </p>
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="rack-edit-in" className="mb-1 block text-xs font-medium text-gray-600">
                  Physical height (inches)
                </label>
                <input
                  id="rack-edit-in"
                  type="number"
                  min={0}
                  step={0.1}
                  value={editedDevice.physicalHeightInches ?? ''}
                  onChange={(e) => {
                    const raw = e.target.value.trim();
                    if (raw === '') {
                      setEditedDevice({ ...editedDevice, physicalHeightInches: undefined });
                      return;
                    }
                    const n = parseFloat(raw);
                    if (!Number.isNaN(n) && n > 0) {
                      setEditedDevice({
                        ...editedDevice,
                        physicalHeightInches: n,
                        heightInU: ruFromInches(n, inchesPerRU),
                      });
                    }
                  }}
                  placeholder="Fills rack U from your inches-per-U setting"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Edit U or inches — the other updates from {inchesPerRU}&quot;/U.
                </p>
              </div>
            </div>
          </div>

          {/* Ports Configuration */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700">
                Input/Output Ports ({editedDevice.ports.length})
              </label>
              <button
                onClick={handleAddPort}
                className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
              >
                <Plus className="size-4" />
                Add Port
              </button>
            </div>

            {editedDevice.ports.length === 0 ? (
              <div className="p-8 text-center text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
                No ports configured. Click "Add Port" to define inputs and outputs.
              </div>
            ) : (
              <div className="space-y-3">
                {editedDevice.ports.map((port, index) => (
                  <div
                    key={index}
                    className="flex gap-2 items-start p-3 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {/* Port Type */}
                      <select
                        value={port.type}
                        onChange={(e) => handlePortChange(index, 'type', e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {connectorTypes.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>

                      {/* Direction */}
                      <select
                        value={port.direction}
                        onChange={(e) => handlePortChange(index, 'direction', e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="input">Input</option>
                        <option value="output">Output</option>
                        <option value="both">Both</option>
                      </select>

                      {/* Label */}
                      <input
                        type="text"
                        value={port.label || ''}
                        onChange={(e) => handlePortChange(index, 'label', e.target.value)}
                        placeholder="Label (optional)"
                        className="px-3 py-2 border border-gray-300 rounded bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <button
                      onClick={() => handleRemovePort(index)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded transition-colors"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Port Legend */}
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="text-xs font-semibold text-blue-900 mb-2">Port Direction Guide:</div>
            <div className="grid grid-cols-3 gap-2 text-xs text-blue-800">
              <div>
                <span className="font-medium">Input:</span> Receives signal
              </div>
              <div>
                <span className="font-medium">Output:</span> Sends signal
              </div>
              <div>
                <span className="font-medium">Both:</span> Bidirectional
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
