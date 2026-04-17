import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useBlocker } from 'react-router';
import type { Blocker, BlockerFunction } from 'react-router';
import { toPng } from 'html-to-image';
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
import { mergeBuiltInAndCustomDevices } from '../utils/deviceCatalogSearch';
import { prefetchServerCatalogDevices } from '../utils/serverCatalogCache';
import {
  DEFAULT_INCHES_PER_RU,
  DEFAULT_RACK_DEPTH_INCHES,
  DEFAULT_RACK_WIDTH_INCHES,
  MAX_RACK_HEIGHT_U,
} from '../utils/rackUnits';
import {
  getDeviceDisplayName,
  inferManufacturerModelFromLegacyName,
  normalizeRackDeviceIdentity,
} from '../utils/deviceDisplay';
import { filterPlaceholderRackDevices } from '../utils/rackPlaceholders';
import { AddDeviceModal } from './AddDeviceModal';
import { CSVImport, type CsvImportCompletePayload } from './CSVImport';
import { ManualDeviceAdd, type ManualAddDevicePayload } from './ManualDeviceAdd';
import { CsvUnmatchedReviewModal, type CsvUnmatchedQueueItem } from './CsvUnmatchedReviewModal';
import { RackPlannerWorkArea } from './RackPlannerWorkArea';
import type { RackPortMismatchPayload } from './RackVisualizer';
import { RackDeviceEditor } from './RackDeviceEditor';
import { RackDualDeviceEditor } from './RackDualDeviceEditor';
import { SaveRackModal, type SaveRackMode } from './SaveRackModal';
import type { RackSaveAttribution } from '../api/racks';
import {
  AlertTriangle,
  CloudOff,
  FileSpreadsheet,
  ImageDown,
  Loader2,
  Plus,
  Printer,
  Save,
  Settings,
} from 'lucide-react';
import { toast } from 'sonner';
import { applyRackPngMonochromeSvg } from '../utils/rackPngExportSvg';
import { buildRackDevicesTemplateCsv } from '../utils/rackTemplateCsv';
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

/** Avoid one giant React commit when CSV import adds hundreds of devices (keeps UI responsive). */
const CSV_IMPORT_DEVICE_CHUNK = 48;

/**
 * Opens a minimal print document containing the exported PNG so output matches Export PNG and fits one page.
 */
function printRackPngDataUrl(dataUrl: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const probe = new Image();
    probe.onload = () => {
      const landscape = probe.naturalWidth >= probe.naturalHeight;
      fetch(dataUrl)
        .then((r) => r.blob())
        .then((blob) => {
          const objectUrl = URL.createObjectURL(blob);
          const iframe = document.createElement('iframe');
          iframe.setAttribute('aria-hidden', 'true');
          Object.assign(iframe.style, {
            position: 'fixed',
            right: '0',
            bottom: '0',
            width: '0',
            height: '0',
            border: '0',
            opacity: '0',
            pointerEvents: 'none',
          });
          document.body.appendChild(iframe);
          const doc = iframe.contentDocument!;
          const win = iframe.contentWindow!;

          const pageRule = landscape
            ? '@page { size: landscape; margin: 8mm; }'
            : '@page { size: portrait; margin: 8mm; }';

          doc.open();
          doc.write(
            '<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Rack</title></head><body></body></html>',
          );
          doc.close();

          const styleEl = doc.createElement('style');
          styleEl.textContent = `
${pageRule}
html, body { margin: 0; padding: 0; background: #fff; height: 100%; }
@media print {
  html, body {
    width: 100%;
    height: 100%;
    overflow: hidden;
  }
  body {
    display: flex;
    justify-content: center;
    align-items: flex-start;
    box-sizing: border-box;
  }
  img.rack-print-snapshot {
    display: block;
    flex-shrink: 0;
    width: 100%;
    max-width: 100%;
    height: auto;
    max-height: 100%;
    object-fit: contain;
    object-position: top center;
    page-break-inside: avoid;
    page-break-after: avoid;
  }
}
`;
          doc.head.appendChild(styleEl);

          const img = doc.createElement('img');
          img.className = 'rack-print-snapshot';
          img.alt = 'Rack diagram';

          const cleanup = () => {
            URL.revokeObjectURL(objectUrl);
            iframe.remove();
            resolve();
          };

          let cleaned = false;
          const safeCleanup = () => {
            if (cleaned) return;
            cleaned = true;
            cleanup();
          };

          const triggerPrint = () => {
            requestAnimationFrame(() => {
              setTimeout(() => {
                win.focus();
                win.print();
              }, 100);
            });
          };

          img.onload = () => triggerPrint();
          img.onerror = () => {
            safeCleanup();
            reject(new Error('Could not load image for printing'));
          };

          win.addEventListener('afterprint', safeCleanup, { once: true });
          setTimeout(safeCleanup, 180000);

          doc.body.appendChild(img);
          img.src = objectUrl;
        })
        .catch(reject);
    };
    probe.onerror = () => reject(new Error('Could not read exported image'));
    probe.src = dataUrl;
  });
}

