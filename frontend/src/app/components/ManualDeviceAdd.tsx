import { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import type { Device, Port } from '../data/equipment';
import { FOX_EQUIPMENT_CHANGED_EVENT, saveCustomDevice } from '../utils/customDevices';
import { getDeviceDisplayName } from '../utils/deviceDisplay';
import {
  deviceCategoryToManualLabel,
  findExactDeviceByName,
  manualCategoryToDeviceCategory,
  mergeBuiltInAndCustomDevices,
  searchDevicesByName,
} from '../utils/deviceCatalogSearch';

/** Local name for the saved custom device list (browser storage). */
const FOX_EQUIPMENT_DATABASE_LABEL = 'Fox equipment database';

interface ManualDeviceAddProps {
  onAddDevice: (device: {
    manufacturer: string;
    model: string;
    name: string;
    category: string;
    heightInU: number;
    heightInches?: number;
    ports?: Port[];
  }) => void;
  /** Matches Cable Identification System palette when set to cable. */
  uiVariant?: 'default' | 'cable';
}

function deviceIdentityLabel(d: Device): string {
  return getDeviceDisplayName({
    name: d.name,
    manufacturer: d.manufacturer,
    model: d.model,
  });
}

export function ManualDeviceAdd({ onAddDevice, uiVariant = 'default' }: ManualDeviceAddProps) {
  const cable = uiVariant === 'cable';
  const [isOpen, setIsOpen] = useState(false);
  const [manufacturer, setManufacturer] = useState('');
  const [model, setModel] = useState('');
  const [category, setCategory] = useState('Interface');
  const [heightValue, setHeightValue] = useState('1');
  const [heightUnit, setHeightUnit] = useState<'U' | 'inches'>('U');
  const [devicePool, setDevicePool] = useState<Device[]>(() => mergeBuiltInAndCustomDevices());
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [chosenCatalogDevice, setChosenCatalogDevice] = useState<Device | null>(null);
  const [showFoxPrompt, setShowFoxPrompt] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const manufacturerRef = useRef<HTMLInputElement>(null);

  const refreshPool = useCallback(() => {
    setDevicePool(mergeBuiltInAndCustomDevices());
  }, []);

  useEffect(() => {
    if (isOpen) refreshPool();
  }, [isOpen, refreshPool]);

  useEffect(() => {
    const onFoxChanged = () => refreshPool();
    window.addEventListener(FOX_EQUIPMENT_CHANGED_EVENT, onFoxChanged);
    return () => window.removeEventListener(FOX_EQUIPMENT_CHANGED_EVENT, onFoxChanged);
  }, [refreshPool]);

  const typedLabel = getDeviceDisplayName({
    name: '',
    manufacturer,
    model,
  });

  useEffect(() => {
    if (
      chosenCatalogDevice &&
      deviceIdentityLabel(chosenCatalogDevice).trim().toLowerCase() !== typedLabel.trim().toLowerCase()
    ) {
      setChosenCatalogDevice(null);
    }
  }, [manufacturer, model, chosenCatalogDevice, typedLabel]);

  const catalogQuery = [manufacturer, model].map((s) => s.trim()).filter(Boolean).join(' ');
  const suggestions = searchDevicesByName(catalogQuery, devicePool, 12);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [catalogQuery]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setSuggestionsOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const categories = [
    'Camera',
    'Interface',
    'Monitor',
    'Audio',
    'Laptop',
    'Recording',
    'Network',
    'Power',
    'Other',
  ];

  const computeHeights = () => {
    const numericHeight = parseFloat(heightValue) || 1;
    if (heightUnit === 'inches') {
      const heightInches = numericHeight;
      return {
        heightInU: Math.max(1, Math.ceil(numericHeight / 1.75)),
        heightInches,
      };
    }
    return { heightInU: Math.max(1, numericHeight), heightInches: undefined as number | undefined };
  };

  const finishAdd = useCallback(
    (saveToFoxDb: boolean) => {
      const mfr = manufacturer.trim();
      const mdl = model.trim();
      if (!mfr || !mdl) return;

      const displayName = getDeviceDisplayName({ name: '', manufacturer: mfr, model: mdl });
      const { heightInU, heightInches } = computeHeights();
      const exact = findExactDeviceByName(displayName, devicePool);
      const match =
        chosenCatalogDevice &&
        deviceIdentityLabel(chosenCatalogDevice).trim().toLowerCase() === displayName.trim().toLowerCase()
          ? chosenCatalogDevice
          : exact;

      if (saveToFoxDb && !findExactDeviceByName(displayName, devicePool)) {
        saveCustomDevice({
          id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          name: displayName,
          manufacturer: mfr,
          model: mdl,
          category: manualCategoryToDeviceCategory(category),
          ports: [],
        });
        refreshPool();
      }

      onAddDevice({
        manufacturer: mfr,
        model: mdl,
        name: displayName,
        category: match ? deviceCategoryToManualLabel(match.category) : category,
        heightInU,
        heightInches,
        ports: match && match.ports.length > 0 ? match.ports : undefined,
      });

      setManufacturer('');
      setModel('');
      setCategory('Interface');
      setHeightValue('1');
      setHeightUnit('U');
      setChosenCatalogDevice(null);
      setShowFoxPrompt(false);
      setSuggestionsOpen(false);
      setIsOpen(false);
    },
    [manufacturer, model, category, heightValue, heightUnit, devicePool, chosenCatalogDevice, onAddDevice, refreshPool],
  );

  const trySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manufacturer.trim() || !model.trim() || showFoxPrompt) return;

    const displayName = getDeviceDisplayName({
      name: '',
      manufacturer,
      model,
    });
    const exact = findExactDeviceByName(displayName, devicePool);
    const pickedMatches =
      chosenCatalogDevice &&
      deviceIdentityLabel(chosenCatalogDevice).trim().toLowerCase() === displayName.trim().toLowerCase();

    if (pickedMatches || exact) {
      finishAdd(false);
      return;
    }

    setShowFoxPrompt(true);
    setSuggestionsOpen(false);
  };

  const applySuggestion = (d: Device) => {
    const mfr = (d.manufacturer ?? '').trim();
    const mdl = (d.model ?? '').trim();
    if (mfr && mdl) {
      setManufacturer(mfr);
      setModel(mdl);
    } else {
      setManufacturer('');
      setModel(d.name.trim());
    }
    setCategory(deviceCategoryToManualLabel(d.category));
    setChosenCatalogDevice(d);
    setSuggestionsOpen(false);
    manufacturerRef.current?.focus();
  };

  const onSearchKeyDown = (e: React.KeyboardEvent) => {
    if (!suggestionsOpen || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && suggestionsOpen) {
      e.preventDefault();
      applySuggestion(suggestions[highlightedIndex]);
    } else if (e.key === 'Escape') {
      setSuggestionsOpen(false);
    }
  };

  const handleClosePanel = () => {
    setIsOpen(false);
    setShowFoxPrompt(false);
    setSuggestionsOpen(false);
    setChosenCatalogDevice(null);
    setManufacturer('');
    setModel('');
    setCategory('Interface');
    setHeightValue('1');
    setHeightUnit('U');
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`flex items-center gap-2 rounded-lg bg-[#003366] font-semibold text-white shadow-md transition-colors ${
          cable
            ? 'px-6 py-3 text-base hover:bg-[#004080] sm:text-lg'
            : 'px-4 py-2 text-base hover:bg-blue-700'
        }`}
      >
        <Plus className="size-5" />
        Add Device Manually
      </button>
    );
  }

  return (
    <div
      className={`rounded-xl border bg-white p-4 shadow-md ${
        cable ? 'border-2 border-slate-200' : 'border border-gray-300'
      }`}
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className={`font-semibold ${cable ? 'text-[#003366]' : 'text-gray-900'}`}>Add device manually</h3>
        <button type="button" onClick={handleClosePanel} className="text-gray-400 hover:text-gray-600">
          <X className="size-5" />
        </button>
      </div>

      <form onSubmit={trySubmit} className="space-y-4">
        <div ref={wrapRef} className="relative space-y-3">
          <p className="text-xs text-gray-500">
            Type a manufacturer (e.g. <span className="font-medium">Yamaha</span>) to see all matching catalog gear,
            then pick or enter the model.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="manual-device-mfr" className="mb-1 block text-sm font-medium text-gray-700">
                Device manufacturer *
              </label>
              <input
                ref={manufacturerRef}
                id="manual-device-mfr"
                type="text"
                value={manufacturer}
                onChange={(e) => {
                  setManufacturer(e.target.value);
                  setSuggestionsOpen(true);
                }}
                onFocus={() => setSuggestionsOpen(true)}
                onKeyDown={onSearchKeyDown}
                autoComplete="organization"
                placeholder="e.g. Yamaha, Sony"
                required
                className={`w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:outline-none focus:ring-2 ${
                  cable ? 'focus:ring-[#003366]' : 'focus:ring-blue-500'
                }`}
              />
            </div>
            <div>
              <label htmlFor="manual-device-model" className="mb-1 block text-sm font-medium text-gray-700">
                Model / model number *
              </label>
              <input
                id="manual-device-model"
                type="text"
                value={model}
                onChange={(e) => {
                  setModel(e.target.value);
                  setSuggestionsOpen(true);
                }}
                onFocus={() => setSuggestionsOpen(true)}
                onKeyDown={onSearchKeyDown}
                autoComplete="off"
                placeholder="e.g. MG10XU, FX6"
                required
                className={`w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:outline-none focus:ring-2 ${
                  cable ? 'focus:ring-[#003366]' : 'focus:ring-blue-500'
                }`}
              />
            </div>
          </div>
          {typedLabel && (
            <p className="text-xs text-gray-600">
              On rack: <span className="font-medium text-gray-900">{typedLabel}</span>
            </p>
          )}
          {chosenCatalogDevice && (
            <p className="text-xs text-green-700">
              Using catalog entry: ports and category from “{deviceIdentityLabel(chosenCatalogDevice)}”.
            </p>
          )}
          {suggestionsOpen && catalogQuery.length > 0 && suggestions.length > 0 && (
            <ul
              id="manual-device-suggestions"
              role="listbox"
              className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg sm:max-w-xl"
            >
              {suggestions.map((d, idx) => (
                <li key={d.id} role="option" aria-selected={idx === highlightedIndex}>
                  <button
                    type="button"
                    className={`w-full px-3 py-2 text-left text-sm ${
                      cable
                        ? idx === highlightedIndex
                          ? 'bg-red-50'
                          : 'hover:bg-slate-50'
                        : idx === highlightedIndex
                          ? 'bg-blue-50'
                          : 'hover:bg-blue-50'
                    }`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applySuggestion(d)}
                  >
                    <span className="font-medium text-gray-900">{deviceIdentityLabel(d)}</span>
                    <span className="ml-2 text-xs text-gray-500">{deviceCategoryToManualLabel(d.category)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={`w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 ${
              cable ? 'focus:ring-[#003366]' : 'focus:ring-blue-500'
            }`}
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Height</label>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              value={heightValue}
              onChange={(e) => setHeightValue(e.target.value)}
              min={heightUnit === 'U' ? '1' : '0.1'}
              step={heightUnit === 'U' ? '1' : '0.25'}
              required
              className={`w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 ${
                cable ? 'focus:ring-[#003366]' : 'focus:ring-blue-500'
              }`}
            />
            <select
              value={heightUnit}
              onChange={(e) => setHeightUnit(e.target.value as 'U' | 'inches')}
              className={`w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 ${
                cable ? 'focus:ring-[#003366]' : 'focus:ring-blue-500'
              }`}
            >
              <option value="U">Rack units (U)</option>
              <option value="inches">Inches</option>
            </select>
          </div>
          {heightUnit === 'inches' && (
            <p className="mt-1 text-xs text-gray-500">≈ {Math.ceil(parseFloat(heightValue || '0') / 1.75)}U</p>
          )}
        </div>

        {showFoxPrompt && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            <p className="font-medium text-amber-900">No exact match in the device list</p>
            <p className="mt-2 text-amber-900/90">
              “{typedLabel}” is not identical to any built-in or saved model. Add it to the{' '}
              <span className="font-medium">{FOX_EQUIPMENT_DATABASE_LABEL}</span> (this browser) so it appears in future
              autocomplete?
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => finishAdd(true)}
                className="rounded-lg bg-amber-700 px-4 py-2 font-medium text-white hover:bg-amber-800"
              >
                Yes, save to {FOX_EQUIPMENT_DATABASE_LABEL}
              </button>
              <button
                type="button"
                onClick={() => finishAdd(false)}
                className="rounded-lg bg-white px-4 py-2 font-medium text-amber-900 ring-1 ring-amber-300 hover:bg-amber-100/50"
              >
                No, add to rack only
              </button>
            </div>
          </div>
        )}

        {!showFoxPrompt && (
          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              className={`flex-1 rounded-lg px-4 py-2 font-medium text-white ${
                cable ? 'bg-[#003366] hover:bg-[#004080]' : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              Add device
            </button>
            <button
              type="button"
              onClick={handleClosePanel}
              className={`rounded-lg px-4 py-2 ${
                cable
                  ? 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Cancel
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
