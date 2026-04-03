import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toJpeg } from 'html-to-image';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import type { Device } from '../data/equipment';
import { createRack, getRack, saveRack } from '../api/racks';
import { RackConfiguration, RackDevice } from '../types/rack';
import { saveCustomDevice } from '../utils/customDevices';
import { deviceCategoryToManualLabel, mergeBuiltInAndCustomDevices } from '../utils/deviceCatalogSearch';
import { DEFAULT_INCHES_PER_RU } from '../utils/rackUnits';
import { filterPlaceholderRackDevices } from '../utils/rackPlaceholders';
import { AddDeviceModal } from './AddDeviceModal';
import { CSVImport, type CsvImportCompletePayload } from './CSVImport';
import { CsvUnmatchedReviewModal, type CsvUnmatchedQueueItem } from './CsvUnmatchedReviewModal';
import { RackPlannerWorkArea } from './RackPlannerWorkArea';
import { RackDeviceEditor } from './RackDeviceEditor';
import { ManualDeviceAdd } from './ManualDeviceAdd';
import { CurrentRacksModal } from './CurrentRacksModal';
import { SaveRackModal } from './SaveRackModal';
import { CloudOff, ImageDown, Loader2, Printer, Save, Settings } from 'lucide-react';

/** Session-only: each browser tab/session starts fresh; explicit save still persists to the server. */
const RACK_SESSION_KEY = 'rackPlanner.rackId';

function hydrateFromConfig(config: RackConfiguration, setters: {
  setRackName: (v: string) => void;
  setTotalHeight: (v: number) => void;
  setInchesPerRU: (v: number) => void;
  setSlackAllowance: (v: number) => void;
  setConnections: (v: RackConfiguration['connections']) => void;
  setDevices: (v: RackDevice[]) => void;
  setRackId: (v: string) => void;
}) {
  setters.setRackId(config.id);
  setters.setRackName(config.name);
  setters.setTotalHeight(config.totalHeight);
  setters.setInchesPerRU(config.inchesPerRU ?? DEFAULT_INCHES_PER_RU);
  setters.setSlackAllowance(config.slackAllowance);
  setters.setConnections(config.connections);
  setters.setDevices(filterPlaceholderRackDevices(config.devices as RackDevice[]));
}

/**
 * Rack layout MVP: import / manual devices → drag into U grid (variable heights).
 * Connection maps and backend path analysis are deferred (see config/features.ts).
 */
