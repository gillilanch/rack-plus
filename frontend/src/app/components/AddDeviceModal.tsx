import { useEffect, useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { Device, Port, ConnectorType } from '../data/equipment';
import { getDeviceDisplayName, inferManufacturerModelFromLegacyName } from '../utils/deviceDisplay';
import { clampDeviceWidthToRack } from '../utils/rackDevicePlacement';

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
  const [manufacturer, setManufacturer] = useState('');
  const [model, setModel] = useState('');
  const [category, setCategory] = useState<Device['category']>('Camera');
  const [ports, setPorts] = useState<Port[]>(defaultPorts);
  const [rackHeightU, setRackHeightU] = useState('1');
  const [rackWidthIn, setRackWidthIn] = useState('19');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    if (editingDevice) {
      const m = (editingDevice.manufacturer ?? '').trim();
      const md = (editingDevice.model ?? '').trim();
      if (m || md) {
        setManufacturer(m);
        setModel(md);
      } else {
        const inf = inferManufacturerModelFromLegacyName(editingDevice.name);
        setManufacturer(inf.manufacturer);
        setModel(inf.model);
      }
      setCategory(editingDevice.category);
      setPorts(clonePorts(editingDevice.ports));
      setRackHeightU(String(Math.max(1, editingDevice.heightInU ?? 1)));
      setRackWidthIn(String(editingDevice.deviceWidthInches ?? 19));
      return;
    }
    if (cloneSource) {
      const m = (cloneSource.manufacturer ?? '').trim();
      const md = (cloneSource.model ?? '').trim();
      if (m || md) {
        setManufacturer(m);
        setModel(`${md} (copy)`.trim());
      } else {
        const inf = inferManufacturerModelFromLegacyName(`${cloneSource.name} (copy)`);
        setManufacturer(inf.manufacturer);
        setModel(inf.model);
      }
      setCategory(cloneSource.category);
      setPorts(clonePorts(cloneSource.ports));
      setRackHeightU(String(Math.max(1, cloneSource.heightInU ?? 1)));
      setRackWidthIn(String(cloneSource.deviceWidthInches ?? 19));
      return;
    }
    if (prefillName?.trim()) {
      const inf = inferManufacturerModelFromLegacyName(prefillName.trim());
      setManufacturer(inf.manufacturer);
      setModel(inf.model);
      setCategory('Interface');
      setPorts([...defaultPorts]);
      setRackHeightU('1');
      setRackWidthIn('19');
      return;
    }
    setManufacturer('');
    setModel('');
    setCategory('Camera');
    setPorts([...defaultPorts]);
    setRackHeightU('1');
    setRackWidthIn('19');
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

    const mfr = manufacturer.trim();
    const mdl = model.trim();
    if (!mfr || !mdl) {
      setError('Manufacturer and model are required');
      return;
    }

    const displayName = getDeviceDisplayName({ name: '', manufacturer: mfr, model: mdl });
    const nameLc = displayName.trim().toLowerCase();
    const editingLc = editingDevice
      ? getDeviceDisplayName({
          name: editingDevice.name,
          manufacturer: editingDevice.manufacturer,
          model: editingDevice.model,
        })
          .trim()
          .toLowerCase()
      : '';
    const nameTaken = existingDeviceNames.some((n) => n.trim().toLowerCase() === nameLc);
    if (nameTaken && nameLc !== editingLc) {
      setError('A device with this label already exists');
      return;
    }

    const uParsed = parseInt(rackHeightU, 10);
    const heightInU = Number.isFinite(uParsed) && uParsed >= 1 ? Math.min(100, uParsed) : 1;
    const wParsed = parseFloat(rackWidthIn);
    const deviceWidthInches = clampDeviceWidthToRack(Number.isFinite(wParsed) ? wParsed : 19, 120);

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
      name: displayName,
      manufacturer: mfr,
      model: mdl,
      category,
      ports: filteredPorts,
      heightInU,
      deviceWidthInches,
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

          <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Manufacturer *</label>
              <input
                type="text"
                value={manufacturer}
                onChange={(e) => setManufacturer(e.target.value)}
                placeholder="e.g. Yamaha, Sony"
                autoComplete="organization"
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Model / model number *</label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="e.g. MG10XU, FX6"
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          {(manufacturer.trim() || model.trim()) && (
            <p className="mb-4 text-sm text-gray-600">
              Saved as: <span className="font-medium text-gray-900">{getDeviceDisplayName({ name: '', manufacturer, model })}</span>
            </p>
          )}

          <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="add-dev-rack-u" className="mb-2 block text-sm font-medium text-gray-700">
                Rack height (U) *
              </label>
              <input
                id="add-dev-rack-u"
                type="number"
                min={1}
                max={100}
                value={rackHeightU}
                onChange={(e) => setRackHeightU(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-gray-500">Used when you add this model from the catalog to a rack.</p>
            </div>
            <div>
              <label htmlFor="add-dev-rack-w" className="mb-2 block text-sm font-medium text-gray-700">
                Rack width (inches) *
              </label>
              <input
                id="add-dev-rack-w"
                type="number"
                min={0.25}
                max={120}
                step={0.25}
                value={rackWidthIn}
                onChange={(e) => setRackWidthIn(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-gray-500">Front-panel width (typical rack gear 19&quot;).</p>
            </div>
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
