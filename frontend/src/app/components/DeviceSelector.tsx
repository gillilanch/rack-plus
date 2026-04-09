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
}

export function DeviceSelector({
  devices,
  selectedDevice,
  onSelectDevice,
  label,
  placeholder
}: DeviceSelectorProps) {
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
      <label className="text-sm font-medium text-gray-700">
        {label}
      </label>
      <div className="relative" ref={dropdownRef}>
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
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
            className="w-full bg-white border border-gray-300 rounded-lg pl-10 pr-10 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {selectedDevice ? (
            <button
              onClick={handleClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="size-5" />
            </button>
          ) : (
            <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 size-5 text-gray-400 pointer-events-none transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          )}
        </div>

        {/* Dropdown */}
        {isOpen && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-80 overflow-auto">
            {filteredDevices.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-500">
                No devices found
              </div>
            ) : (
              Object.entries(filteredByCategory).map(([category, categoryDevices]) => (
                <div key={category}>
                  <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase bg-gray-50 sticky top-0">
                    {category}
                  </div>
                  {categoryDevices.map((device, idx) => {
                    const globalIndex = filteredDevices.indexOf(device);
                    const isCustom = isCustomDevice(device.id);
                    return (
                      <button
                        key={device.id}
                        onClick={() => handleSelectDevice(device)}
                        className={`w-full text-left px-4 py-2 hover:bg-blue-50 transition-colors relative ${
                          globalIndex === highlightedIndex ? 'bg-blue-100' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">{getDeviceDisplayName(device)}</div>
                            <div className="text-xs text-gray-500 mt-0.5">
                              {device.ports.length} port{device.ports.length !== 1 ? 's' : ''}
                            </div>
                          </div>
                          {isCustom && (
                            <div className="flex-shrink-0">
                              <Star className="size-4 text-green-500 fill-green-500" />
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
        <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Available Ports</div>
          <div className="flex flex-wrap gap-2">
            {selectedDevice.ports.map((port, idx) => (
              <div
                key={idx}
                className="inline-flex items-center gap-1 px-3 py-1 bg-white border border-gray-300 rounded-full text-sm"
              >
                <span className={`inline-block w-2 h-2 rounded-full ${
                  port.direction === 'output' ? 'bg-green-500' :
                  port.direction === 'input' ? 'bg-blue-500' : 'bg-purple-500'
                }`}></span>
                <span className="font-medium">{port.type}</span>
                {port.label && (
                  <span className="text-gray-500">({port.label})</span>
                )}
                {port.count && port.count > 1 && (
                  <span className="text-gray-500">×{port.count}</span>
                )}
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-3 text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-green-500"></span>
              Output
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-blue-500"></span>
              Input
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-purple-500"></span>
              Both
            </div>
          </div>
        </div>
      )}
    </div>
  );
}