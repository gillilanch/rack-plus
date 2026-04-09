import { useEffect, useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import type { RackDevice } from '../types/rack';
import { getDeviceDisplayName } from '../utils/deviceDisplay';
import type { ConnectorType, Port } from '../data/equipment';
import { DEFAULT_INCHES_PER_RU, inchesFromRU, ruFromInches } from '../utils/rackUnits';

const connectorTypes: ConnectorType[] = [
  'HDMI',
  'SDI',
  'XLR',
  'USB-C',
  'USB-A',
  'Thunderbolt',
  '3.5mm',
  '1/4 TRS',
  'RCA',
  'DisplayPort',
  'Mini DisplayPort',
  'DVI',
  'VGA',
  'Ethernet',
  'BNC',
  'TS',
];

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

function DevicePortSection({
  title,
  editedDevice,
  setEditedDevice,
  inchesPerRU,
}: {
  title: string;
  editedDevice: RackDevice;
  setEditedDevice: (d: RackDevice) => void;
  inchesPerRU: number;
}) {
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

  const handlePortChange = (index: number, field: keyof Port, value: string) => {
    const newPorts = [...editedDevice.ports];
    newPorts[index] = { ...newPorts[index], [field]: value };
    setEditedDevice({ ...editedDevice, ports: newPorts });
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      <p className="text-sm text-gray-600">{getDeviceDisplayName(editedDevice)}</p>

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <h4 className="mb-2 text-sm font-medium text-gray-800">Category & height</h4>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Category</label>
            <select
              value={normalizeCategoryForEditor(editedDevice.category)}
              onChange={(e) =>
                setEditedDevice({
                  ...editedDevice,
                  category: e.target.value as RackDevice['category'],
                })
              }
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              {categorySelectOptions(editedDevice.category).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Rack height (U)</label>
            <input
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
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-gray-600">Physical height (inches)</label>
            <input
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
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">Ports ({editedDevice.ports.length})</span>
          <button
            type="button"
            onClick={handleAddPort}
            className="flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-1 text-sm text-blue-600 hover:bg-blue-100"
          >
            <Plus className="size-4" />
            Add port
          </button>
        </div>
        {editedDevice.ports.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
            No ports — add ports so a cable can match.
          </div>
        ) : (
          <div className="space-y-2">
            {editedDevice.ports.map((port, index) => (
              <div key={index} className="flex gap-2 rounded-lg border border-gray-200 bg-gray-50 p-2">
                <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-3">
                  <select
                    value={port.type}
                    onChange={(e) => handlePortChange(index, 'type', e.target.value)}
                    className="rounded border border-gray-300 px-2 py-1 text-sm"
                  >
                    {connectorTypes.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <select
                    value={port.direction}
                    onChange={(e) => handlePortChange(index, 'direction', e.target.value)}
                    className="rounded border border-gray-300 px-2 py-1 text-sm"
                  >
                    <option value="input">Input</option>
                    <option value="output">Output</option>
                    <option value="both">Both</option>
                  </select>
                  <input
                    type="text"
                    value={port.label || ''}
                    onChange={(e) => handlePortChange(index, 'label', e.target.value)}
                    placeholder="Label"
                    className="rounded border border-gray-300 px-2 py-1 text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleRemovePort(index)}
                  className="p-2 text-red-500 hover:bg-red-50"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface RackDualDeviceEditorProps {
  deviceA: RackDevice;
  deviceB: RackDevice;
  isOpen: boolean;
  onClose: () => void;
  onSave: (a: RackDevice, b: RackDevice) => void;
  inchesPerRU?: number;
}

export function RackDualDeviceEditor({
  deviceA,
  deviceB,
  isOpen,
  onClose,
  onSave,
  inchesPerRU: inchesPerRUProp,
}: RackDualDeviceEditorProps) {
  const inchesPerRU =
    inchesPerRUProp != null && Number.isFinite(inchesPerRUProp) && inchesPerRUProp > 0
      ? inchesPerRUProp
      : DEFAULT_INCHES_PER_RU;
  const [a, setA] = useState<RackDevice>(deviceA);
  const [b, setB] = useState<RackDevice>(deviceB);
  const [tab, setTab] = useState<'a' | 'b'>('a');

  useEffect(() => {
    setA({ ...deviceA });
    setB({ ...deviceB });
    setTab('a');
  }, [deviceA, deviceB, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="no-print fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white shadow-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Reconfigure devices</h2>
            <p className="text-sm text-gray-600">Edit ports on both devices, then save to retry the cable.</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="size-6" />
          </button>
        </div>

        <div className="border-b border-gray-100 px-6 pt-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setTab('a')}
              className={`rounded-t-lg px-4 py-2 text-sm font-medium ${
                tab === 'a' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {getDeviceDisplayName(a)}
            </button>
            <button
              type="button"
              onClick={() => setTab('b')}
              className={`rounded-t-lg px-4 py-2 text-sm font-medium ${
                tab === 'b' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {getDeviceDisplayName(b)}
            </button>
          </div>
        </div>

        <div className="p-6">
          {tab === 'a' ? (
            <DevicePortSection title="Device A" editedDevice={a} setEditedDevice={setA} inchesPerRU={inchesPerRU} />
          ) : (
            <DevicePortSection title="Device B" editedDevice={b} setEditedDevice={setB} inchesPerRU={inchesPerRU} />
          )}
        </div>

        <div className="sticky bottom-0 flex justify-end gap-3 border-t border-gray-200 bg-white px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-6 py-2 text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave(a, b)}
            className="rounded-lg bg-blue-600 px-6 py-2 font-semibold text-white hover:bg-blue-700"
          >
            Save both
          </button>
        </div>
      </div>
    </div>
  );
}
