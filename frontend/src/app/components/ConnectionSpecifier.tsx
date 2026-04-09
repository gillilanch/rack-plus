import { useState, useRef } from 'react';
import { Upload, Plus, X, FileText, Download, List } from 'lucide-react';
import Papa from 'papaparse';
import { RackDevice } from '../types/rack';
import { getDeviceDisplayName } from '../utils/deviceDisplay';

export interface ConnectionSpec {
  fromDeviceName: string;
  toDeviceName: string;
  priority?: number; // Higher priority connections are generated first
}

interface ConnectionSpecifierProps {
  devices: RackDevice[];
  specs: ConnectionSpec[];
  onSave: (specs: ConnectionSpec[]) => void;
}

export function ConnectionSpecifier({ devices, specs: initialSpecs, onSave }: ConnectionSpecifierProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [specs, setSpecs] = useState<ConnectionSpec[]>(initialSpecs);
  const [fromDevice, setFromDevice] = useState('');
  const [toDevice, setToDevice] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDownloadTemplate = () => {
    const template = `fromDevice,toDevice,priority
Camera A,Switch B,1
Blackmagic ATEM Mini,Mac Mini,2
Mac Mini,Dell Monitor,3`;

    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'connection_specifications.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const importedSpecs: ConnectionSpec[] = [];
          
          results.data.forEach((row: any) => {
            if (row.fromDevice && row.toDevice) {
              importedSpecs.push({
                fromDeviceName: row.fromDevice.trim(),
                toDeviceName: row.toDevice.trim(),
                priority: row.priority ? parseInt(row.priority) : undefined
              });
            }
          });

          if (importedSpecs.length === 0) {
            setError('No valid connections found. Check that columns are named "fromDevice" and "toDevice".');
            return;
          }

          setSpecs([...specs, ...importedSpecs]);
        } catch (err) {
          setError(`Error processing file: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      },
      error: (error) => {
        setError(`Failed to parse CSV: ${error.message}`);
      }
    });

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleAddSpec = () => {
    if (!fromDevice || !toDevice) return;
    
    setSpecs([...specs, {
      fromDeviceName: fromDevice,
      toDeviceName: toDevice
    }]);
    
    setFromDevice('');
    setToDevice('');
  };

  const handleRemoveSpec = (index: number) => {
    setSpecs(specs.filter((_, i) => i !== index));
  };

  const handleApply = () => {
    onSave(specs);
    setIsOpen(false);
  };

  const placedDeviceNames = devices
    .filter((d) => d.rackPosition !== undefined)
    .map((d) => getDeviceDisplayName(d));

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium shadow-md"
      >
        <List className="size-5" />
        Specify Connections
      </button>
    );
  }

  return (
    <div className="bg-white border border-gray-300 rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-gray-900">Connection Specifications</h3>
          <p className="text-sm text-gray-600 mt-1">
            Define which devices should connect to each other
          </p>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="text-gray-400 hover:text-gray-600"
        >
          <X className="size-6" />
        </button>
      </div>

      {/* Import from CSV */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium text-gray-900 text-sm">Import from CSV</h4>
          <button
            onClick={handleDownloadTemplate}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
          >
            <Download className="size-4" />
            Template
          </button>
        </div>
        
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.txt"
          onChange={handleFileImport}
          className="hidden"
        />
        
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm w-full justify-center"
        >
          <Upload className="size-4" />
          Import Connection List
        </button>

        {error && (
          <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
            {error}
          </div>
        )}
      </div>

      {/* Manual Entry */}
      <div className="mb-6">
        <h4 className="font-medium text-gray-900 text-sm mb-3">Add Connection Manually</h4>
        <div className="grid grid-cols-[1fr,auto,1fr,auto] gap-2 items-end">
          <div>
            <label className="block text-xs text-gray-600 mb-1">From Device</label>
            <select
              value={fromDevice}
              onChange={(e) => setFromDevice(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select device...</option>
              {placedDeviceNames.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>

          <div className="pb-2 text-gray-400">→</div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">To Device</label>
            <select
              value={toDevice}
              onChange={(e) => setToDevice(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select device...</option>
              {placedDeviceNames.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>

          <button
            onClick={handleAddSpec}
            disabled={!fromDevice || !toDevice}
            className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            <Plus className="size-4" />
          </button>
        </div>
      </div>

      {/* Current Specifications */}
      {specs.length > 0 && (
        <div className="mb-6">
          <h4 className="font-medium text-gray-900 text-sm mb-3">
            Current Specifications ({specs.length})
          </h4>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {specs.map((spec, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
              >
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium">{spec.fromDeviceName}</span>
                  <span className="text-gray-400">→</span>
                  <span className="font-medium">{spec.toDeviceName}</span>
                  {spec.priority && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                      Priority: {spec.priority}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => handleRemoveSpec(index)}
                  className="text-red-500 hover:text-red-700 p-1"
                >
                  <X className="size-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info */}
      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
        <FileText className="size-4 inline mr-1" />
        Specified connections will be prioritized when generating the connection map. The system will automatically determine cable types and adapters based on device I/O ports.
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleApply}
          disabled={specs.length === 0}
          className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
        >
          Apply Specifications
        </button>
        <button
          onClick={() => {
            setSpecs([]);
            setFromDevice('');
            setToDevice('');
            setError(null);
          }}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
        >
          Clear All
        </button>
      </div>
    </div>
  );
}