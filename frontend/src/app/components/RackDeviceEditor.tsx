import { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { RackDevice } from '../types/rack';
import { getDeviceDisplayName } from '../utils/deviceDisplay';
import { Port, ConnectorType } from '../data/equipment';
import { DEFAULT_INCHES_PER_RU, DEFAULT_RACK_WIDTH_INCHES, inchesFromRU, ruFromInches } from '../utils/rackUnits';
import {
  clampDeviceWidthToRack,
  clampHorizontalOffset,
  DEFAULT_DEVICE_WIDTH_INCHES,
  parseDeviceWidthInchesInput,
  parseHorizontalOffsetInchesInput,
} from '../utils/rackDevicePlacement';
import { RackCategoryField } from './RackCategoryField';

interface RackDeviceEditorProps {
  device: RackDevice | null;
  isOpen: boolean;
  onClose: () => void;
  /** Return false to keep the editor open (e.g. placement conflict). */
  onSave: (device: RackDevice) => void | boolean;
  /** Inches per 1U from rack settings (default 1.75"). */
  inchesPerRU?: number;
  /** Rack front-panel width for clamping device width / offset. */
  rackWidthInches?: number;
}

const connectorTypes: ConnectorType[] = [
  'HDMI', 'SDI', 'XLR', 'USB-C', 'USB-A', 'Thunderbolt',
  '3.5mm', '1/4 TRS', 'RCA', 'DisplayPort', 'Mini DisplayPort',
  'DVI', 'VGA', 'Ethernet', 'BNC', 'TS',
];

export function RackDeviceEditor({
  device,
  isOpen,
  onClose,
  onSave,
  inchesPerRU: inchesPerRUProp,
  rackWidthInches: rackWidthProp,
}: RackDeviceEditorProps) {
  const inchesPerRU =
    inchesPerRUProp != null && Number.isFinite(inchesPerRUProp) && inchesPerRUProp > 0
      ? inchesPerRUProp
      : DEFAULT_INCHES_PER_RU;
  const rackWidthInches =
    rackWidthProp != null && Number.isFinite(rackWidthProp) && rackWidthProp > 0
      ? rackWidthProp
      : DEFAULT_RACK_WIDTH_INCHES;
  const [editedDevice, setEditedDevice] = useState<RackDevice | null>(null);
  const [faceWidthStr, setFaceWidthStr] = useState('');
  const [faceOffsetStr, setFaceOffsetStr] = useState('');

  useEffect(() => {
    if (device && isOpen) {
      setEditedDevice({ ...device });
      const w = device.deviceWidthInches;
      setFaceWidthStr(w != null && Number.isFinite(w) ? String(w) : '');
      const o = device.horizontalOffsetInches;
      setFaceOffsetStr(o != null && Number.isFinite(o) ? String(o) : '');
    }
  }, [device, isOpen]);

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
    const widthClamped = parseDeviceWidthInchesInput(faceWidthStr, rackWidthInches);
    const offClamped = parseHorizontalOffsetInchesInput(faceOffsetStr, widthClamped, rackWidthInches);
    const payload: RackDevice = {
      ...editedDevice,
      manufacturer: m,
      model: md,
      name,
      deviceWidthInches: widthClamped,
      horizontalOffsetInches: offClamped,
      deviceDepthInches: editedDevice.deviceDepthInches,
      sheetPower: editedDevice.sheetPower?.trim() ? editedDevice.sheetPower.trim() : undefined,
      deviceNotes: editedDevice.deviceNotes?.trim() ? editedDevice.deviceNotes.trim() : undefined,
    };
    const ok = onSave(payload);
    if (ok !== false) onClose();
  };

  const field =
    'w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500';
  const labelCls = 'mb-1 block text-xs font-medium text-slate-300';
  const hintCls = 'mt-1 text-xs text-slate-400';

  return (
    <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-600 bg-slate-900 text-slate-100 shadow-2xl shadow-black/40">
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-700 bg-slate-900 px-6 py-4">
          <div>
            <h2 className="text-xl font-bold text-slate-50">Configure Device I/O</h2>
            <p className="mt-1 text-sm text-slate-300">{getDeviceDisplayName(editedDevice)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100"
            aria-label="Close"
          >
            <X className="size-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Category & rack height (applies to unassigned and placed devices) */}
          <div className="mb-6 rounded-lg border border-slate-600 bg-slate-800/80 p-4">
            <h3 className="mb-3 text-sm font-medium text-slate-100">Manufacturer & model</h3>
            <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="rack-edit-mfr" className={labelCls}>
                  Manufacturer
                </label>
                <input
                  id="rack-edit-mfr"
                  type="text"
                  value={editedDevice.manufacturer ?? ''}
                  onChange={(e) =>
                    setEditedDevice({ ...editedDevice, manufacturer: e.target.value })
                  }
                  className={field}
                />
              </div>
              <div>
                <label htmlFor="rack-edit-model" className={labelCls}>
                  Model / model number
                </label>
                <input
                  id="rack-edit-model"
                  type="text"
                  value={editedDevice.model ?? ''}
                  onChange={(e) => setEditedDevice({ ...editedDevice, model: e.target.value })}
                  className={field}
                />
              </div>
            </div>
            <h3 className="mb-3 text-sm font-medium text-slate-100">Category & height</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <RackCategoryField
                  id="rack-edit-category"
                  label="Category"
                  showHint={false}
                  value={editedDevice.category}
                  onChange={(cat) => setEditedDevice({ ...editedDevice, category: cat })}
                  labelClassName={labelCls}
                  inputClassName={field}
                />
              </div>
              <div>
                <label htmlFor="rack-edit-u" className={labelCls}>
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
                  className={field}
                />
                <p className={hintCls}>
                  1U = {inchesPerRU}&quot; (rack settings)
                </p>
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="rack-edit-in" className={labelCls}>
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
                  className={field}
                />
                <p className={hintCls}>
                  Edit U or inches — the other updates from {inchesPerRU}&quot;/U.
                </p>
              </div>
            </div>
          </div>

          <div className="mb-6 rounded-lg border border-sky-800/80 bg-sky-950/40 p-4">
            <h3 className="mb-1 text-sm font-bold text-sky-100">Front panel — side by side on the same U</h3>
            <p className="mb-3 text-xs leading-relaxed text-sky-200/90">
              This rack is <strong className="text-sky-50">{rackWidthInches}&quot;</strong> wide. Anything that shares the same rack unit (same
              vertical row) must fit in that width: the <strong className="text-sky-50">sum of device widths</strong> cannot exceed{' '}
              {rackWidthInches}&quot;, and horizontal positions must not overlap. Example: two 9.5&quot; devices can sit
              side by side; two full 19&quot; devices cannot.
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="rack-edit-face-w" className={labelCls}>
                  Device width (inches)
                </label>
                <input
                  id="rack-edit-face-w"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder={`${DEFAULT_DEVICE_WIDTH_INCHES}`}
                  value={faceWidthStr}
                  onChange={(e) => setFaceWidthStr(e.target.value)}
                  onBlur={() => {
                    const width = parseDeviceWidthInchesInput(faceWidthStr, rackWidthInches);
                    setFaceWidthStr(String(width));
                    setEditedDevice({
                      ...editedDevice,
                      deviceWidthInches: width,
                      horizontalOffsetInches: clampHorizontalOffset(
                        parseHorizontalOffsetInchesInput(faceOffsetStr, width, rackWidthInches),
                        width,
                        rackWidthInches,
                      ),
                    });
                  }}
                  className={field}
                />
                <p className={hintCls}>
                  Type any width (blank = {DEFAULT_DEVICE_WIDTH_INCHES}&quot;). Lower values let multiple units share one U.
                </p>
              </div>
              <div>
                <label htmlFor="rack-edit-face-x" className={labelCls}>
                  Offset from left rail (inches)
                </label>
                <input
                  id="rack-edit-face-x"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0"
                  value={faceOffsetStr}
                  onChange={(e) => setFaceOffsetStr(e.target.value)}
                  onBlur={() => {
                    const width = parseDeviceWidthInchesInput(faceWidthStr, rackWidthInches);
                    const off = parseHorizontalOffsetInchesInput(faceOffsetStr, width, rackWidthInches);
                    setFaceOffsetStr(String(off));
                    setEditedDevice({
                      ...editedDevice,
                      deviceWidthInches: width,
                      horizontalOffsetInches: off,
                    });
                  }}
                  className={field}
                />
                <p className={hintCls}>Slide left/right along the rack face when placed.</p>
              </div>
            </div>
          </div>

          <div className="mb-6 rounded-lg border border-slate-600 bg-slate-800/80 p-4">
            <h3 className="mb-3 text-sm font-medium text-slate-100">Power, depth & notes</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="rack-edit-depth" className={labelCls}>
                  Face depth (inches)
                </label>
                <input
                  id="rack-edit-depth"
                  type="number"
                  min={0}
                  max={120}
                  step={0.25}
                  value={editedDevice.deviceDepthInches ?? ''}
                  onChange={(e) => {
                    const raw = e.target.value.trim();
                    if (raw === '') {
                      setEditedDevice({ ...editedDevice, deviceDepthInches: undefined });
                      return;
                    }
                    const n = parseFloat(raw);
                    if (!Number.isNaN(n) && n >= 0) {
                      setEditedDevice({ ...editedDevice, deviceDepthInches: n });
                    }
                  }}
                  placeholder="Optional"
                  className={field}
                />
              </div>
              <div>
                <label htmlFor="rack-edit-power" className={labelCls}>
                  Power (sheet / PSU)
                </label>
                <input
                  id="rack-edit-power"
                  type="text"
                  value={editedDevice.sheetPower ?? ''}
                  onChange={(e) =>
                    setEditedDevice({
                      ...editedDevice,
                      sheetPower: e.target.value.trim() ? e.target.value : undefined,
                    })
                  }
                  placeholder="Optional"
                  className={field}
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="rack-edit-notes" className={labelCls}>
                  Notes
                </label>
                <textarea
                  id="rack-edit-notes"
                  rows={3}
                  value={editedDevice.deviceNotes ?? ''}
                  onChange={(e) =>
                    setEditedDevice({
                      ...editedDevice,
                      deviceNotes: e.target.value.trim() ? e.target.value : undefined,
                    })
                  }
                  placeholder="Optional — e.g. catalog description or site-specific detail"
                  className={field}
                />
              </div>
            </div>
          </div>

          {/* Ports Configuration */}
          <div className="mb-6">
            <div className="mb-3 flex items-center justify-between">
              <label className="block text-sm font-medium text-slate-200">
                Input/Output Ports ({editedDevice.ports.length})
              </label>
              <button
                type="button"
                onClick={handleAddPort}
                className="flex items-center gap-1 rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-sky-300 transition-colors hover:bg-slate-700"
              >
                <Plus className="size-4" />
                Add Port
              </button>
            </div>

            {editedDevice.ports.length === 0 ? (
              <div className="rounded-lg border-2 border-dashed border-slate-600 p-8 text-center text-slate-400">
                No ports configured. Click &quot;Add Port&quot; to define inputs and outputs.
              </div>
            ) : (
              <div className="space-y-3">
                {editedDevice.ports.map((port, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-2 rounded-lg border border-slate-600 bg-slate-800/60 p-3"
                  >
                    <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-4">
                      {/* Port Type */}
                      <select
                        value={port.type}
                        onChange={(e) => handlePortChange(index, 'type', e.target.value as ConnectorType)}
                        className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
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
                        onChange={(e) =>
                          handlePortChange(index, 'direction', e.target.value as Port['direction'])
                        }
                        className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                      >
                        <option value="input">Input</option>
                        <option value="output">Output</option>
                        <option value="both">Both</option>
                      </select>

                      <input
                        type="number"
                        min={1}
                        max={999}
                        value={port.count && port.count > 1 ? port.count : ''}
                        onChange={(e) => {
                          const raw = e.target.value.trim();
                          if (raw === '') {
                            handlePortChange(index, 'count', undefined);
                            return;
                          }
                          const n = parseInt(raw, 10);
                          if (!Number.isNaN(n) && n >= 1) {
                            handlePortChange(index, 'count', n <= 1 ? undefined : n);
                          }
                        }}
                        placeholder="Count"
                        className="min-w-0 rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />

                      {/* Label */}
                      <input
                        type="text"
                        value={port.label || ''}
                        onChange={(e) => handlePortChange(index, 'label', e.target.value)}
                        placeholder="Label (optional)"
                        className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemovePort(index)}
                      className="rounded p-2 text-red-400 transition-colors hover:bg-red-950/50"
                      aria-label="Remove port"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Port Legend */}
          <div className="rounded-lg border border-slate-600 bg-slate-800/80 p-3">
            <div className="mb-2 text-xs font-semibold text-slate-200">Port Direction Guide:</div>
            <div className="grid grid-cols-1 gap-2 text-xs text-slate-300 sm:grid-cols-3">
              <div>
                <span className="font-medium text-slate-100">Input:</span> Receives signal
              </div>
              <div>
                <span className="font-medium text-slate-100">Output:</span> Sends signal
              </div>
              <div>
                <span className="font-medium text-slate-100">Both:</span> Bidirectional
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="sticky bottom-0 flex justify-end gap-3 border-t border-slate-700 bg-slate-900 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-500 px-6 py-2 text-slate-200 transition-colors hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-lg bg-[#003366] px-6 py-2 font-semibold text-white transition-colors hover:bg-blue-800"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
