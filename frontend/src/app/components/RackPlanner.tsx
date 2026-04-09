import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useBlocker } from 'react-router';
import type { Blocker } from 'react-router';
import { toJpeg } from 'html-to-image';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import type { Device } from '../data/equipment';
import { createRack, getRack, saveRack } from '../api/racks';
import type { RackConnection, RackConfiguration, RackDevice } from '../types/rack';
import {
  connectionFromManualPorts,
  findFirstUnusedMatchingPortPair,
  hasDirectedPortConnection,
} from '../utils/rackConnectionHelpers';
import { saveCustomDevice } from '../utils/customDevices';
import { deviceCategoryToManualLabel, mergeBuiltInAndCustomDevices } from '../utils/deviceCatalogSearch';
import { DEFAULT_INCHES_PER_RU, DEFAULT_RACK_WIDTH_INCHES } from '../utils/rackUnits';
import {
  getDeviceDisplayName,
  inferManufacturerModelFromLegacyName,
  normalizeRackDeviceIdentity,
} from '../utils/deviceDisplay';
import { filterPlaceholderRackDevices } from '../utils/rackPlaceholders';
import { AddDeviceModal } from './AddDeviceModal';
import { CSVImport, type CsvImportCompletePayload } from './CSVImport';
import { ManualDeviceAdd } from './ManualDeviceAdd';
import { CsvUnmatchedReviewModal, type CsvUnmatchedQueueItem } from './CsvUnmatchedReviewModal';
import { RackPlannerWorkArea } from './RackPlannerWorkArea';
import { RackDeviceEditor } from './RackDeviceEditor';
import { RackDualDeviceEditor } from './RackDualDeviceEditor';
import { CurrentRacksModal } from './CurrentRacksModal';
import { SaveRackModal, type SaveRackMode } from './SaveRackModal';
import type { RackSaveAttribution } from '../api/racks';
import { AlertTriangle, CloudOff, ImageDown, Loader2, Printer, Save, Settings } from 'lucide-react';
import { toast } from 'sonner';
import {
  clampDeviceWidthToRack,
  clampHorizontalOffset,
  getDeviceWidthInches,
  getHorizontalOffsetInches,
  normalizeDeviceHorizontalFields,
  validateAllPlacedDevices,
  validateSideBySidePlacement,
} from '../utils/rackDevicePlacement';

/** Session-only: each browser tab/session starts fresh; explicit save still persists to the server. */
const RACK_SESSION_KEY = 'rackPlanner.rackId';

const rackSizeInputPlainClass =
  'w-full rounded-lg border border-slate-300 px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#003366]';

const rackSizeInputCableClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-center text-lg font-semibold tabular-nums tracking-tight text-[#003366] shadow-inner focus:border-[#003366] focus:outline-none focus:ring-2 focus:ring-[#003366]/30 sm:text-left';

function RackSizeFields(props: {
  totalHeight: number;
  setTotalHeight: (v: number) => void;
  rackWidthInches: number;
  setRackWidthInches: (v: number) => void;
  inchesPerRU: number;
  setInchesPerRU: (v: number) => void;
  markRackDirty: () => void;
  /** Omit on secondary panels where context is already in the section header. */
  subtitle?: string | null;
  /** Cable Identification style: spec-style panel, balanced display + UI fonts. */
  visual?: 'plain' | 'cable';
  /** When visual=cable: tighter panel inside an existing settings card (no full-bleed shell). */
  cableLayout?: 'page' | 'embedded';
}) {
  const {
    totalHeight,
    setTotalHeight,
    rackWidthInches,
    setRackWidthInches,
    inchesPerRU,
    setInchesPerRU,
    markRackDirty,
    subtitle = 'Set total U, rack width, and inches per RU before you import a list or place gear.',
    visual = 'plain',
    cableLayout = 'page',
  } = props;

  const inputClass = visual === 'cable' ? rackSizeInputCableClass : rackSizeInputPlainClass;

  const fieldsGrid = (
    <div
      className={`grid sm:grid-cols-3 ${visual === 'cable' ? 'gap-4' : 'max-w-2xl gap-6'}`}
    >
      <div
        className={
          visual === 'cable'
            ? 'rounded-xl border border-slate-200/90 bg-gradient-to-b from-white to-slate-50/90 p-4 shadow-sm'
            : ''
        }
      >
        <label
          className={`mb-2 block ${visual === 'cable' ? 'font-cable-display text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500' : 'text-sm font-medium text-slate-800'}`}
        >
          Total rack height (U)
        </label>
        <input
          type="number"
          value={totalHeight}
          onChange={(e) => {
            setTotalHeight(Math.max(1, parseInt(e.target.value, 10) || 1));
            markRackDirty();
          }}
          min={1}
          max={100}
          className={inputClass}
        />
        <p
          className={`mt-2 text-xs leading-snug ${visual === 'cable' ? 'font-cable-ui text-slate-500' : 'text-slate-500'}`}
        >
          {(totalHeight * inchesPerRU).toFixed(2)}&quot; tall (using inches/RU below)
        </p>
      </div>
      <div
        className={
          visual === 'cable'
            ? 'rounded-xl border border-slate-200/90 bg-gradient-to-b from-white to-slate-50/90 p-4 shadow-sm'
            : ''
        }
      >
        <label
          className={`mb-2 block ${visual === 'cable' ? 'font-cable-display text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500' : 'text-sm font-medium text-slate-800'}`}
        >
          Rack width (inches)
        </label>
        <input
          type="number"
          value={rackWidthInches}
          onChange={(e) => {
            const n = parseFloat(e.target.value);
            if (!Number.isNaN(n) && n > 0 && n <= 120) {
              setRackWidthInches(n);
              markRackDirty();
            }
          }}
          min={0.01}
          max={120}
          step={0.25}
          className={inputClass}
        />
        <p
          className={`mt-2 text-xs leading-snug ${visual === 'cable' ? 'font-cable-ui text-slate-500' : 'text-slate-500'}`}
        >
          Typical 19&quot; equipment width (EIA). Diagram scales with height.
        </p>
      </div>
      <div
        className={
          visual === 'cable'
            ? 'rounded-xl border border-slate-200/90 bg-gradient-to-b from-white to-slate-50/90 p-4 shadow-sm'
            : ''
        }
      >
        <label
          className={`mb-2 block ${visual === 'cable' ? 'font-cable-display text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500' : 'text-sm font-medium text-slate-800'}`}
        >
          Inches per 1U (RU)
        </label>
        <input
          type="number"
          value={inchesPerRU}
          onChange={(e) => {
            const n = parseFloat(e.target.value);
            if (!Number.isNaN(n) && n > 0 && n <= 48) {
              setInchesPerRU(n);
              markRackDirty();
            }
          }}
          min={0.01}
          max={48}
          step={0.01}
          className={inputClass}
        />
        <p
          className={`mt-2 text-xs leading-snug ${visual === 'cable' ? 'font-cable-ui text-slate-500' : 'text-slate-500'}`}
        >
          Standard EIA rack is 1.75&quot; per U.
        </p>
      </div>
    </div>
  );

  if (visual === 'plain') {
    return (
      <>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#CC0000]">Rack size</p>
        {subtitle != null && subtitle !== '' && (
          <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
        )}
        <div className="mt-4">{fieldsGrid}</div>
      </>
    );
  }

  const shellClass =
    cableLayout === 'embedded'
      ? 'overflow-hidden rounded-xl border-2 border-slate-200 bg-white shadow-md'
      : 'overflow-hidden rounded-2xl border-2 border-slate-200 bg-white shadow-[0_6px_32px_-8px_rgba(0,51,102,0.18)]';

  return (
    <div className={`font-cable-ui ${shellClass}`}>
      <div className="flex min-w-0 gap-0">
        <div
          className="w-1.5 shrink-0 bg-gradient-to-b from-[#CC0000] via-[#003366] to-[#004080]"
          aria-hidden
        />
        <div className="min-w-0 flex-1 px-5 py-5 sm:px-6 sm:py-6">
          <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-cable-display text-[0.65rem] font-bold uppercase tracking-[0.32em] text-[#CC0000]">
                Rack size
              </p>
              {cableLayout === 'page' ? (
                <p className="font-cable-display mt-1 text-xl font-bold tracking-tight text-[#003366] sm:text-2xl">
                  Physical footprint
                </p>
              ) : (
                <p className="font-cable-display mt-1 text-lg font-bold tracking-tight text-[#003366]">
                  Dimensions
                </p>
              )}
            </div>
            <p className="font-cable-display text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
              EIA · diagram scale
            </p>
          </div>
          {subtitle != null && subtitle !== '' && (
            <p className="font-cable-ui mt-4 max-w-2xl text-sm leading-relaxed text-slate-600">{subtitle}</p>
          )}
          <div className="mt-5">{fieldsGrid}</div>
        </div>
      </div>
    </div>
  );
}

function hydrateFromConfig(config: RackConfiguration, setters: {
  setRackName: (v: string) => void;
  setTotalHeight: (v: number) => void;
  setInchesPerRU: (v: number) => void;
  setRackWidthInches: (v: number) => void;
  setSlackAllowance: (v: number) => void;
  setConnections: (v: RackConfiguration['connections']) => void;
  setDevices: (v: RackDevice[]) => void;
  setRackId: (v: string) => void;
}) {
  setters.setRackId(config.id);
  setters.setRackName(config.name);
  setters.setTotalHeight(config.totalHeight);
  setters.setInchesPerRU(config.inchesPerRU ?? DEFAULT_INCHES_PER_RU);
  setters.setRackWidthInches(config.rackWidthInches ?? DEFAULT_RACK_WIDTH_INCHES);
  setters.setSlackAllowance(config.slackAllowance);
  setters.setConnections(config.connections);
  setters.setDevices(filterPlaceholderRackDevices(config.devices as RackDevice[]));
}

/**
 * Rack layout MVP: import / manual devices → drag into U grid (variable heights).
 * Connection maps and backend path analysis are deferred (see config/features.ts).
 */
type RackPlannerProps = {
  initialOpenRackLibrary?: boolean;
  /** When set (e.g. from /edit), load this rack instead of session / new rack. */
  initialRackIdToLoad?: string;
  /** When true (e.g. /rack?new=1), ignore session and create a fresh empty rack. */
  forceNewRack?: boolean;
};

export function RackPlanner({
  initialOpenRackLibrary = false,
  initialRackIdToLoad,
  forceNewRack = false,
}: RackPlannerProps = {}) {
  const [rackId, setRackId] = useState<string | null>(null);
  const [rackName, setRackName] = useState('Production Rack 1');
  const [totalHeight, setTotalHeight] = useState(42);
  const [slackAllowance, setSlackAllowance] = useState(0);
  const [inchesPerRU, setInchesPerRU] = useState(DEFAULT_INCHES_PER_RU);
  const [rackWidthInches, setRackWidthInches] = useState(DEFAULT_RACK_WIDTH_INCHES);
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
  const [currentRacksOpen, setCurrentRacksOpen] = useState(initialOpenRackLibrary);
  const [saveRackModalOpen, setSaveRackModalOpen] = useState(false);
  const [portMismatch, setPortMismatch] = useState<{
    from: RackDevice;
    to: RackDevice;
    extra: number;
  } | null>(null);
  const [dualDevices, setDualDevices] = useState<{ a: RackDevice; b: RackDevice } | null>(null);
  const pendingCableRef = useRef<{ fromId: string; toId: string; extra: number } | null>(null);
  const rackCaptureRef = useRef<HTMLDivElement | null>(null);
  const [rackDirty, setRackDirty] = useState(false);
  const pendingLeaveAfterSaveRef = useRef(false);
  const blockerRef = useRef<Blocker | null>(null);

  const blocker = useBlocker(
    useCallback(
      ({ currentLocation, nextLocation }) => {
        if (!rackDirty || loadState !== 'ready') return false;
        if (currentLocation.pathname !== '/rack') return false;
        return (
          nextLocation.pathname !== '/rack' || nextLocation.search !== currentLocation.search
        );
      },
      [rackDirty, loadState],
    ),
  );
  blockerRef.current = blocker;

  const markRackDirty = useCallback(() => setRackDirty(true), []);

  const completeSaveLifecycle = useCallback(() => {
    setRackDirty(false);
    if (pendingLeaveAfterSaveRef.current) {
      pendingLeaveAfterSaveRef.current = false;
      window.setTimeout(() => {
        const b = blockerRef.current;
        if (b && b.state === 'blocked') b.proceed();
      }, 0);
    }
  }, []);

  const rackExportContext = useMemo(
    () => ({
      placedDevices: devices.filter((d) => d.rackPosition !== undefined),
      connections,
    }),
    [devices, connections],
  );

  const handleAddConnection = useCallback(
    (c: RackConnection) => {
      setConnections((prev) => {
        if (
          hasDirectedPortConnection(
            prev,
            c.fromDeviceId,
            c.toDeviceId,
            c.fromPort,
            c.toPort,
          )
        ) {
          return prev;
        }
        return [...prev, c];
      });
      markRackDirty();
    },
    [markRackDirty],
  );

  const handleRemoveConnection = useCallback(
    (connectionId: string) => {
      setConnections((prev) => prev.filter((x) => x.id !== connectionId));
      markRackDirty();
    },
    [markRackDirty],
  );

  const handlePortMismatch = useCallback(
    (p: { from: RackDevice; to: RackDevice; extraSlackInches: number }) => {
      setPortMismatch({ from: p.from, to: p.to, extra: p.extraSlackInches });
    },
    [],
  );

  const handlePortMismatchYes = useCallback(() => {
    if (!portMismatch) return;
    pendingCableRef.current = {
      fromId: portMismatch.from.id,
      toId: portMismatch.to.id,
      extra: portMismatch.extra,
    };
    setDualDevices({ a: portMismatch.from, b: portMismatch.to });
    setPortMismatch(null);
  }, [portMismatch]);

  const handlePortMismatchNo = useCallback(() => {
    setPortMismatch(null);
  }, []);

  const handleDualSave = useCallback(
    (a: RackDevice, b: RackDevice) => {
      const rw = rackWidthInches > 0 ? rackWidthInches : DEFAULT_RACK_WIDTH_INCHES;
      const na = normalizeDeviceHorizontalFields(a, rw);
      const nb = normalizeDeviceHorizontalFields(b, rw);
      let applied = false;
      let placementError: string | null = null;
      setDevices((prev) => {
        const next = prev.map((d) => (d.id === na.id ? na : d.id === nb.id ? nb : d));
        const v = validateAllPlacedDevices(next, rw);
        if (!v.ok) {
          placementError = v.message;
          return prev;
        }
        applied = true;
        return next;
      });
      if (!applied) {
        toast.error(placementError ?? 'Cannot save — check device widths on shared rack units.');
        return;
      }
      const pend = pendingCableRef.current;
      pendingCableRef.current = null;
      setDualDevices(null);
      markRackDirty();
      if (pend) {
        const from = pend.fromId === na.id ? na : nb;
        const to = pend.toId === na.id ? na : nb;
        setConnections((cprev) => {
          const m = findFirstUnusedMatchingPortPair(from, to, cprev);
          if (!m) return cprev;
          const devFrom = m.fromDeviceId === na.id ? na : nb;
          const devTo = m.toDeviceId === na.id ? na : nb;
          return [
            ...cprev,
            connectionFromManualPorts(
              devFrom,
              devTo,
              m.fromPort,
              m.toPort,
              inchesPerRU,
              slackAllowance,
              pend.extra,
            ),
          ];
        });
      }
    },
    [inchesPerRU, slackAllowance, markRackDirty, rackWidthInches],
  );

  const handleDualClose = useCallback(() => {
    pendingCableRef.current = null;
    setDualDevices(null);
  }, []);

  const hydrateSetters = useMemo(
    () => ({
      setRackName,
      setTotalHeight,
      setInchesPerRU,
      setRackWidthInches,
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

        if (initialRackIdToLoad) {
          try {
            config = await getRack(initialRackIdToLoad);
          } catch (e) {
            if (cancelled) return;
            setLoadError(
              e instanceof Error ? e.message : 'Could not load that rack from the server. Check the ID or try again.',
            );
            setLoadState('error');
            return;
          }
        } else if (forceNewRack) {
          sessionStorage.removeItem(RACK_SESSION_KEY);
          if (cancelled) return;
          setRackId(null);
          setRackName('New rack');
          setTotalHeight(42);
          setInchesPerRU(DEFAULT_INCHES_PER_RU);
          setRackWidthInches(DEFAULT_RACK_WIDTH_INCHES);
          setSlackAllowance(0);
          setConnections([]);
          setDevices([]);
          setCsvUnmatchedQueue([]);
          setRackDirty(false);
          setLoadState('ready');
          return;
        } else {
          const stored = sessionStorage.getItem(RACK_SESSION_KEY);
          if (stored) {
            try {
              config = await getRack(stored);
            } catch {
              sessionStorage.removeItem(RACK_SESSION_KEY);
            }
          }
          if (!config) {
            const bootstrapAttribution: RackSaveAttribution = {
              saveAsGuest: true,
              savedByNameRaw: '',
            };
            const draftName = `New rack (${crypto.randomUUID().slice(0, 8)})`;
            try {
              config = await createRack(
                {
                  name: draftName,
                  totalHeight: 42,
                  inchesPerRU: DEFAULT_INCHES_PER_RU,
                  rackWidthInches: DEFAULT_RACK_WIDTH_INCHES,
                  slackAllowance: 0,
                  devices: [],
                  connections: [],
                },
                bootstrapAttribution,
              );
            } catch (e) {
              const err = e as Error & { status?: number };
              if (err.status === 409) {
                config = await createRack(
                  {
                    name: `New rack (${crypto.randomUUID().slice(0, 8)})`,
                    totalHeight: 42,
                    inchesPerRU: DEFAULT_INCHES_PER_RU,
                    rackWidthInches: DEFAULT_RACK_WIDTH_INCHES,
                    slackAllowance: 0,
                    devices: [],
                    connections: [],
                  },
                  bootstrapAttribution,
                );
              } else {
                throw e;
              }
            }
          }
        }

        if (cancelled) return;
        sessionStorage.setItem(RACK_SESSION_KEY, config!.id);
        if (initialRackIdToLoad) {
          setCsvUnmatchedQueue([]);
        }
        hydrateFromConfig(config, hydrateSetters);
        setRackDirty(false);
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
  }, [hydrateSetters, initialRackIdToLoad, forceNewRack]);

  const handleOpenRackFromLibrary = useCallback(
    async (id: string) => {
      const config = await getRack(id);
      sessionStorage.setItem(RACK_SESSION_KEY, config.id);
      setCsvUnmatchedQueue([]);
      hydrateFromConfig(config, hydrateSetters);
      setRackDirty(false);
    },
    [hydrateSetters],
  );

  const handleSaveRack = useCallback(
    async (mode: SaveRackMode, name: string, attribution: RackSaveAttribution) => {
      const payload = {
        name,
        totalHeight,
        inchesPerRU,
        rackWidthInches,
        slackAllowance,
        devices,
        connections,
      };
      if (mode === 'create' || mode === 'new') {
        const created = await createRack(payload, attribution);
        sessionStorage.setItem(RACK_SESSION_KEY, created.id);
        hydrateFromConfig(created, hydrateSetters);
        completeSaveLifecycle();
        return;
      }
      if (!rackId) throw new Error('No rack loaded');
      const config: RackConfiguration = {
        id: rackId,
        ...payload,
      };
      const updated = await saveRack(config, attribution);
      sessionStorage.setItem(RACK_SESSION_KEY, updated.id);
      hydrateFromConfig(updated, hydrateSetters);
      completeSaveLifecycle();
    },
    [
      rackId,
      totalHeight,
      inchesPerRU,
      rackWidthInches,
      slackAllowance,
      devices,
      connections,
      hydrateSetters,
      completeSaveLifecycle,
    ],
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

  const handleReturnFromRack = useCallback(
    (deviceId: string) => {
      setDevices((prev) =>
        prev.map((d) =>
          d.id === deviceId ? { ...d, rackPosition: undefined, horizontalOffsetInches: undefined } : d,
        ),
      );
      setConnections((c) => c.filter((x) => x.fromDeviceId !== deviceId && x.toDeviceId !== deviceId));
      markRackDirty();
    },
    [markRackDirty],
  );

  const handleCsvImportComplete = useCallback(
    (payload: CsvImportCompletePayload) => {
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
      if (payload.matchedDevices.length > 0 || payload.unmatchedItems.length > 0) {
        markRackDirty();
      }
    },
    [markRackDirty],
  );

  const removeCsvQueueItem = useCallback((id: string) => {
    setCsvUnmatchedQueue((q) => q.filter((x) => x.id !== id));
  }, []);

  const handleCsvReject = useCallback(
    (id: string) => {
      removeCsvQueueItem(id);
      markRackDirty();
    },
    [removeCsvQueueItem, markRackDirty],
  );

  const handleCsvAddToRackOnly = useCallback(
    (id: string) => {
      const item = csvUnmatchedQueue.find((x) => x.id === id);
      if (!item) return;
      const { manufacturer, model } = inferManufacturerModelFromLegacyName(item.name);
      const rack: RackDevice = normalizeRackDeviceIdentity({
        id: `imported-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        name: item.name,
        manufacturer,
        model,
        category: item.category as RackDevice['category'],
        heightInU: item.heightInU,
        physicalHeightInches: item.physicalHeightInches,
        ports: [],
      }) as RackDevice;
      setDevices((prev) => [...prev, rack]);
      removeCsvQueueItem(id);
      markRackDirty();
    },
    [csvUnmatchedQueue, removeCsvQueueItem, markRackDirty],
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
      const rw = rackWidthInches > 0 ? rackWidthInches : DEFAULT_RACK_WIDTH_INCHES;
      const heightInU = device.heightInU ?? item.heightInU;
      const deviceWidthInches =
        device.deviceWidthInches != null ? clampDeviceWidthToRack(device.deviceWidthInches, rw) : undefined;
      const rack: RackDevice = normalizeRackDeviceIdentity({
        id: `imported-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        name: device.name,
        manufacturer: device.manufacturer,
        model: device.model,
        category: deviceCategoryToManualLabel(device.category) as RackDevice['category'],
        heightInU,
        physicalHeightInches: item.physicalHeightInches,
        deviceWidthInches,
        ports: device.ports?.length ? device.ports : [],
      }) as RackDevice;
      setDevices((prev) => [...prev, rack]);
      markRackDirty();
    },
    [csvAddTargetId, csvUnmatchedQueue, closeCsvAddModal, removeCsvQueueItem, markRackDirty, rackWidthInches],
  );

  const existingNamesForCsvAdd = useMemo(() => {
    const rack = devices.map((d) => getDeviceDisplayName(d));
    const db = mergeBuiltInAndCustomDevices().map((d) => getDeviceDisplayName(d));
    return [...rack, ...db];
  }, [devices, csvAddModalOpen]);

  const handleAddManualDevice = (deviceData: {
    manufacturer: string;
    model: string;
    name: string;
    category: string;
    heightInU: number;
    heightInches?: number;
    deviceWidthInches?: number;
    ports?: RackDevice['ports'];
  }) => {
    const rw = rackWidthInches > 0 ? rackWidthInches : DEFAULT_RACK_WIDTH_INCHES;
    const deviceWidthInches =
      deviceData.deviceWidthInches != null
        ? clampDeviceWidthToRack(deviceData.deviceWidthInches, rw)
        : undefined;
    const newDevice: RackDevice = normalizeRackDeviceIdentity({
      id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      name: deviceData.name,
      manufacturer: deviceData.manufacturer,
      model: deviceData.model,
      category: deviceData.category as RackDevice['category'],
      heightInU: deviceData.heightInU,
      physicalHeightInches: deviceData.heightInches,
      deviceWidthInches,
      ports: deviceData.ports?.length ? deviceData.ports : [],
    }) as RackDevice;
    setDevices((prev) => [...prev, newDevice]);
    markRackDirty();
  };

  const handleUpdateDevicePosition = useCallback(
    (deviceId: string, position: number, horizontalOffsetInches?: number) => {
      const rw = rackWidthInches > 0 ? rackWidthInches : DEFAULT_RACK_WIDTH_INCHES;
      let applied = false;
      let placementError: string | null = null;
      setDevices((prev) => {
        const dev = prev.find((d) => d.id === deviceId);
        if (!dev) return prev;
        const w = getDeviceWidthInches(dev);
        const off =
          horizontalOffsetInches !== undefined
            ? horizontalOffsetInches
            : getHorizontalOffsetInches(dev);
        const candidate = normalizeDeviceHorizontalFields(
          {
            ...dev,
            rackPosition: position,
            horizontalOffsetInches: clampHorizontalOffset(off, w, rw),
          },
          rw,
        );
        const others = prev.filter((d) => d.id !== deviceId && d.rackPosition !== undefined);
        const v = validateSideBySidePlacement(candidate, others, rw);
        if (!v.ok) {
          placementError = v.message;
          return prev;
        }
        applied = true;
        return prev.map((d) => (d.id === deviceId ? candidate : d));
      });
      if (!applied) toast.error(placementError ?? 'Cannot place — combined width on this U exceeds rack width.');
      else markRackDirty();
    },
    [rackWidthInches, markRackDirty],
  );

  const handleRemoveDevice = (deviceId: string) => {
    setDevices((prev) => prev.filter((d) => d.id !== deviceId));
    setConnections((c) => c.filter((x) => x.fromDeviceId !== deviceId && x.toDeviceId !== deviceId));
    markRackDirty();
  };

  const handleSaveDevice = useCallback(
    (updatedDevice: RackDevice): boolean => {
      const rw = rackWidthInches > 0 ? rackWidthInches : DEFAULT_RACK_WIDTH_INCHES;
      const normalized = normalizeDeviceHorizontalFields(updatedDevice, rw);
      let applied = false;
      let placementError: string | null = null;
      setDevices((prev) => {
        const next = prev.map((d) => (d.id === normalized.id ? normalized : d));
        const v = validateAllPlacedDevices(next, rw);
        if (!v.ok) {
          placementError = v.message;
          return prev;
        }
        applied = true;
        return next;
      });
      if (!applied) {
        toast.error(placementError ?? 'Cannot save — combined width on a shared U exceeds rack width.');
        return false;
      }
      markRackDirty();
      return true;
    },
    [rackWidthInches, markRackDirty],
  );

  const placedDevices = devices.filter((d) => d.rackPosition !== undefined);

  if (loadState === 'loading' || loadState === 'idle') {
    return (
      <div className="flex items-center gap-2 rounded-xl border-2 border-slate-200 bg-white p-8 text-gray-600 shadow-xl">
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
        <div
          className={`flex flex-wrap items-center gap-4 ${devices.length === 0 ? 'justify-end' : 'justify-between'}`}
        >
          {devices.length > 0 && (
            <div>
              <input
                type="text"
                value={rackName}
                onChange={(e) => {
                  setRackName(e.target.value);
                  markRackDirty();
                }}
                className="-ml-2 border-b-2 border-transparent bg-transparent px-2 text-2xl font-bold text-gray-900 transition-colors hover:border-gray-300 focus:border-blue-500 focus:outline-none"
              />
              <p className="ml-2 mt-1 text-sm text-gray-600">
                Import or add devices, then drag them into the rack. Each row is 1U; device height can be multiple U.
              </p>
              <p className="ml-2 mt-1 text-xs font-medium text-[#003366]">
                Rack width {rackWidthInches}&quot; — on the same U, combined device widths cannot exceed {rackWidthInches}
                &quot; (edit device → pencil icon for width &amp; offset).
              </p>
              <p className="ml-2 mt-2 text-xs text-gray-500">
                {devices.length} device{devices.length !== 1 ? 's' : ''} · {placedDevices.length} placed
                {placedDevices.length < devices.length && ' · drag unassigned gear onto the rack'}
              </p>
            </div>
          )}
          <div className="no-print flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentRacksOpen(true)}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                devices.length === 0
                  ? 'border-2 border-slate-300 bg-white text-[#003366] hover:bg-slate-50'
                  : 'border border-gray-300 bg-white text-gray-800 hover:bg-gray-50'
              }`}
            >
              Current racks
            </button>
            {devices.length > 0 && (
              <>
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
                  className="flex items-center gap-2 rounded-lg bg-[#003366] px-4 py-2 text-white transition-colors hover:bg-[#004080]"
                >
                  <Save className="size-5" />
                  Save rack
                </button>
                <button
                  type="button"
                  onClick={() => setShowSettings(!showSettings)}
                  className="flex items-center gap-2 rounded-lg border-2 border-slate-200 bg-slate-50 px-4 py-2 text-[#003366] transition-colors hover:bg-slate-100"
                >
                  <Settings className="size-5" />
                  Settings
                </button>
              </>
            )}
          </div>
        </div>
        {saveError && (
          <p className="no-print text-sm text-red-600" role="alert">
            {saveError}
          </p>
        )}

        {showSettings && devices.length > 0 && (
          <div className="no-print overflow-hidden rounded-xl border-2 border-slate-200 bg-white shadow-xl">
            <div className="border-b border-slate-200 bg-gradient-to-r from-[#003366] to-[#004080] px-6 py-3">
              <p className="font-cable-display text-xs font-bold uppercase tracking-[0.2em] text-white">
                Rack settings
              </p>
              <p className="font-cable-ui mt-0.5 text-sm text-white/85">
                Dimensions and scale for the diagram and exports
              </p>
            </div>
            <div className="p-6">
              <RackSizeFields
                totalHeight={totalHeight}
                setTotalHeight={setTotalHeight}
                rackWidthInches={rackWidthInches}
                setRackWidthInches={setRackWidthInches}
                inchesPerRU={inchesPerRU}
                setInchesPerRU={setInchesPerRU}
                markRackDirty={markRackDirty}
                subtitle={null}
                visual="cable"
                cableLayout="embedded"
              />
            </div>
          </div>
        )}

        {devices.length === 0 && (
          <div className="no-print overflow-hidden rounded-xl border-2 border-slate-200 bg-white shadow-xl">
            <div className="bg-gradient-to-r from-[#003366] via-[#004080] to-[#003366] px-6 py-8 text-white">
              <h1 className="font-cable-display text-3xl font-bold uppercase tracking-[0.12em] sm:text-4xl sm:tracking-[0.18em]">
                Build a new rack
              </h1>
              <p className="font-cable-ui mt-4 max-w-2xl text-base leading-relaxed text-white/90 sm:text-lg">
                Choose rack size below, then import a parts list (CSV) or add devices manually. After gear is in your
                list, the rack workspace opens and you can drag items into the diagram.
              </p>
            </div>

            <div className="divide-y divide-slate-200">
              <section className="bg-slate-50/40 px-6 py-8">
                <RackSizeFields
                  totalHeight={totalHeight}
                  setTotalHeight={setTotalHeight}
                  rackWidthInches={rackWidthInches}
                  setRackWidthInches={setRackWidthInches}
                  inchesPerRU={inchesPerRU}
                  setInchesPerRU={setInchesPerRU}
                  markRackDirty={markRackDirty}
                  visual="cable"
                  cableLayout="page"
                />
              </section>

              <section className="px-6 py-6">
                <CSVImport
                  onCsvImportComplete={handleCsvImportComplete}
                  pendingUnmatchedCount={csvUnmatchedQueue.length}
                  onReopenCsvReview={() => setCsvReviewOpen(true)}
                  uiVariant="cable"
                  showCsvDownload={false}
                />
              </section>

              <section className="border-t-4 border-[#CC0000] bg-gradient-to-b from-red-50/90 via-white to-white px-6 py-8 sm:py-10">
                <h2 className="font-cable-display text-2xl font-black uppercase tracking-[0.12em] text-[#CC0000] sm:text-3xl sm:tracking-[0.16em]">
                  Or add manually
                </h2>
                <p className="font-cable-ui mt-3 max-w-xl text-base text-slate-700">
                  Add gear without a file — search the catalog or enter a custom device. It appears in the unassigned
                  list when the rack workspace opens.
                </p>
                <div className="mt-6">
                  <ManualDeviceAdd onAddDevice={handleAddManualDevice} uiVariant="cable" />
                </div>
              </section>
            </div>
          </div>
        )}

        {devices.length > 0 && (
          <RackPlannerWorkArea
            devices={devices}
            totalHeight={totalHeight}
            inchesPerRU={inchesPerRU}
            rackWidthInches={rackWidthInches}
            rackCaptureRef={rackCaptureRef}
            onEditDevice={setEditingDevice}
            onRemoveDevice={handleRemoveDevice}
            onReturnFromRack={handleReturnFromRack}
            onCsvImportComplete={handleCsvImportComplete}
            pendingCsvUnmatchedCount={csvUnmatchedQueue.length}
            onReopenCsvReview={() => setCsvReviewOpen(true)}
            rackExportContext={rackExportContext}
            onAddManualDevice={handleAddManualDevice}
            onUpdateDevicePosition={handleUpdateDevicePosition}
            connections={connections}
            slackAllowanceFeet={slackAllowance}
            onAddConnection={handleAddConnection}
            onPortMismatch={handlePortMismatch}
            onRemoveConnection={handleRemoveConnection}
          />
        )}
      </div>

      <CurrentRacksModal
        isOpen={currentRacksOpen}
        onClose={() => setCurrentRacksOpen(false)}
        currentRackId={rackId}
        onOpenRack={handleOpenRackFromLibrary}
      />
      {blocker.state === 'blocked' && !saveRackModalOpen && (
        <div
          className="no-print fixed inset-0 z-[75] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="leave-rack-title"
        >
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-start gap-3">
              <AlertTriangle className="mt-0.5 size-6 shrink-0 text-amber-500" aria-hidden />
              <div>
                <h2 id="leave-rack-title" className="text-lg font-semibold text-gray-900">
                  Leave rack workspace?
                </h2>
                <p className="mt-2 text-sm text-gray-600">
                  You have unsaved changes on this rack. Save before leaving, or discard and continue.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
              <button
                type="button"
                onClick={() => blocker.reset()}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Stay
              </button>
              <button
                type="button"
                onClick={() => {
                  pendingLeaveAfterSaveRef.current = false;
                  blocker.proceed();
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Leave without saving
              </button>
              <button
                type="button"
                onClick={() => {
                  pendingLeaveAfterSaveRef.current = true;
                  setSaveRackModalOpen(true);
                }}
                className="rounded-lg bg-[#003366] px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Save rack…
              </button>
            </div>
          </div>
        </div>
      )}

      <SaveRackModal
        isOpen={saveRackModalOpen}
        onClose={() => {
          pendingLeaveAfterSaveRef.current = false;
          setSaveRackModalOpen(false);
        }}
        initialRackName={rackName}
        hasPersistedRack={Boolean(rackId)}
        onSave={handleSaveRack}
      />

      <RackDeviceEditor
        device={editingDevice}
        isOpen={editingDevice !== null}
        onClose={() => setEditingDevice(null)}
        onSave={handleSaveDevice}
        inchesPerRU={inchesPerRU}
        rackWidthInches={rackWidthInches}
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

      {portMismatch && (
        <div
          className="no-print fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="port-mismatch-title"
        >
          <div className="max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 id="port-mismatch-title" className="text-lg font-bold text-gray-900">
              No matching ports
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              There is no compatible port pair between <strong>{portMismatch.from.name}</strong> and{' '}
              <strong>{portMismatch.to.name}</strong> for a direct cable. Would you like to reconfigure both devices?
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={handlePortMismatchNo}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                No — discard cable
              </button>
              <button
                type="button"
                onClick={handlePortMismatchYes}
                className="rounded-lg bg-[#003366] px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Yes — edit ports
              </button>
            </div>
          </div>
        </div>
      )}

      {dualDevices && (
        <RackDualDeviceEditor
          deviceA={dualDevices.a}
          deviceB={dualDevices.b}
          isOpen
          onClose={handleDualClose}
          onSave={handleDualSave}
          inchesPerRU={inchesPerRU}
          rackWidthInches={rackWidthInches}
        />
      )}
    </DndProvider>
  );
}
