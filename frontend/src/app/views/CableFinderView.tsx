/**
 * Standalone cable finder (catalog + custom devices). The main app uses `RackCableConnectionsPanel` instead;
 * keep this file for a dedicated full-page flow if you need it again.
 */
import { useState, useEffect } from 'react';
import { devices as defaultDevices } from '../data/equipment';
import { findConnection, ConnectionSolution } from '../utils/cableFinder';
import { getCustomDevices, saveCustomDevice } from '../utils/customDevices';
import { DeviceSelector } from '../components/DeviceSelector';
import { ConnectionResults } from '../components/ConnectionResults';
import { QuickPresets } from '../components/QuickPresets';
import { AddDeviceModal } from '../components/AddDeviceModal';
import { Cable, ArrowRight, RefreshCw, Zap, Plus } from 'lucide-react';
import type { Device } from '../data/equipment';

export function CableFinderView() {
  const [customDevices, setCustomDevices] = useState<Device[]>([]);
  const [allDevices, setAllDevices] = useState<Device[]>(defaultDevices);
  const [fromDevice, setFromDevice] = useState<Device | null>(null);
  const [toDevice, setToDevice] = useState<Device | null>(null);
  const [solutions, setSolutions] = useState<ConnectionSolution[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [isAddDeviceModalOpen, setIsAddDeviceModalOpen] = useState(false);

  useEffect(() => {
    const loaded = getCustomDevices();
    setCustomDevices(loaded);
    setAllDevices([...defaultDevices, ...loaded]);
  }, []);

  const handleAddDevice = (device: Device) => {
    saveCustomDevice(device);
    const updated = [...customDevices, device];
    setCustomDevices(updated);
    setAllDevices([...defaultDevices, ...updated]);
  };

  const handleFindCable = () => {
    if (fromDevice && toDevice) {
      setSolutions(findConnection(fromDevice, toDevice));
      setShowResults(true);
    }
  };

  const handleReset = () => {
    setFromDevice(null);
    setToDevice(null);
    setSolutions([]);
    setShowResults(false);
  };

  const handlePresetSelect = (from: Device, to: Device) => {
    setFromDevice(from);
    setToDevice(to);
    setSolutions(findConnection(from, to));
    setShowResults(true);
  };

  const canFindCable = fromDevice !== null && toDevice !== null;
  const existingDeviceNames = allDevices.map((d) => d.name);

  return (
    <>
      <div className="mb-8 rounded-lg border border-blue-200 bg-blue-50 p-4">
        <div className="flex items-start gap-3">
          <Zap className="mt-0.5 size-5 shrink-0 text-blue-600" />
          <div>
            <h2 className="mb-1 font-semibold text-blue-900">Cable Finder</h2>
            <p className="text-sm text-blue-800">
              Select your source and destination devices to instantly find the correct cable and any required
              adapters.
            </p>
          </div>
        </div>
      </div>

      <QuickPresets devices={allDevices} onSelectPreset={handlePresetSelect} />

      <div className="mb-6">
        <button
          type="button"
          onClick={() => setIsAddDeviceModalOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 font-medium text-white shadow-md transition-colors hover:bg-green-700 hover:shadow-lg"
        >
          <Plus className="size-5" />
          Add Custom Device
        </button>
        {customDevices.length > 0 && (
          <p className="mt-2 text-sm text-gray-600">
            {customDevices.length} custom device{customDevices.length !== 1 ? 's' : ''} added
          </p>
        )}
      </div>

      <div className="mb-6 rounded-xl bg-white p-6 shadow-lg">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_auto_1fr]">
          <DeviceSelector
            devices={allDevices}
            selectedDevice={fromDevice}
            onSelectDevice={setFromDevice}
            label="From Device (Source)"
            placeholder="Select source device..."
          />
          <div className="hidden items-center justify-center pt-8 lg:flex">
            <ArrowRight className="size-8 text-gray-400" />
          </div>
          <DeviceSelector
            devices={allDevices}
            selectedDevice={toDevice}
            onSelectDevice={setToDevice}
            label="To Device (Destination)"
            placeholder="Select destination device..."
          />
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleFindCable}
            disabled={!canFindCable}
            className={`flex items-center gap-2 rounded-lg px-6 py-3 font-semibold transition-all ${
              canFindCable
                ? 'bg-blue-600 text-white shadow-md hover:bg-blue-700 hover:shadow-lg'
                : 'cursor-not-allowed bg-gray-200 text-gray-400'
            }`}
          >
            <Cable className="size-5" />
            Find Cable
          </button>
          {(fromDevice || toDevice) && (
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-2 rounded-lg bg-gray-100 px-6 py-3 font-semibold text-gray-700 transition-all hover:bg-gray-200"
            >
              <RefreshCw className="size-5" />
              Reset
            </button>
          )}
        </div>
      </div>

      {showResults && (
        <div className="rounded-xl bg-white p-6 shadow-lg">
          <ConnectionResults solutions={solutions} fromDevice={fromDevice!} toDevice={toDevice!} />
        </div>
      )}

      {!showResults && (
        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          {[
            { t: 'Direct Connection', c: 'bg-green-500', d: 'A single cable connects your devices directly.' },
            { t: 'Adapter Required', c: 'bg-blue-500', d: 'One adapter to convert between connector types.' },
            { t: 'Converter Required', c: 'bg-yellow-500', d: 'Multiple adapters or active converters.' },
          ].map((x) => (
            <div key={x.t} className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="mb-2 flex items-center gap-2">
                <div className={`size-3 rounded-full ${x.c}`} />
                <h3 className="font-semibold text-gray-900">{x.t}</h3>
              </div>
              <p className="text-sm text-gray-600">{x.d}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 text-center text-sm text-gray-500">
        <p>Bureau Equipment Database · March 2026</p>
      </div>

      <AddDeviceModal
        isOpen={isAddDeviceModalOpen}
        onClose={() => setIsAddDeviceModalOpen(false)}
        onSaveDevice={handleAddDevice}
        existingDeviceNames={existingDeviceNames}
      />
    </>
  );
}
