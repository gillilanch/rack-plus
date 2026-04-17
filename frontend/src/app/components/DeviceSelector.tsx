import { Device } from '../data/equipment';
import { getDeviceDisplayName, getDeviceSearchBlob } from '../utils/deviceDisplay';
import { ChevronDown, Search, X, Star } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { isCustomDevice } from '../utils/customDevices';

interface DeviceSelectorProps {
  devices: Device[];
  selectedDevice: Device | null;
  onSelectDevice: (device: Device) => void;
  label: string;
  placeholder: string;
  /** Dark rack workspace styling (slate/cyan). Default `light` for Cable Finder page. */
  variant?: 'light' | 'dark';
}

export function DeviceSelector({
  devices,
  selectedDevice,
  onSelectDevice,
  label,
  placeholder,
  variant = 'light',
}: DeviceSelectorProps) {
  const dark = variant === 'dark';
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Group devices by category
  const devicesByCategory = devices.reduce((acc, device) => {
    if (!acc[device.category]) {
      acc[device.category] = [];
    }
    acc[device.category].push(device);
    return acc;
  }, {} as Record<string, Device[]>);

  // Filter devices based on search term
  const q = searchTerm.toLowerCase();
  const filteredDevices = devices.filter(
    (device) =>
      getDeviceSearchBlob(device).includes(q) || device.category.toLowerCase().includes(q),
  );

  const filteredByCategory = filteredDevices.reduce((acc, device) => {
    if (!acc[device.category]) {
      acc[device.category] = [];
    }
    acc[device.category].push(device);
    return acc;
  }, {} as Record<string, Device[]>);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setIsOpen(true);
      e.preventDefault();
      return;
    }

    if (isOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < filteredDevices.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : 0);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredDevices[highlightedIndex]) {
          onSelectDevice(filteredDevices[highlightedIndex]);
          setIsOpen(false);
          setSearchTerm('');
        }
      } else if (e.key === 'Escape') {
        setIsOpen(false);
      }
    }
  };

  const handleSelectDevice = (device: Device) => {
    onSelectDevice(device);
    setIsOpen(false);
    setSearchTerm('');
    inputRef.current?.blur();
  };

  const handleClear = () => {
    onSelectDevice(null as any);
    setSearchTerm('');
    setIsOpen(false);
  };

  return (
    <div className="flex flex-col gap-2">
      <label
        className={`text-sm font-semibold ${dark ? 'text-slate-200' : 'font-medium text-gray-700'}`}
      >
        {label}
      </label>
      <div className="relative" ref={dropdownRef}>
        <div className="relative">
          <div
            className={`absolute left-3 top-1/2 -translate-y-1/2 ${dark ? 'text-slate-500' : 'text-gray-400'}`}
          >
            <Search className="size-5" />
          </div>
          <input
            ref={inputRef}
            type="text"
            value={selectedDevice ? getDeviceDisplayName(selectedDevice) : searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setIsOpen(true);
              setHighlightedIndex(0);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={
              dark
                ? 'w-full rounded-lg border border-slate-600 bg-slate-950 py-3 pl-10 pr-10 text-base text-slate-100 placeholder:text-slate-500 focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/30'
                : 'w-full rounded-lg border border-gray-300 bg-white py-3 pl-10 pr-10 text-base focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500'
            }
          />
          {selectedDevice ? (
            <button
              type="button"
              onClick={handleClear}
              className={`absolute right-3 top-1/2 -translate-y-1/2 ${dark ? 'text-slate-500 hover:text-slate-200' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <X className="size-5" />
            </button>
          ) : (
            <ChevronDown
              className={`pointer-events-none absolute right-3 top-1/2 size-5 -translate-y-1/2 transition-transform ${dark ? 'text-slate-500' : 'text-gray-400'} ${isOpen ? 'rotate-180' : ''}`}
            />
          )}
        </div>

        {isOpen && (
          <div
            className={`absolute z-[20] mt-1 max-h-80 w-full overflow-auto rounded-lg border shadow-xl ${
              dark
                ? 'border-slate-600 bg-slate-900 ring-1 ring-slate-700/80'
                : 'border-gray-300 bg-white shadow-lg'
            }`}
          >
            {filteredDevices.length === 0 ? (
              <div className={`px-4 py-3 text-sm ${dark ? 'text-slate-400' : 'text-gray-500'}`}>
                No devices found
              </div>
            ) : (
              Object.entries(filteredByCategory).map(([category, categoryDevices]) => (
                <div key={category}>
                  <div
                    className={`sticky top-0 px-3 py-2 text-xs font-semibold uppercase ${
                      dark ? 'border-b border-slate-700 bg-slate-800/95 text-slate-400' : 'bg-gray-50 text-gray-500'
                    }`}
                  >
                    {category}
                  </div>
                  {categoryDevices.map((device) => {
                    const globalIndex = filteredDevices.indexOf(device);
                    const isCustom = isCustomDevice(device.id);
                    return (
                      <button
                        key={device.id}
                        type="button"
                        onClick={() => handleSelectDevice(device)}
                        className={`relative w-full px-4 py-2 text-left transition-colors ${
                          dark
                            ? globalIndex === highlightedIndex
                              ? 'bg-cyan-950/50 text-slate-50'
                              : 'text-slate-100 hover:bg-slate-800'
                            : globalIndex === highlightedIndex
                              ? 'bg-blue-100'
                              : 'hover:bg-blue-50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className="min-w-0 flex-1">
                            <div className={`font-medium ${dark ? 'text-slate-50' : 'text-gray-900'}`}>
                              {getDeviceDisplayName(device)}
                            </div>
                            <div className={`mt-0.5 text-xs ${dark ? 'text-slate-500' : 'text-gray-500'}`}>
                              {device.ports.length} port{device.ports.length !== 1 ? 's' : ''}
                            </div>
                          </div>
                          {isCustom && (
                            <div className="flex-shrink-0">
                              <Star
                                className={`size-4 fill-green-500 ${dark ? 'text-green-400' : 'text-green-500'}`}
                              />
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {selectedDevice && (
        <div
          className={`mt-2 rounded-lg border p-3 ${
            dark ? 'border-slate-600 bg-slate-950/90' : 'border-gray-200 bg-gray-50'
          }`}
        >
          <div
            className={`mb-2 text-xs font-semibold uppercase ${dark ? 'text-slate-400' : 'text-gray-500'}`}
          >
            Available ports
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedDevice.ports.map((port, idx) => (
              <div
                key={idx}
                className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm ${
                  dark
                    ? 'border-slate-600 bg-slate-900 text-slate-100'
                    : 'border-gray-300 bg-white'
                }`}
              >
                <span
                  className={`inline-block h-2 w-2 rounded-full ${
                    port.direction === 'output'
                      ? 'bg-green-500'
                      : port.direction === 'input'
                        ? 'bg-blue-500'
                        : 'bg-purple-500'
                  }`}
                />
                <span className="font-medium">{port.type}</span>
                {port.label && (
                  <span className={dark ? 'text-slate-400' : 'text-gray-500'}>({port.label})</span>
                )}
                {port.count && port.count > 1 && (
                  <span className={dark ? 'text-slate-500' : 'text-gray-500'}>×{port.count}</span>
                )}
              </div>
            ))}
          </div>
          <div className={`mt-2 flex flex-wrap gap-3 text-xs ${dark ? 'text-slate-500' : 'text-gray-500'}`}>
            <div className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
              Output
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-blue-500" />
              Input
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-purple-500" />
              Both
            </div>
          </div>
        </div>
      )}
    </div>
  );
}