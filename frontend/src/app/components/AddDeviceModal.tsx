import { useEffect, useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { Device, Port, ConnectorType } from '../data/equipment';

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

const categories: Device['category'][] = ['Camera', 'Laptop', 'Recording Deck', 'Audio', 'Monitor', 'Interface'];

const defaultPorts: Port[] = [{ type: 'HDMI', direction: 'output', label: '' }];

function clonePorts(ports: Port[]): Port[] {
  return ports.length > 0 ? ports.map((p) => ({ ...p })) : [...defaultPorts];
}

export interface AddDeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveDevice: (device: Device) => void;
  /** Names that must stay unique (lowercase comparison in form). */
  existingDeviceNames: string[];
  /** Edit existing Fox / custom device (same id on save). */
  editingDevice?: Device | null;
  /** Prefill from a built-in catalog device (new id on save). */
  cloneSource?: Device | null;
  /** Prefill name (e.g. CSV review → save to database). */
  prefillName?: string | null;
}


export function AddDeviceModal({
  isOpen,
  onClose,
  onSaveDevice,
  existingDeviceNames,
  editingDevice = null,
  cloneSource = null,
  prefillName = null,
}: AddDeviceModalProps) {
  const [deviceName, setDeviceName] = useState('');
  const [category, setCategory] = useState<Device['category']>('Camera');
  const [ports, setPorts] = useState<Port[]>(defaultPorts);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    if (editingDevice) {
      setDeviceName(editingDevice.name);
      setCategory(editingDevice.category);
      setPorts(clonePorts(editingDevice.ports));
      return;
    }
    if (cloneSource) {
      setDeviceName(`${cloneSource.name} (copy)`);
      setCategory(cloneSource.category);
      setPorts(clonePorts(cloneSource.ports));
      return;
    }
    if (prefillName?.trim()) {
      setDeviceName(prefillName.trim());
      setCategory('Interface');
      setPorts([...defaultPorts]);
      return;
    }
    setDeviceName('');
    setCategory('Camera');
    setPorts([...defaultPorts]);
  }, [isOpen, editingDevice?.id, cloneSource?.id, prefillName]);

  if (!isOpen) return null;

  const handleAddPort = () => {
    setPorts([...ports, { type: 'HDMI', direction: 'output', label: '' }]);
  };

  const handleRemovePort = (index: number) => {
    setPorts(ports.filter((_, i) => i !== index));
  };

  const handlePortChange = (index: number, field: keyof Port, value: string) => {
    const newPorts = [...ports];
    newPorts[index] = { ...newPorts[index], [field]: value };
    setPorts(newPorts);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!deviceName.trim()) {
      setError('Device name is required');
      return;
    }

    const nameLc = deviceName.trim().toLowerCase();
    const editingLc = editingDevice?.name.trim().toLowerCase();
    const nameTaken = existingDeviceNames.some((n) => n.trim().toLowerCase() === nameLc);
    if (nameTaken && nameLc !== editingLc) {
      setError('A device with this name already exists');
      return;
    }

    if (ports.length === 0) {
      setError('At least one port is required');
      return;
    }

    const filteredPorts = ports.filter((port) => port.type);
    if (filteredPorts.length === 0) {
      setError('At least one port is required');
      return;
    }

    const id =
      editingDevice?.id ?? `custom-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    onSaveDevice({
      id,
      name: deviceName.trim(),
      category,
      ports: filteredPorts,
    });

    onClose();
  };

  const handleClose = () => {
    setError('');
    onClose();
  };

  const modalTitle = editingDevice
    ? 'Edit device'
    : cloneSource
      ? 'Copy to Fox equipment database'
      : 'Add to Fox equipment database';

  return (
    <div className="no-print fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
          <h2 className="text-xl font-bold text-gray-900">{modalTitle}</h2>
          <button
            type="button"
            onClick={handleClose}
            className="text-gray-400 transition-colors hover:text-gray-600"
          >
            <X className="size-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="mb-4">
            <label className="mb-2 block text-sm font-medium text-gray-700">Device name *</label>
            <input
              type="text"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              placeholder="e.g., Sony A7S III"
              className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="mb-6">
            <label className="mb-2 block text-sm font-medium text-gray-700">Category *</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as Device['category'])}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-6">
            <div className="mb-3 flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-700">Ports * ({ports.length})</label>
              <button
                type="button"
                onClick={handleAddPort}
                className="flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-1 text-sm text-blue-600 transition-colors hover:bg-blue-100"
              >
                <Plus className="size-4" />
                Add port
              </button>
            </div>

            <div className="space-y-3">
              {ports.map((port, index) => (
                <div
                  key={index}
                  className="flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3"
                >
                  <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-3">
                    <select
                      value={port.type}
                      onChange={(e) => handlePortChange(index, 'type', e.target.value)}
                      className="rounded border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {connectorTypes.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>

                    <select
                      value={port.direction}
                      onChange={(e) => handlePortChange(index, 'direction', e.target.value)}
                      className="rounded border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="input">Input</option>
                      <option value="output">Output</option>
                      <option value="both">Both</option>
                    </select>

                    <input
                      type="text"
                      value={port.label || ''}
                      onChange={(e) => handlePortChange(index, 'label', e.target.value)}
                      placeholder="Label (optional)"
                      className="rounded border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {ports.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemovePort(index)}
                      className="rounded p-2 text-red-500 transition-colors hover:bg-red-50"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-3">
            <div className="mb-2 text-xs font-semibold text-blue-900">Port direction</div>
            <div className="grid grid-cols-3 gap-2 text-xs text-blue-800">
              <div>
                <span className="font-medium">Input:</span> receives signal
              </div>
              <div>
                <span className="font-medium">Output:</span> sends signal
              </div>
              <div>
                <span className="font-medium">Both:</span> bidirectional
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg border border-gray-300 px-6 py-2 text-gray-700 transition-colors hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-6 py-2 font-semibold text-white transition-colors hover:bg-blue-700"
            >
              {editingDevice ? 'Save changes' : 'Save device'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