const rackSizeInputPlainClass =
  'w-full rounded-lg border border-slate-300 px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#003366]';

const rackSizeInputPlainNightClass =
  'w-full rounded-lg border border-slate-600 bg-slate-900/90 px-4 py-2 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40';

const rackSizeInputCableClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-center text-lg font-semibold tabular-nums tracking-tight text-[#003366] shadow-inner focus:border-[#003366] focus:outline-none focus:ring-2 focus:ring-[#003366]/30 sm:text-left';

const rackSizeInputCableNightClass =
  'w-full rounded-lg border border-slate-600 bg-slate-900/80 px-3 py-2.5 text-center text-lg font-semibold tabular-nums tracking-tight text-sky-200 shadow-inner focus:border-sky-500/50 focus:outline-none focus:ring-2 focus:ring-sky-500/30 sm:text-left';

function RackSizeFields(props: {
  totalHeight: number;
  setTotalHeight: (v: number) => void;
  rackDepthInches: number;
  setRackDepthInches: (v: number) => void;
  markRackDirty: () => void;
  /** Omit on secondary panels where context is already in the section header. */
  subtitle?: string | null;
  /** Cable Identification style: spec-style panel, balanced display + UI fonts. */
  visual?: 'plain' | 'cable';
  /** When visual=cable: tighter panel inside an existing settings card (no full-bleed shell). */
  cableLayout?: 'page' | 'embedded';
  /** Dark workspace (rack / edit pages): inputs and cable shell match night UI. */
  nightChrome?: boolean;
}) {
  const {
    totalHeight,
    setTotalHeight,
    rackDepthInches,
    setRackDepthInches,
    markRackDirty,
    subtitle = `Set total U (max ${MAX_RACK_HEIGHT_U}) and cabinet depth. Rack width is fixed at ${DEFAULT_RACK_WIDTH_INCHES} in and ${DEFAULT_INCHES_PER_RU} in per U (EIA).`,
    visual = 'plain',
    cableLayout = 'page',
    nightChrome = false,
  } = props;

  const inputClass =
    visual === 'cable'
      ? nightChrome
        ? rackSizeInputCableNightClass
        : rackSizeInputCableClass
      : nightChrome
        ? rackSizeInputPlainNightClass
        : rackSizeInputPlainClass;

  const fieldsGrid = (
    <div className={`grid sm:grid-cols-2 ${visual === 'cable' ? 'gap-4' : 'max-w-2xl gap-6'}`}>
      <div
        className={
          visual === 'cable'
            ? nightChrome
              ? 'rounded-xl border border-slate-600/90 bg-gradient-to-b from-slate-800 to-slate-900/95 p-4 shadow-sm'
              : 'rounded-xl border border-slate-200/90 bg-gradient-to-b from-white to-slate-50/90 p-4 shadow-sm'
            : ''
        }
      >
        <label
          className={`mb-2 block ${
            visual === 'cable'
              ? nightChrome
                ? 'font-cable-display text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400'
                : 'font-cable-display text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500'
              : nightChrome
                ? 'text-sm font-medium text-slate-300'
                : 'text-sm font-medium text-slate-800'
          }`}
        >
          Total rack height (U)
        </label>
        <input
          type="number"
          value={totalHeight}
          onChange={(e) => {
            const raw = parseInt(e.target.value, 10);
            const n = Number.isNaN(raw) ? 1 : raw;
            setTotalHeight(Math.min(MAX_RACK_HEIGHT_U, Math.max(1, n)));
            markRackDirty();
          }}
          min={1}
          max={MAX_RACK_HEIGHT_U}
          className={inputClass}
        />
        <p
          className={`mt-2 text-xs leading-snug ${
            visual === 'cable'
              ? nightChrome
                ? 'font-cable-ui text-slate-400'
                : 'font-cable-ui text-slate-500'
              : nightChrome
                ? 'text-slate-400'
                : 'text-slate-500'
          }`}
        >
          {(totalHeight * DEFAULT_INCHES_PER_RU).toFixed(2)}&quot; tall ({DEFAULT_INCHES_PER_RU}&quot; per U)
        </p>
      </div>
      <div
        className={
          visual === 'cable'
            ? nightChrome
              ? 'rounded-xl border border-slate-600/90 bg-gradient-to-b from-slate-800 to-slate-900/95 p-4 shadow-sm'
              : 'rounded-xl border border-slate-200/90 bg-gradient-to-b from-white to-slate-50/90 p-4 shadow-sm'
            : ''
        }
      >
        <label
          className={`mb-2 block ${
            visual === 'cable'
              ? nightChrome
                ? 'font-cable-display text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400'
                : 'font-cable-display text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500'
              : nightChrome
                ? 'text-sm font-medium text-slate-300'
                : 'text-sm font-medium text-slate-800'
          }`}
        >
          Rack depth (inches)
        </label>
        <input
          type="number"
          value={rackDepthInches}
          onChange={(e) => {
            const n = parseFloat(e.target.value);
            if (!Number.isNaN(n) && n >= 6 && n <= 120) {
              setRackDepthInches(n);
              markRackDirty();
            }
          }}
          min={6}
          max={120}
          step={0.25}
          className={inputClass}
        />
        <p
          className={`mt-2 text-xs leading-snug ${
            visual === 'cable'
              ? nightChrome
                ? 'font-cable-ui text-slate-400'
                : 'font-cable-ui text-slate-500'
              : nightChrome
                ? 'text-slate-400'
                : 'text-slate-500'
          }`}
        >
          Front rail to rear (usable cabinet depth). Does not change the face diagram.
        </p>
      </div>
    </div>
  );

  if (visual === 'plain') {
    return (
      <>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#CC0000]">Rack size</p>
        {subtitle != null && subtitle !== '' && (
          <p className={`mt-1 text-sm ${nightChrome ? 'text-slate-400' : 'text-slate-600'}`}>{subtitle}</p>
        )}
        <div className="mt-4">{fieldsGrid}</div>
      </>
    );
  }

  const shellClass =
    cableLayout === 'embedded'
      ? nightChrome
        ? 'overflow-hidden rounded-xl border-2 border-slate-600 bg-slate-800/95 shadow-md'
        : 'overflow-hidden rounded-xl border-2 border-slate-200 bg-white shadow-md'
      : nightChrome
        ? 'overflow-hidden rounded-2xl border-2 border-slate-600 bg-slate-800/95 shadow-[0_6px_32px_-8px_rgba(0,0,0,0.35)]'
        : 'overflow-hidden rounded-2xl border-2 border-slate-200 bg-white shadow-[0_6px_32px_-8px_rgba(0,51,102,0.18)]';

  return (
    <div className={`font-cable-ui ${shellClass}`}>
      <div className="flex min-w-0 gap-0">
        <div
          className="w-1.5 shrink-0 bg-gradient-to-b from-[#CC0000] via-[#003366] to-[#004080]"
          aria-hidden
        />
        <div className="min-w-0 flex-1 px-5 py-5 sm:px-6 sm:py-6">
          <div
            className={`flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-end sm:justify-between ${
              nightChrome ? 'border-slate-600/80' : 'border-slate-100'
            }`}
          >
            <div>
              <p className="font-cable-display text-[0.65rem] font-bold uppercase tracking-[0.32em] text-[#CC0000]">
                Rack size
              </p>
              {cableLayout === 'page' ? (
                <p
                  className={`font-cable-display mt-1 text-xl font-bold tracking-tight sm:text-2xl ${
                    nightChrome ? 'text-sky-200' : 'text-[#003366]'
                  }`}
                >
                  Physical footprint
                </p>
              ) : (
                <p
                  className={`font-cable-display mt-1 text-lg font-bold tracking-tight ${
                    nightChrome ? 'text-sky-200' : 'text-[#003366]'
                  }`}
                >
                  Dimensions
                </p>
              )}
            </div>
            <p className="font-cable-display text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
              EIA · diagram scale
            </p>
          </div>
          {subtitle != null && subtitle !== '' && (
            <p
              className={`font-cable-ui mt-4 max-w-2xl text-sm leading-relaxed ${
                nightChrome ? 'text-slate-400' : 'text-slate-600'
              }`}
            >
              {subtitle}
            </p>
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
  setRackDepthInches: (v: number) => void;
  setSlackAllowance: (v: number) => void;
  setConnections: (v: RackConfiguration['connections']) => void;
  setDevices: (v: RackDevice[]) => void;
  setRackId: (v: string) => void;
}) {
  setters.setRackId(config.id);
  setters.setRackName(config.name);
  setters.setTotalHeight(Math.min(MAX_RACK_HEIGHT_U, Math.max(1, config.totalHeight)));
  setters.setRackDepthInches(config.rackDepthInches ?? DEFAULT_RACK_DEPTH_INCHES);
  setters.setSlackAllowance(config.slackAllowance);
  setters.setConnections(config.connections);
  setters.setDevices(filterPlaceholderRackDevices(config.devices as RackDevice[]));
}

/**
 * Rack layout MVP: import / manual devices → drag into U grid (variable heights).
 * Connection maps and backend path analysis are deferred (see config/features.ts).
 */
type RackPlannerProps = {
  /** When set (e.g. from /edit), load this rack instead of session / new rack. */
  initialRackIdToLoad?: string;
  /** When true (e.g. /rack?new=1), ignore session and create a fresh empty rack. */
  forceNewRack?: boolean;
};

export function RackPlanner({
  initialRackIdToLoad,
  forceNewRack = false,
}: RackPlannerProps = {}) {
  const [rackId, setRackId] = useState<string | null>(null);
  const [rackName, setRackName] = useState('Production Rack 1');
  const [totalHeight, setTotalHeightState] = useState(42);
  const [slackAllowance, setSlackAllowance] = useState(0);
  const [rackDepthInches, setRackDepthInches] = useState(DEFAULT_RACK_DEPTH_INCHES);
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
  const [csvAddSnapshot, setCsvAddSnapshot] = useState<CsvUnmatchedQueueItem | null>(null);
  const [saveRackModalOpen, setSaveRackModalOpen] = useState(false);
  const [portMismatch, setPortMismatch] = useState<RackPortMismatchPayload | null>(null);
  const [dualDevices, setDualDevices] = useState<{ a: RackDevice; b: RackDevice } | null>(null);
  const pendingCableRef = useRef<{
    fromId: string;
    toId: string;
    extraSlackInches: number;
    buildVisualRoute: RackPortMismatchPayload['buildVisualRoute'];
  } | null>(null);
  const rackCaptureRef = useRef<HTMLDivElement | null>(null);
  const [rackDirty, setRackDirty] = useState(false);
  const pendingLeaveAfterSaveRef = useRef(false);
  const blockerRef = useRef<Blocker | null>(null);
  const [serverCatalogTick, setServerCatalogTick] = useState(0);

  useEffect(() => {
    void prefetchServerCatalogDevices().then((ok) => {
      if (ok) setServerCatalogTick((n) => n + 1);
    });
  }, []);

  const blocker = useBlocker(
    useCallback<BlockerFunction>(
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

  const setTotalHeight = useCallback((v: number) => {
    const n = Number.isFinite(v) ? Math.floor(v) : 1;
    setTotalHeightState(Math.min(MAX_RACK_HEIGHT_U, Math.max(1, n)));
  }, []);

  const inchesPerRU = DEFAULT_INCHES_PER_RU;
  const rackWidthInches = DEFAULT_RACK_WIDTH_INCHES;

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
      rackName,
      totalHeightU: totalHeight,
      rackWidthInches,
      rackDepthInches,
      placedDevices: devices.filter((d) => d.rackPosition !== undefined),
      unassignedDevices: devices.filter((d) => d.rackPosition === undefined),
      connections,
    }),
    [rackName, totalHeight, rackWidthInches, rackDepthInches, devices, connections],
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

  const handlePortMismatch = useCallback((p: RackPortMismatchPayload) => {
    setPortMismatch(p);
  }, []);

  const handlePortMismatchYes = useCallback(() => {
    if (!portMismatch) return;
    pendingCableRef.current = {
      fromId: portMismatch.from.id,
      toId: portMismatch.to.id,
      extraSlackInches: portMismatch.extraSlackInches,
      buildVisualRoute: portMismatch.buildVisualRoute,
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
              pend.extraSlackInches,
              pend.buildVisualRoute(m, devFrom, devTo),
              undefined,
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
      setRackDepthInches,
      setSlackAllowance,
      setConnections,
      setDevices,
      setRackId,
    }),
    [setTotalHeight],
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
          setRackDepthInches(DEFAULT_RACK_DEPTH_INCHES);
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
                  rackDepthInches: DEFAULT_RACK_DEPTH_INCHES,
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
                    rackDepthInches: DEFAULT_RACK_DEPTH_INCHES,
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
  }, [hydrateSetters, initialRackIdToLoad, forceNewRack, setTotalHeight]);

  const handleSaveRack = useCallback(
    async (mode: SaveRackMode, name: string, attribution: RackSaveAttribution) => {
      const payload = {
        name,
        totalHeight,
        inchesPerRU: DEFAULT_INCHES_PER_RU,
        rackWidthInches: DEFAULT_RACK_WIDTH_INCHES,
        rackDepthInches,
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
      rackDepthInches,
      slackAllowance,
      devices,
      connections,
      hydrateSetters,
      completeSaveLifecycle,
    ],
  );

  const captureRackPngDataUrl = useCallback(async (): Promise<string> => {
    const el = rackCaptureRef.current;
    if (!el) {
      throw new Error('Add at least one device to show the rack diagram before exporting.');
    }
    el.classList.add('rack-export-png-light');
    let restoreSvg: (() => void) | undefined;
    try {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
      restoreSvg = applyRackPngMonochromeSvg(el);
      return await toPng(el, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: '#ffffff',
      });
    } finally {
      restoreSvg?.();
      el.classList.remove('rack-export-png-light');
    }
  }, []);

  const handlePrint = useCallback(async () => {
    if (!rackCaptureRef.current) {
      window.print();
      return;
    }
    setSaveError(null);
    try {
      const dataUrl = await captureRackPngDataUrl();
      await printRackPngDataUrl(dataUrl);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Could not print rack');
      window.setTimeout(() => setSaveError(null), 5000);
    }
  }, [captureRackPngDataUrl]);

  const handleExportDevicesCsv = useCallback(() => {
    const csv = buildRackDevicesTemplateCsv(rackExportContext);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const safe = rackName.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-') || 'rack';
    link.download = `${safe}-devices.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [rackExportContext, rackName]);

  const handleExportRackPng = useCallback(async () => {
    setSaveError(null);
    try {
      const dataUrl = await captureRackPngDataUrl();
      const safe = rackName.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-') || 'rack';
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `${safe}-rack.png`;
      a.click();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Could not export image');
      window.setTimeout(() => setSaveError(null), 4000);
    }
  }, [captureRackPngDataUrl, rackName]);

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

  const appendImportedDevicesInChunks = useCallback((incoming: RackDevice[]) => {
    if (incoming.length === 0) return;
    if (incoming.length <= CSV_IMPORT_DEVICE_CHUNK) {
      startTransition(() => {
        setDevices((prev) => [...prev, ...incoming]);
      });
      return;
    }
    let offset = 0;
    const pump = () => {
      const slice = incoming.slice(offset, offset + CSV_IMPORT_DEVICE_CHUNK);
      offset += slice.length;
      startTransition(() => {
        setDevices((prev) => [...prev, ...slice]);
      });
      if (offset < incoming.length) {
        requestAnimationFrame(pump);
      }
    };
    requestAnimationFrame(pump);
  }, []);

  const handleCsvImportComplete = useCallback(
    (payload: CsvImportCompletePayload) => {
      if (payload.matchedDevices.length > 0) {
        appendImportedDevicesInChunks(
          payload.matchedDevices.map((d) => normalizeRackDeviceIdentity({ ...d }) as RackDevice),
        );
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
    [appendImportedDevicesInChunks, markRackDirty],
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
      const inferred = inferManufacturerModelFromLegacyName(item.name);
      const manufacturer = (item.manufacturer ?? inferred.manufacturer).trim();
      const model = (item.model ?? inferred.model).trim();
      const rack: RackDevice = normalizeRackDeviceIdentity({
        id: `imported-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        name: item.name,
        manufacturer,
        model,
        category: item.category,
        heightInU: item.heightInU,
        physicalHeightInches: item.physicalHeightInches,
        deviceWidthInches: item.deviceWidthInches,
        deviceDepthInches: item.deviceDepthInches,
        sheetPower: item.sheetPower,
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
      setCsvAddSnapshot({ ...item });
      setCsvAddModalOpen(true);
    },
    [csvUnmatchedQueue],
  );

  const closeCsvAddModal = useCallback(() => {
    setCsvAddModalOpen(false);
    setCsvAddTargetId(null);
    setCsvAddSnapshot(null);
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
        category: device.category,
        heightInU,
        physicalHeightInches: item.physicalHeightInches,
        deviceWidthInches,
        deviceDepthInches: device.deviceDepthInches ?? item.deviceDepthInches,
        sheetPower: item.sheetPower,
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
  }, [devices, csvAddModalOpen, serverCatalogTick]);

  const handleAddManualDevice = (deviceData: ManualAddDevicePayload) => {
    const rw = rackWidthInches > 0 ? rackWidthInches : DEFAULT_RACK_WIDTH_INCHES;
    const deviceWidthInches =
      deviceData.deviceWidthInches != null
        ? clampDeviceWidthToRack(deviceData.deviceWidthInches, rw)
        : undefined;
    const preferred = deviceData.preferredDeviceId?.trim();
    const idTaken = preferred ? devices.some((d) => d.id === preferred) : true;
    const newId =
      preferred && !idTaken
        ? preferred
        : `manual-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const newDevice: RackDevice = normalizeRackDeviceIdentity({
      id: newId,
      name: deviceData.name,
      manufacturer: deviceData.manufacturer,
      model: deviceData.model,
      category: deviceData.category as RackDevice['category'],
      heightInU: deviceData.heightInU,
      physicalHeightInches: deviceData.heightInches,
      deviceWidthInches,
      deviceDepthInches: deviceData.deviceDepthInches,
      sheetPower: deviceData.sheetPower,
      deviceNotes: deviceData.deviceNotes,
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
      <div className="flex items-center gap-2 rounded-xl border-2 border-slate-600 bg-slate-800/90 p-8 text-slate-300 shadow-xl shadow-black/20">
        <Loader2 className="size-5 animate-spin text-sky-400" />
        Loading rack…
      </div>
    );
  }

  if (loadState === 'error') {
    return (
      <div className="rounded-xl border border-amber-700/50 bg-amber-950/40 p-6 text-amber-100 shadow-sm">
        <div className="flex items-start gap-3">
          <CloudOff className="mt-0.5 size-5 shrink-0 text-amber-400" />
          <div>
            <p className="font-medium">Could not load the rack from the API.</p>
            <p className="mt-1 text-sm opacity-90 text-amber-100/90">{loadError}</p>
            <p className="mt-3 text-sm text-amber-50/90">
              Start the backend (<code className="rounded bg-amber-950/80 px-1 text-amber-100">cd backend && npm run dev</code>) and
              ensure PostgreSQL is running, then run{' '}
              <code className="rounded bg-amber-950/80 px-1 text-amber-100">npx prisma migrate deploy</code> in{' '}
              <code className="rounded bg-amber-950/80 px-1 text-amber-100">backend/</code>.
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
            <div className="no-print">
              <input
                type="text"
                value={rackName}
                onChange={(e) => {
                  setRackName(e.target.value);
                  markRackDirty();
                }}
                className="-ml-2 border-b-2 border-transparent bg-transparent px-2 text-2xl font-bold text-slate-100 transition-colors hover:border-slate-500 focus:border-sky-500 focus:outline-none"
              />
              <p className="ml-2 mt-1 text-sm text-slate-400">
                Import or add devices, then drag them into the rack. Each row is 1U; device height can be multiple U.
              </p>
              <p className="ml-2 mt-1 text-xs font-medium text-sky-300/90">
                {rackWidthInches}&quot; wide × {rackDepthInches}&quot; deep (EIA, {inchesPerRU}&quot;/U) — on the same U,
                combined device widths cannot exceed {rackWidthInches}&quot; (edit device → pencil for width &amp;
                offset).
              </p>
              <p className="ml-2 mt-2 text-xs text-slate-500">
                {devices.length} device{devices.length !== 1 ? 's' : ''} · {placedDevices.length} placed
                {placedDevices.length < devices.length && ' · drag unassigned gear onto the rack'}
              </p>
            </div>
          )}
          {devices.length > 0 && (
            <div className="no-print flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handlePrint}
                className="flex items-center gap-2 rounded-lg border border-slate-500 bg-slate-800 px-3 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-700"
              >
                <Printer className="size-4" />
                Print
              </button>
              <button
                type="button"
                onClick={() => void handleExportRackPng()}
                className="flex items-center gap-2 rounded-lg border border-slate-500 bg-slate-800 px-3 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-700"
              >
                <ImageDown className="size-4" />
                Export PNG
              </button>
              <button
                type="button"
                onClick={handleExportDevicesCsv}
                className="flex items-center gap-2 rounded-lg border border-slate-500 bg-slate-800 px-3 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-700"
              >
                <FileSpreadsheet className="size-4" />
                Export CSV of devices
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
                className="flex items-center gap-2 rounded-lg border-2 border-slate-500 bg-slate-800/80 px-4 py-2 text-sky-200 transition-colors hover:bg-slate-700"
              >
                <Settings className="size-5" />
                Settings
              </button>
            </div>
          )}
        </div>
        {saveError && (
          <p className="no-print text-sm text-red-400" role="alert">
            {saveError}
          </p>
        )}

        {showSettings && devices.length > 0 && (
          <div className="no-print overflow-hidden rounded-xl border-2 border-slate-600 bg-slate-800/95 shadow-xl shadow-black/25">
            <div className="border-b border-slate-600/80 bg-gradient-to-r from-[#003366] to-[#004080] px-6 py-3">
              <p className="font-cable-display text-xs font-bold uppercase tracking-[0.2em] text-white">
                Rack settings
              </p>
              <p className="font-cable-ui mt-0.5 text-sm text-white/85">
                Dimensions and scale for the diagram and exports
              </p>
            </div>
            <div className="bg-slate-900/40 p-6">
              <RackSizeFields
                totalHeight={totalHeight}
                setTotalHeight={setTotalHeight}
                rackDepthInches={rackDepthInches}
                setRackDepthInches={setRackDepthInches}
                markRackDirty={markRackDirty}
                subtitle={null}
                visual="cable"
                cableLayout="embedded"
                nightChrome
              />
            </div>
          </div>
        )}

        {devices.length === 0 && (
          <div className="no-print overflow-hidden rounded-xl border-2 border-slate-600 bg-slate-800/95 shadow-xl shadow-black/25">
            <div className="bg-gradient-to-r from-[#003366] via-[#004080] to-[#003366] px-6 py-8 text-white">
              <h1 className="font-cable-display text-3xl font-bold uppercase tracking-[0.12em] sm:text-4xl sm:tracking-[0.18em]">
                Build a new rack
              </h1>
              <p className="font-cable-ui mt-4 max-w-2xl text-base leading-relaxed text-white/90 sm:text-lg">
                Choose rack size below, then import a parts list (CSV or XML) or add devices manually. After gear is in
                your list, the rack workspace opens and you can drag items into the diagram.
              </p>
            </div>

            <div className="divide-y divide-slate-600/80">
              <section className="bg-slate-900/50 px-6 py-8">
                <RackSizeFields
                  totalHeight={totalHeight}
                  setTotalHeight={setTotalHeight}
                  rackDepthInches={rackDepthInches}
                  setRackDepthInches={setRackDepthInches}
                  markRackDirty={markRackDirty}
                  visual="cable"
                  cableLayout="page"
                  nightChrome
                />
              </section>

              <section className="bg-slate-900/35 px-6 py-6 lg:py-8">
                <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-stretch lg:gap-10">
                  <div className="flex h-full min-h-0 min-w-0 flex-col">
                    <CSVImport
                      onCsvImportComplete={handleCsvImportComplete}
                      pendingUnmatchedCount={csvUnmatchedQueue.length}
                      onReopenCsvReview={() => setCsvReviewOpen(true)}
                      uiVariant="cable"
                      showCsvDownload={false}
                      surface="dark"
                      dashedPanelExtraClass="min-h-72 flex flex-1 min-h-0 flex-col justify-center"
                    />
                  </div>
                  <div className="flex h-full min-h-0 min-w-0 flex-col border-t border-slate-600/80 pt-8 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
                    <div className="flex min-h-72 flex-1 flex-col justify-center rounded-xl border-2 border-dashed border-slate-600 bg-slate-800/60 p-8 text-center transition-colors hover:border-slate-500">
                      <div className="flex flex-col items-center gap-4">
                        <div className="shrink-0 rounded-full bg-slate-700/80 p-4 shadow-sm">
                          <Plus className="size-12 text-[#CC0000]" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-cable-ui mb-1 font-semibold text-[#ff6b6b]">
                            Add device manually
                          </h3>
                          <p className="font-cable-ui text-sm text-slate-400">
                            Search the catalog or enter a custom device. It appears in the unassigned list when the
                            rack workspace opens.
                          </p>
                        </div>
                        <ManualDeviceAdd
                          onAddDevice={handleAddManualDevice}
                          uiVariant="cable"
                          workSurface="rackDark"
                          landingPrimaryStyle
                        />
                      </div>
                    </div>
                  </div>
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

      {blocker.state === 'blocked' && !saveRackModalOpen && (
        <div
          className="no-print fixed inset-0 z-[75] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="leave-rack-title"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-600 bg-slate-800 p-6 shadow-2xl">
            <div className="mb-4 flex items-start gap-3">
              <AlertTriangle className="mt-0.5 size-6 shrink-0 text-amber-400" aria-hidden />
              <div>
                <h2 id="leave-rack-title" className="text-lg font-semibold text-slate-100">
                  Leave rack workspace?
                </h2>
                <p className="mt-2 text-sm text-slate-400">
                  You have unsaved changes on this rack. Save before leaving, or discard and continue.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
              <button
                type="button"
                onClick={() => blocker.reset()}
                className="rounded-lg border border-slate-500 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700"
              >
                Stay
              </button>
              <button
                type="button"
                onClick={() => {
                  pendingLeaveAfterSaveRef.current = false;
                  blocker.proceed();
                }}
                className="rounded-lg border border-slate-500 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700"
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
        csvImportRow={csvAddSnapshot}
        surface="dark"
      />

      {portMismatch && (
        <div
          className="no-print fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="port-mismatch-title"
        >
          <div className="max-w-md rounded-xl border border-slate-600 bg-slate-900 p-6 shadow-2xl ring-1 ring-slate-500/30">
            <h2 id="port-mismatch-title" className="text-lg font-bold text-slate-100">
              No matching ports
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              There is no compatible port pair between <strong className="text-slate-200">{portMismatch.from.name}</strong>{' '}
              and <strong className="text-slate-200">{portMismatch.to.name}</strong> for a direct cable. Would you like to
              reconfigure both devices?
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={handlePortMismatchNo}
                className="rounded-lg border border-slate-500 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
              >
                No — discard cable
              </button>
              <button
                type="button"
                onClick={handlePortMismatchYes}
                className="rounded-lg bg-[#003366] px-4 py-2 text-sm font-medium text-white hover:bg-[#004080]"
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