export function RackPlanner() {
  const [rackId, setRackId] = useState<string | null>(null);
  const [rackName, setRackName] = useState('Production Rack 1');
  const [totalHeight, setTotalHeight] = useState(42);
  const [slackAllowance, setSlackAllowance] = useState(0);
  const [inchesPerRU, setInchesPerRU] = useState(DEFAULT_INCHES_PER_RU);
  const [connections, setConnections] = useState<RackConfiguration['connections']>([]);
  const [devices, setDevices] = useState<RackDevice[]>([]);
  const [editingDevice, setEditingDevice] = useState<RackDevice | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [csvUnmatchedQueue, setCsvUnmatchedQueue] = useState<CsvUnmatchedQueueItem[]>([]);
  const [csvReviewOpen, setCsvReviewOpen] = useState(false);
  const [csvAddModalOpen, setCsvAddModalOpen] = useState(false);
  const [csvAddTargetId, setCsvAddTargetId] = useState<string | null>(null);
  const [csvAddPrefillName, setCsvAddPrefillName] = useState('');
  const [currentRacksOpen, setCurrentRacksOpen] = useState(false);
  const [saveRackModalOpen, setSaveRackModalOpen] = useState(false);
  const rackCaptureRef = useRef<HTMLDivElement | null>(null);

  const hydrateSetters = useMemo(
    () => ({
      setRackName,
      setTotalHeight,
      setInchesPerRU,
      setSlackAllowance,
      setConnections,
      setDevices,
      setRackId,
    }),
    [],
  );

  useEffect(() => {
    if (csvUnmatchedQueue.length === 0) {
      setCsvReviewOpen(false);
    }
  }, [csvUnmatchedQueue.length]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadState('loading');
      setLoadError(null);
      try {
        let config: RackConfiguration | null = null;
        const stored = sessionStorage.getItem(RACK_SESSION_KEY);
        if (stored) {
          try {
            config = await getRack(stored);
          } catch {
            sessionStorage.removeItem(RACK_SESSION_KEY);
          }
        }
        if (!config) {
          config = await createRack({
            name: 'New rack',
            totalHeight: 42,
            inchesPerRU: DEFAULT_INCHES_PER_RU,
            slackAllowance: 0,
            devices: [],
            connections: [],
          });
        }
        if (cancelled) return;
        sessionStorage.setItem(RACK_SESSION_KEY, config.id);
        hydrateFromConfig(config, hydrateSetters);
        setLoadState('ready');
      } catch (e) {
        if (cancelled) return;
        setLoadError(e instanceof Error ? e.message : 'Failed to load rack');
        setLoadState('error');
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [hydrateSetters]);

  const handleOpenRackFromLibrary = useCallback(
    async (id: string) => {
      const config = await getRack(id);
      sessionStorage.setItem(RACK_SESSION_KEY, config.id);
      setCsvUnmatchedQueue([]);
      hydrateFromConfig(config, hydrateSetters);
    },
    [hydrateSetters],
  );

  const handleSaveRackUpdateCurrent = useCallback(
    async (name: string) => {
      if (!rackId) throw new Error('No rack loaded');
      const config: RackConfiguration = {
        id: rackId,
        name,
        totalHeight,
        inchesPerRU,
        slackAllowance,
        devices,
        connections,
      };
      const updated = await saveRack(config);
      sessionStorage.setItem(RACK_SESSION_KEY, updated.id);
      hydrateFromConfig(updated, hydrateSetters);
    },
    [rackId, totalHeight, inchesPerRU, slackAllowance, devices, connections, hydrateSetters],
  );

  const handleSaveRackAsNew = useCallback(
    async (name: string) => {
      const created = await createRack({
        name,
        totalHeight,
        inchesPerRU,
        slackAllowance,
        devices,
        connections,
      });
      sessionStorage.setItem(RACK_SESSION_KEY, created.id);
      hydrateFromConfig(created, hydrateSetters);
    },
    [totalHeight, inchesPerRU, slackAllowance, devices, connections, hydrateSetters],
  );

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const handleExportJpg = useCallback(async () => {
    const el = rackCaptureRef.current;
    if (!el) {
      setSaveError('Add at least one device to show the rack diagram before exporting.');
      window.setTimeout(() => setSaveError(null), 4000);
      return;
    }
    setSaveError(null);
    try {
      const dataUrl = await toJpeg(el, {
        quality: 0.92,
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: '#ffffff',
      });
      const safe = rackName.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-') || 'rack';
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `${safe}-rack.jpg`;
      a.click();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Could not export image');
    }
  }, [rackName]);

  const handleReturnFromRack = useCallback((deviceId: string) => {
    setDevices((prev) =>
      prev.map((d) => (d.id === deviceId ? { ...d, rackPosition: undefined } : d)),
    );
  }, []);

  const handleCsvImportComplete = useCallback((payload: CsvImportCompletePayload) => {
    if (payload.matchedDevices.length > 0) {
      setDevices((prev) => [...prev, ...payload.matchedDevices]);
    }
    if (payload.unmatchedItems.length > 0) {
      setCsvUnmatchedQueue((prev) => {
        const seen = new Set(prev.map((p) => p.name.toLowerCase()));
        const next = [...prev];
        for (const u of payload.unmatchedItems) {
          if (!seen.has(u.name.toLowerCase())) {
            seen.add(u.name.toLowerCase());
            next.push(u);
          }
        }
        return next;
      });
      setCsvReviewOpen(true);
    }
  }, []);

  const removeCsvQueueItem = useCallback((id: string) => {
    setCsvUnmatchedQueue((q) => q.filter((x) => x.id !== id));
  }, []);

  const handleCsvReject = useCallback(
    (id: string) => {
      removeCsvQueueItem(id);
    },
    [removeCsvQueueItem],
  );

  const handleCsvAddToRackOnly = useCallback(
    (id: string) => {
      const item = csvUnmatchedQueue.find((x) => x.id === id);
      if (!item) return;
      const rack: RackDevice = {
        id: `imported-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        name: item.name,
        category: item.category as RackDevice['category'],
        heightInU: item.heightInU,
        physicalHeightInches: item.physicalHeightInches,
        ports: [],
      };
      setDevices((prev) => [...prev, rack]);
      removeCsvQueueItem(id);
    },
    [csvUnmatchedQueue, removeCsvQueueItem],
  );

  const handleCsvAddToDatabaseClick = useCallback(
    (id: string) => {
      const item = csvUnmatchedQueue.find((x) => x.id === id);
      if (!item) return;
      setCsvAddTargetId(id);
      setCsvAddPrefillName(item.name);
      setCsvAddModalOpen(true);
    },
    [csvUnmatchedQueue],
  );

  const closeCsvAddModal = useCallback(() => {
    setCsvAddModalOpen(false);
    setCsvAddTargetId(null);
    setCsvAddPrefillName('');
  }, []);

  const handleCsvSaveCustomDevice = useCallback(
    (device: Device) => {
      saveCustomDevice(device);
      const targetId = csvAddTargetId;
      const item = targetId ? csvUnmatchedQueue.find((x) => x.id === targetId) : undefined;
      closeCsvAddModal();
      if (!item) return;
      removeCsvQueueItem(item.id);
      const rack: RackDevice = {
        id: `imported-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        name: device.name,
        category: deviceCategoryToManualLabel(device.category) as RackDevice['category'],
        heightInU: item.heightInU,
        physicalHeightInches: item.physicalHeightInches,
        ports: device.ports?.length ? device.ports : [],
      };
      setDevices((prev) => [...prev, rack]);
    },
    [csvAddTargetId, csvUnmatchedQueue, closeCsvAddModal, removeCsvQueueItem],
  );

  const existingNamesForCsvAdd = useMemo(() => {
    const rack = devices.map((d) => d.name);
    const db = mergeBuiltInAndCustomDevices().map((d) => d.name);
    return [...rack, ...db];
  }, [devices, csvAddModalOpen]);

  const handleAddManualDevice = (deviceData: {
    name: string;
    category: string;
    heightInU: number;
    heightInches?: number;
    ports?: RackDevice['ports'];
  }) => {
    const newDevice: RackDevice = {
      id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      name: deviceData.name,
      category: deviceData.category as RackDevice['category'],
      heightInU: deviceData.heightInU,
      physicalHeightInches: deviceData.heightInches,
      ports: deviceData.ports?.length ? deviceData.ports : [],
    };
    setDevices((prev) => [...prev, newDevice]);
  };

  const handleUpdateDevicePosition = (deviceId: string, position: number) => {
    setDevices((prev) =>
      prev.map((d) => (d.id === deviceId ? { ...d, rackPosition: position } : d)),
    );
  };

  const handleRemoveDevice = (deviceId: string) => {
    setDevices((prev) => prev.filter((d) => d.id !== deviceId));
  };

  const handleSaveDevice = (updatedDevice: RackDevice) => {
    setDevices((prev) => prev.map((d) => (d.id === updatedDevice.id ? updatedDevice : d)));
  };

  const placedDevices = devices.filter((d) => d.rackPosition !== undefined);

  if (loadState === 'loading' || loadState === 'idle') {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white p-8 text-gray-600 shadow-sm">
        <Loader2 className="size-5 animate-spin" />
        Loading rack…
      </div>
    );
  }

  if (loadState === 'error') {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900 shadow-sm">
        <div className="flex items-start gap-3">
          <CloudOff className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-medium">Could not load the rack from the API.</p>
            <p className="mt-1 text-sm opacity-90">{loadError}</p>
            <p className="mt-3 text-sm">
              Start the backend (<code className="rounded bg-amber-100 px-1">cd backend && npm run dev</code>) and
              ensure PostgreSQL is running, then run{' '}
              <code className="rounded bg-amber-100 px-1">npx prisma migrate deploy</code> in{' '}
              <code className="rounded bg-amber-100 px-1">backend/</code>.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="rack-planner-print-area space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <input
              type="text"
              value={rackName}
              onChange={(e) => setRackName(e.target.value)}
              className="-ml-2 border-b-2 border-transparent bg-transparent px-2 text-2xl font-bold text-gray-900 transition-colors hover:border-gray-300 focus:border-blue-500 focus:outline-none"
            />
            <p className="ml-2 mt-1 text-sm text-gray-600">
              Import or add devices, then drag them into the rack. Each row is 1U; device height can be
              multiple U.
            </p>
            {devices.length > 0 && (
              <p className="ml-2 mt-2 text-xs text-gray-500">
                {devices.length} device{devices.length !== 1 ? 's' : ''} · {placedDevices.length} placed
                {placedDevices.length < devices.length && ' · drag unassigned gear onto the rack'}
              </p>
            )}
          </div>
          <div className="no-print flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentRacksOpen(true)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-50"
            >
              Current racks
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-50"
            >
              <Printer className="size-4" />
              Print
            </button>
            <button
              type="button"
              onClick={() => void handleExportJpg()}
              className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-50"
            >
              <ImageDown className="size-4" />
              Export JPG
            </button>
            <button
              type="button"
              onClick={() => setSaveRackModalOpen(true)}
              className="flex items-center gap-2 rounded-lg bg-[#003366] px-4 py-2 text-white transition-colors hover:bg-blue-700"
            >
              <Save className="size-5" />
              Save rack
            </button>
            <button
              type="button"
              onClick={() => setShowSettings(!showSettings)}
              className="flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-200"
            >
              <Settings className="size-5" />
              Settings
            </button>
          </div>
        </div>
        {saveError && (
          <p className="no-print text-sm text-red-600" role="alert">
            {saveError}
          </p>
        )}

        {showSettings && (
          <div className="no-print rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 font-semibold text-gray-900">Rack size</h3>
            <div className="grid max-w-md gap-6 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Total rack height (U)</label>
                <input
                  type="number"
                  value={totalHeight}
                  onChange={(e) => setTotalHeight(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  min={1}
                  max={100}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  {(totalHeight * inchesPerRU).toFixed(2)}&quot; tall (using inches/RU below)
                </p>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Inches per 1U (RU)</label>
                <input
                  type="number"
                  value={inchesPerRU}
                  onChange={(e) => {
                    const n = parseFloat(e.target.value);
                    if (!Number.isNaN(n) && n > 0 && n <= 48) setInchesPerRU(n);
                  }}
                  min={0.01}
                  max={48}
                  step={0.01}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500">Standard EIA rack is 1.75&quot; per U.</p>
              </div>
            </div>
          </div>
        )}

        {devices.length === 0 && (
          <div className="space-y-6">
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <CSVImport
                onCsvImportComplete={handleCsvImportComplete}
                pendingUnmatchedCount={csvUnmatchedQueue.length}
                onReopenCsvReview={() => setCsvReviewOpen(true)}
              />
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="mb-4 font-semibold text-gray-900">Or add manually</h3>
              <ManualDeviceAdd onAddDevice={handleAddManualDevice} />
            </div>
          </div>
        )}

        {devices.length > 0 && (
          <RackPlannerWorkArea
            devices={devices}
            totalHeight={totalHeight}
            inchesPerRU={inchesPerRU}
            rackCaptureRef={rackCaptureRef}
            onEditDevice={setEditingDevice}
            onRemoveDevice={handleRemoveDevice}
            onReturnFromRack={handleReturnFromRack}
            onCsvImportComplete={handleCsvImportComplete}
            pendingCsvUnmatchedCount={csvUnmatchedQueue.length}
            onReopenCsvReview={() => setCsvReviewOpen(true)}
            onAddManualDevice={handleAddManualDevice}
            onUpdateDevicePosition={handleUpdateDevicePosition}
          />
        )}
      </div>

      <CurrentRacksModal
        isOpen={currentRacksOpen}
        onClose={() => setCurrentRacksOpen(false)}
        currentRackId={rackId}
        onOpenRack={handleOpenRackFromLibrary}
      />
      <SaveRackModal
        isOpen={saveRackModalOpen}
        onClose={() => setSaveRackModalOpen(false)}
        initialName={rackName}
        hasRackId={Boolean(rackId)}
        onUpdateCurrent={handleSaveRackUpdateCurrent}
        onSaveAsNew={handleSaveRackAsNew}
      />

      <RackDeviceEditor
        device={editingDevice}
        isOpen={editingDevice !== null}
        onClose={() => setEditingDevice(null)}
        onSave={handleSaveDevice}
        inchesPerRU={inchesPerRU}
      />

      <CsvUnmatchedReviewModal
        isOpen={csvReviewOpen && csvUnmatchedQueue.length > 0}
        items={csvUnmatchedQueue}
        onClose={() => setCsvReviewOpen(false)}
        onReject={handleCsvReject}
        onAddToRackOnly={handleCsvAddToRackOnly}
        onAddToDatabase={handleCsvAddToDatabaseClick}
      />

      <AddDeviceModal
        isOpen={csvAddModalOpen}
        onClose={closeCsvAddModal}
        onSaveDevice={handleCsvSaveCustomDevice}
        existingDeviceNames={existingNamesForCsvAdd}
        prefillName={csvAddPrefillName}
      />
    </DndProvider>
  );
}
