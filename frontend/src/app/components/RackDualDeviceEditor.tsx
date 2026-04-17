import { useEffect, useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import type { RackDevice } from '../types/rack';
import { getDeviceDisplayName } from '../utils/deviceDisplay';
import type { ConnectorType, Port } from '../data/equipment';
import { DEFAULT_INCHES_PER_RU, DEFAULT_RACK_WIDTH_INCHES, inchesFromRU, ruFromInches } from '../utils/rackUnits';
import {
  clampDeviceWidthToRack,
  clampHorizontalOffset,
  DEFAULT_DEVICE_WIDTH_INCHES,
  parseDeviceWidthInchesInput,
  parseHorizontalOffsetInchesInput,
} from '../utils/rackDevicePlacement';
import { RackCategoryField } from './RackCategoryField';

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

function DevicePortSection({
  title,
  editedDevice,
  setEditedDevice,
  inchesPerRU,
  rackWidthInches,
  faceWidthStr,
  setFaceWidthStr,
  faceOffsetStr,
  setFaceOffsetStr,
}: {
  title: string;
  editedDevice: RackDevice;
  setEditedDevice: (d: RackDevice) => void;
  inchesPerRU: number;
  rackWidthInches: number;
  faceWidthStr: string;
  setFaceWidthStr: (s: string) => void;
  faceOffsetStr: string;
  setFaceOffsetStr: (s: string) => void;
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

  const fieldCls =
    'w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500';
  const selectCls = 'rounded border border-slate-600 bg-slate-900 px-2 py-1 text-sm text-slate-100';

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-slate-100">{title}</h3>
      <p className="text-sm text-slate-400">{getDeviceDisplayName(editedDevice)}</p>

      <div className="rounded-lg border border-slate-600 bg-slate-800/80 p-4">
        <h4 className="mb-2 text-sm font-medium text-slate-200">Category & height</h4>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <RackCategoryField
              label="Category"
              showHint={false}
              value={editedDevice.category}
              onChange={(cat) => setEditedDevice({ ...editedDevice, category: cat })}
              labelClassName="mb-1 block text-xs font-medium text-slate-400"
              inputClassName="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Rack height (U)</label>
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
              className={fieldCls}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-400">Physical height (inches)</label>
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
              className={fieldCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Device width (inches)</label>
            <input
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
              className={fieldCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Offset from left (inches)</label>
            <input
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
              className={fieldCls}
            />
          </div>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-slate-300">Ports ({editedDevice.ports.length})</span>
          <button
            type="button"
            onClick={handleAddPort}
            className="flex items-center gap-1 rounded-lg bg-sky-950/80 px-3 py-1 text-sm text-sky-300 hover:bg-sky-900/90"
          >
            <Plus className="size-4" />
            Add port
          </button>
        </div>
        {editedDevice.ports.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-slate-600 p-6 text-center text-sm text-slate-500">
            No ports — add ports so a cable can match.
          </div>
        ) : (
          <div className="space-y-2">
            {editedDevice.ports.map((port, index) => (
              <div key={index} className="flex gap-2 rounded-lg border border-slate-600 bg-slate-800/60 p-2">
                <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-3">
                  <select
                    value={port.type}
                    onChange={(e) => handlePortChange(index, 'type', e.target.value)}
                    className={selectCls}
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
                    className={selectCls}
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
                    className={selectCls}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleRemovePort(index)}
                  className="p-2 text-red-400 hover:bg-red-950/50"
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
  rackWidthInches?: number;
}

export function RackDualDeviceEditor({
  deviceA,
  deviceB,
  isOpen,
  onClose,
  onSave,
  inchesPerRU: inchesPerRUProp,
  rackWidthInches: rackWidthProp,
}: RackDualDeviceEditorProps) {
  const inchesPerRU =
    inchesPerRUProp != null && Number.isFinite(inchesPerRUProp) && inchesPerRUProp > 0
      ? inchesPerRUProp
      : DEFAULT_INCHES_PER_RU;
  const rackWidthInches =
    rackWidthProp != null && Number.isFinite(rackWidthProp) && rackWidthProp > 0
      ? rackWidthProp
      : DEFAULT_RACK_WIDTH_INCHES;
  const [a, setA] = useState<RackDevice>(deviceA);
  const [b, setB] = useState<RackDevice>(deviceB);
  const [tab, setTab] = useState<'a' | 'b'>('a');
  const [faceWidthStrA, setFaceWidthStrA] = useState('');
  const [faceOffsetStrA, setFaceOffsetStrA] = useState('');
  const [faceWidthStrB, setFaceWidthStrB] = useState('');
  const [faceOffsetStrB, setFaceOffsetStrB] = useState('');

  useEffect(() => {
    setA({ ...deviceA });
    setB({ ...deviceB });
    setTab('a');
    const wa = deviceA.deviceWidthInches;
    setFaceWidthStrA(wa != null && Number.isFinite(wa) ? String(wa) : '');
    const oa = deviceA.horizontalOffsetInches;
    setFaceOffsetStrA(oa != null && Number.isFinite(oa) ? String(oa) : '');
    const wb = deviceB.deviceWidthInches;
    setFaceWidthStrB(wb != null && Number.isFinite(wb) ? String(wb) : '');
    const ob = deviceB.horizontalOffsetInches;
    setFaceOffsetStrB(ob != null && Number.isFinite(ob) ? String(ob) : '');
  }, [deviceA, deviceB, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="no-print fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-slate-600 bg-slate-900 shadow-2xl ring-1 ring-slate-500/25">
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-600 bg-slate-900 px-6 py-4">
          <div>
            <h2 className="text-xl font-bold text-slate-100">Reconfigure devices</h2>
            <p className="text-sm text-slate-400">Edit ports on both devices, then save to retry the cable.</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X className="size-6" />
          </button>
        </div>

        <div className="border-b border-slate-600 px-6 pt-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setTab('a')}
              className={`rounded-t-lg px-4 py-2 text-sm font-medium ${
                tab === 'a' ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {getDeviceDisplayName(a)}
            </button>
            <button
              type="button"
              onClick={() => setTab('b')}
              className={`rounded-t-lg px-4 py-2 text-sm font-medium ${
                tab === 'b' ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {getDeviceDisplayName(b)}
            </button>
          </div>
        </div>

        <div className="p-6">
          {tab === 'a' ? (
            <DevicePortSection
              title="Device A"
              editedDevice={a}
              setEditedDevice={setA}
              inchesPerRU={inchesPerRU}
              rackWidthInches={rackWidthInches}
              faceWidthStr={faceWidthStrA}
              setFaceWidthStr={setFaceWidthStrA}
              faceOffsetStr={faceOffsetStrA}
              setFaceOffsetStr={setFaceOffsetStrA}
            />
          ) : (
            <DevicePortSection
              title="Device B"
              editedDevice={b}
              setEditedDevice={setB}
              inchesPerRU={inchesPerRU}
              rackWidthInches={rackWidthInches}
              faceWidthStr={faceWidthStrB}
              setFaceWidthStr={setFaceWidthStrB}
              faceOffsetStr={faceOffsetStrB}
              setFaceOffsetStr={setFaceOffsetStrB}
            />
          )}
        </div>

        <div className="sticky bottom-0 flex justify-end gap-3 border-t border-slate-600 bg-slate-900 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-500 px-6 py-2 text-slate-200 hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              const wa = parseDeviceWidthInchesInput(faceWidthStrA, rackWidthInches);
              const oa = parseHorizontalOffsetInchesInput(faceOffsetStrA, wa, rackWidthInches);
              const wb = parseDeviceWidthInchesInput(faceWidthStrB, rackWidthInches);
              const ob = parseHorizontalOffsetInchesInput(faceOffsetStrB, wb, rackWidthInches);
              onSave(
                { ...a, deviceWidthInches: wa, horizontalOffsetInches: oa },
                { ...b, deviceWidthInches: wb, horizontalOffsetInches: ob },
              );
            }}
            className="rounded-lg bg-sky-600 px-6 py-2 font-semibold text-white hover:bg-sky-500"
          >
            Save both
          </button>
        </div>
      </div>
    </div>
  );
}
