import {
  useCallback,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type Ref,
} from 'react';
import { useDrag, useDrop } from 'react-dnd';
import type { RackConnection, RackDevice } from '../types/rack';
import {
  getDeviceDisplayName,
  getDeviceIdentityTwoLines,
  inferManufacturerModelFromLegacyName,
} from '../utils/deviceDisplay';
import { RackCableOverlay } from './RackCableOverlay';
import { Trash2, Edit, GripVertical } from 'lucide-react';
import { DEFAULT_INCHES_PER_RU, DEFAULT_RACK_WIDTH_INCHES, rackFaceWidthPx } from '../utils/rackUnits';
import {
  getDeviceWidthInches,
  horizontalOffsetInchesFromDropX,
  normalizeDeviceHorizontalFields,
} from '../utils/rackDevicePlacement';
import {
  NARROW_DEVICE_FACE_INCHES,
  NARROW_DEVICE_NAME_COL_PX,
  shouldShowManufacturerOnDeviceSide,
} from '../utils/rackDeviceFaceLabels';
import type { BuildManualConnectionVisualRoute } from '../utils/rackConnectionHelpers';

export type RackPortMismatchPayload = {
  from: RackDevice;
  to: RackDevice;
  extraSlackInches: number;
  buildVisualRoute: BuildManualConnectionVisualRoute;
};

const STANDALONE_UNIT_PX = 40;
const MIN_UNIT_PX = 3;

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (!ref) return;
  if (typeof ref === 'function') ref(value);
  else (ref as MutableRefObject<T | null>).current = value;
}

interface RackVisualizerProps {
  totalHeight: number;
  devices: RackDevice[];
  onUpdateDevicePosition: (deviceId: string, position: number, horizontalOffsetInches?: number) => void;
  onRemoveDevice: (deviceId: string) => void;
  onEditDevice: (device: RackDevice) => void;
  inchesPerRU?: number;
  /** Front-panel width in inches (default 19). */
  rackWidthInches?: number;
  /** Set on the rack frame (bordered area) for PNG export (transparent outside content). */
  rackCaptureRef?: Ref<HTMLDivElement | null>;
  /** Rack fills parent card: width and per-U height come from layout (ResizeObserver). */
  fillParent?: boolean;
  connections?: RackConnection[];
  slackAllowanceFeet?: number;
  onAddConnection?: (c: RackConnection) => void;
  onPortMismatch?: (p: RackPortMismatchPayload) => void;
  onRemoveConnection?: (connectionId: string) => void;
}

function RackUnit({
  position,
  totalHeight,
  unitHeightPx,
}: {
  position: number;
  totalHeight: number;
  unitHeightPx: number;
}) {
  return (
    <div
      style={{ height: `${unitHeightPx}px` }}
      className="rack-unit-row relative flex min-h-0 items-center border-b border-slate-700/60 bg-gradient-to-r from-slate-900/90 via-slate-800/85 to-slate-900/80 px-1 sm:px-2"
    >
      <span className="text-[11px] font-mono font-semibold tabular-nums text-slate-300 sm:text-xs">
        {totalHeight - position}U
      </span>
    </div>
  );
}

function computePositionFromDropY(args: {
  clientY: number;
  rackTop: number;
  unitHeightPx: number;
  totalHeight: number;
  itemHeightInU: number;
}): number | null {
  const { clientY, rackTop, unitHeightPx, totalHeight, itemHeightInU } = args;
  const relativeY = clientY - rackTop;
  const clickedUnit = Math.floor(relativeY / unitHeightPx);
  const position = totalHeight - clickedUnit - itemHeightInU;
  if (position >= 0 && position + itemHeightInU <= totalHeight) return position;
  return null;
}

interface DraggableDeviceProps {
  device: RackDevice;
  unitHeightPx: number;
  onEdit: (device: RackDevice) => void;
  onRemove: (deviceId: string) => void;
}

/** Match `text-sm` / `sm:text-base` — if full name fits at this size, use one line. */
function measureDisplayNameFitsOneLine(col: HTMLDivElement, text: string): boolean {
  const w = col.clientWidth;
  if (w <= 4) return false;
  const px =
    typeof window !== 'undefined' && window.matchMedia('(min-width: 640px)').matches ? 16 : 14;
  const probe = document.createElement('div');
  probe.style.boxSizing = 'border-box';
  probe.style.width = `${w}px`;
  probe.style.whiteSpace = 'nowrap';
  probe.style.overflow = 'hidden';
  probe.style.fontSize = `${px}px`;
  probe.style.fontWeight = '600';
  probe.style.letterSpacing = '-0.025em';
  probe.style.fontFamily = getComputedStyle(col).fontFamily;
  probe.textContent = text;
  col.appendChild(probe);
  const fits = probe.scrollWidth <= w;
  col.removeChild(probe);
  return fits;
}

function DraggableDevice({
  device,
  unitHeightPx,
  rackWidthInches,
  onEdit,
  onRemove,
}: DraggableDeviceProps & { rackWidthInches: number }) {
  const rw = rackWidthInches > 0 ? rackWidthInches : DEFAULT_RACK_WIDTH_INCHES;
  const placed = normalizeDeviceHorizontalFields(device, rw);
  const deviceWidthInches = getDeviceWidthInches(placed);
  const widthPct = (deviceWidthInches / rw) * 100;
  const leftPct = ((placed.horizontalOffsetInches ?? 0) / rw) * 100;
  const displayName = getDeviceDisplayName(device);
  const compactByFaceWidth = deviceWidthInches < NARROW_DEVICE_FACE_INCHES;
  const identityTwo = useMemo(
    () => getDeviceIdentityTwoLines(device),
    [device.name, device.manufacturer, device.model],
  );

  /** Narrow devices: show manufacturer only — best-effort from fields or legacy name. */
  const manufacturerLabelOnly = useMemo(() => {
    const fromField = (device.manufacturer ?? '').trim();
    if (fromField) return fromField;
    if (identityTwo?.manufacturer) return identityTwo.manufacturer;
    const inf = inferManufacturerModelFromLegacyName(device.name);
    if (inf.manufacturer) return inf.manufacturer;
    const dn = displayName.trim();
    const sp = dn.indexOf(' ');
    if (sp > 0) return dn.slice(0, sp);
    return dn;
  }, [device.manufacturer, device.name, identityTwo, displayName]);

  const heightPx = device.heightInU * unitHeightPx;
  const nameColumnRef = useRef<HTMLDivElement>(null);
  const deviceBoxRef = useRef<HTMLDivElement | null>(null);
  const [faceWidthPx, setFaceWidthPx] = useState(0);
  const [identityFitsOneLine, setIdentityFitsOneLine] = useState(true);
  const [nameColNarrow, setNameColNarrow] = useState(false);

  const remeasureIdentityLayout = useCallback(() => {
    const col = nameColumnRef.current;
    if (!col || col.clientWidth <= 4) return;
    const w = col.clientWidth;
    const narrow = w < NARROW_DEVICE_NAME_COL_PX;
    setNameColNarrow(narrow);
    if (!identityTwo) {
      setIdentityFitsOneLine(true);
      return;
    }
    if (narrow || compactByFaceWidth) {
      setIdentityFitsOneLine(false);
      return;
    }
    setIdentityFitsOneLine(measureDisplayNameFitsOneLine(col, displayName));
  }, [identityTwo, displayName, compactByFaceWidth]);

  useLayoutEffect(() => {
    remeasureIdentityLayout();
  }, [remeasureIdentityLayout]);

  useLayoutEffect(() => {
    const col = nameColumnRef.current;
    if (!col || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => remeasureIdentityLayout());
    ro.observe(col);
    return () => ro.disconnect();
  }, [remeasureIdentityLayout]);

  const useCompactLabel = nameColNarrow || compactByFaceWidth;
  const showSideManufacturer =
    faceWidthPx > 0 && shouldShowManufacturerOnDeviceSide(device, faceWidthPx, rw);

  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'device',
    item: { id: device.id, heightInU: device.heightInU, deviceWidthInches: deviceWidthInches },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }));

  const setDeviceBoxRef = useCallback(
    (node: HTMLDivElement | null) => {
      deviceBoxRef.current = node;
      drag(node);
    },
    [drag],
  );

  useLayoutEffect(() => {
    const el = deviceBoxRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setFaceWidthPx(el.clientWidth));
    ro.observe(el);
    setFaceWidthPx(el.clientWidth);
    return () => ro.disconnect();
  }, [device.id, widthPct, leftPct, heightPx]);

  return (
    <div
      ref={setDeviceBoxRef}
      data-rack-device-id={device.id}
      style={{ height: `${heightPx}px`, left: `${leftPct}%`, width: `${widthPct}%` }}
      className={`pointer-events-auto absolute z-[6] cursor-grab rounded-lg border-2 border-slate-600/90 bg-slate-950/92 pl-3 shadow-lg shadow-black/50 ring-1 ring-slate-700/80 backdrop-blur-sm transition-all active:cursor-grabbing group ${
        isDragging ? 'border-cyan-400/90 opacity-60 ring-cyan-500/30' : 'hover:border-cyan-500/60'
      }`}
    >
      <div
        className={`flex h-full min-w-0 items-center gap-0.5 px-1 py-1 sm:gap-2 ${useCompactLabel ? 'sm:px-1.5' : 'sm:px-2 sm:py-2'}`}
      >
        <GripVertical
          className={`shrink-0 text-slate-300 ${useCompactLabel ? 'size-3.5' : 'size-4 sm:size-5'}`}
          aria-hidden
        />
        <div className="flex shrink-0 flex-col gap-0.5 sm:flex-row sm:gap-0.5">
          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onEdit(device);
            }}
            className="rounded p-0.5 text-cyan-300 opacity-0 hover:bg-slate-700/90 group-hover:opacity-100 sm:p-1"
            title="Edit device"
          >
            <Edit className="size-3.5 sm:size-4" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onRemove(device.id);
            }}
            className="rounded p-0.5 text-red-400 opacity-0 hover:bg-slate-700/90 group-hover:opacity-100 sm:p-1"
            title="Remove device"
          >
            <Trash2 className="size-3.5 sm:size-4" />
          </button>
        </div>
        <div
          ref={nameColumnRef}
          className="min-w-0 flex-1 pr-1 sm:pr-2"
          title={displayName}
        >
          {useCompactLabel ? (
            showSideManufacturer && identityTwo ? (
              <p
                className="break-words text-xs font-semibold leading-snug tracking-tight text-slate-50 sm:text-sm"
                style={{ maxHeight: Math.max(0, heightPx - 28), overflow: 'hidden' }}
              >
                {identityTwo.model.trim() || '—'}
              </p>
            ) : showSideManufacturer ? (
              <div className="truncate text-xs font-semibold tracking-tight text-slate-50 sm:text-sm">
                {displayName}
              </div>
            ) : (
              <p
                className="break-words text-xs font-semibold leading-snug tracking-tight text-slate-50 sm:text-sm"
                style={{ maxHeight: Math.max(0, heightPx - 28), overflow: 'hidden' }}
              >
                {manufacturerLabelOnly}
              </p>
            )
          ) : identityTwo && identityFitsOneLine ? (
            <div className="truncate text-sm font-semibold tracking-tight text-slate-50 sm:text-base">
              {displayName}
            </div>
          ) : identityTwo ? (
            <div className="flex min-h-0 flex-col gap-1 leading-snug">
              <div className="truncate text-sm font-semibold tracking-tight text-slate-50 sm:text-base">
                {identityTwo.manufacturer}
              </div>
              <div className="truncate text-xs font-medium text-slate-200 sm:text-sm">
                {identityTwo.model}
              </div>
            </div>
          ) : (
            <div className="truncate text-sm font-semibold tracking-tight text-slate-50 sm:text-base">
              {displayName}
            </div>
          )}
          <div className="truncate text-[11px] font-medium text-slate-300 sm:text-xs">
            {device.heightInU}U • {getDeviceWidthInches(placed)}&quot; • {device.category}
          </div>
        </div>
      </div>
    </div>
  );
}

interface DroppableRackProps {
  totalHeight: number;
  devices: RackDevice[];
  unitHeightPx: number;
  rackWidthPx: number;
  rackHeightPx: number;
  rackContainerId: string;
  onUpdateDevicePosition: (deviceId: string, position: number, horizontalOffsetInches?: number) => void;
  onEditDevice: (device: RackDevice) => void;
  onRemoveDevice: (deviceId: string) => void;
  stretchWidth?: boolean;
  rackCaptureRef?: Ref<HTMLDivElement | null>;
  connections?: RackConnection[];
  inchesPerRU?: number;
  slackAllowanceFeet?: number;
  rackWidthInches: number;
  onAddConnection?: (c: RackConnection) => void;
  onPortMismatch?: (p: RackPortMismatchPayload) => void;
  onRemoveConnection?: (connectionId: string) => void;
}

function DroppableRack({
  totalHeight,
  devices,
  unitHeightPx,
  rackWidthPx,
  rackHeightPx,
  rackContainerId,
  onUpdateDevicePosition,
  onEditDevice,
  onRemoveDevice,
  stretchWidth,
  rackCaptureRef,
  connections = [],
  inchesPerRU = DEFAULT_INCHES_PER_RU,
  slackAllowanceFeet = 0,
  onAddConnection,
  onPortMismatch,
  onRemoveConnection,
  rackWidthInches,
}: DroppableRackProps) {
  const unitPxRef = useRef(unitHeightPx);
  unitPxRef.current = unitHeightPx;
  const devicesRef = useRef(devices);
  devicesRef.current = devices;
  const rw = rackWidthInches > 0 ? rackWidthInches : DEFAULT_RACK_WIDTH_INCHES;

  const [, drop] = useDrop(
    () => ({
      accept: 'device',
      drop: (item: { id: string; heightInU: number; deviceWidthInches?: number }, monitor) => {
        const offset = monitor.getClientOffset();
        if (!offset) return;
        const rackElement = document.getElementById(rackContainerId);
        if (!rackElement) return;
        const rect = rackElement.getBoundingClientRect();
        const u = unitPxRef.current;
        const position = computePositionFromDropY({
          clientY: offset.y,
          rackTop: rect.top,
          unitHeightPx: u,
          totalHeight,
          itemHeightInU: item.heightInU,
        });
        if (position === null) return;
        const fromList = devicesRef.current.find((d) => d.id === item.id);
        const dw =
          item.deviceWidthInches ??
          (fromList ? getDeviceWidthInches(normalizeDeviceHorizontalFields(fromList, rw)) : getDeviceWidthInches({}));
        const horizontalOffsetInches = horizontalOffsetInchesFromDropX({
          clientX: offset.x,
          rackLeft: rect.left,
          rackWidthPx: rect.width,
          rackWidthInches: rw,
          deviceWidthInches: dw,
        });
        onUpdateDevicePosition(item.id, position, horizontalOffsetInches);
      },
    }),
    [totalHeight, onUpdateDevicePosition, rackContainerId, rw],
  );

  const setDropAndCaptureRef = useCallback(
    (node: HTMLDivElement | null) => {
      drop(node);
      assignRef(rackCaptureRef, node);
    },
    [drop, rackCaptureRef],
  );

  return (
    <div
      ref={setDropAndCaptureRef}
      id={rackContainerId}
      className={`relative max-w-full overflow-hidden rounded-lg border-2 border-slate-600/70 bg-slate-950/30 shadow-[0_8px_32px_rgba(0,0,0,0.45)] ${
        stretchWidth ? 'w-full min-w-0' : ''
      }`}
      style={
        stretchWidth
          ? { height: `${rackHeightPx}px`, width: '100%' }
          : { height: `${rackHeightPx}px`, width: `${rackWidthPx}px` }
      }
    >
      <div className="absolute inset-0 flex flex-col">
        {Array.from({ length: totalHeight }, (_, i) => (
          <RackUnit key={i} position={i} totalHeight={totalHeight} unitHeightPx={unitHeightPx} />
        ))}
      </div>

      {devices
        .filter((d) => d.rackPosition !== undefined)
        .map((device) => {
          const topPosition = (totalHeight - device.rackPosition! - device.heightInU) * unitHeightPx;
          const rowH = device.heightInU * unitHeightPx;
          return (
            <div
              key={device.id}
              className="absolute inset-x-0"
              style={{ top: `${topPosition}px`, height: `${rowH}px` }}
            >
              <DraggableDevice
                device={device}
                unitHeightPx={unitHeightPx}
                rackWidthInches={rw}
                onEdit={onEditDevice}
                onRemove={onRemoveDevice}
              />
            </div>
          );
        })}

      {onAddConnection &&
        onPortMismatch &&
        devices.some((d) => d.rackPosition !== undefined) && (
          <RackCableOverlay
            totalHeight={totalHeight}
            placedDevices={devices.filter((d) => d.rackPosition !== undefined)}
            unitHeightPx={unitHeightPx}
            rackWidthPx={rackWidthPx}
            rackHeightPx={rackHeightPx}
            connections={connections}
            inchesPerRU={inchesPerRU}
            slackAllowanceFeet={slackAllowanceFeet}
            rackWidthInches={rw}
            onAddConnection={onAddConnection}
            onPortMismatch={onPortMismatch}
            onRemoveConnection={onRemoveConnection}
          />
        )}
    </div>
  );
}

function StandaloneRack(
  props: Omit<RackVisualizerProps, 'fillParent' | 'inchesPerRU'> & { inchesPerRU: number },
) {
  const {
    totalHeight,
    devices,
    onUpdateDevicePosition,
    onRemoveDevice,
    onEditDevice,
    inchesPerRU,
    rackCaptureRef,
    connections,
    slackAllowanceFeet,
    onAddConnection,
    onPortMismatch,
    onRemoveConnection,
    rackWidthInches = DEFAULT_RACK_WIDTH_INCHES,
  } = props;
  const rackId = useId().replace(/:/g, '');
  const rackContainerId = `rack-container-${rackId}`;
  const rackHeightPx = totalHeight * STANDALONE_UNIT_PX;
  const rackWidthPx = rackFaceWidthPx({
    rackHeightPx,
    totalHeight,
    inchesPerRU,
    rackWidthInches,
  });

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="text-center text-sm text-gray-600">
        Drag from the list onto the rack. Drag a placed device from anywhere on its box to move it, or drop it on
        the unassigned list to remove it from the rack.
      </div>
      <div className="text-center text-xs text-gray-500">
        Total Height: {totalHeight}U ({(totalHeight * inchesPerRU).toFixed(1)}&quot; /{' '}
        {(totalHeight * inchesPerRU * 2.54).toFixed(1)} cm) · Width: {rackWidthInches}&quot; (
        {(rackWidthInches * 2.54).toFixed(1)} cm)
      </div>
      <DroppableRack
        rackContainerId={rackContainerId}
        totalHeight={totalHeight}
        devices={devices}
        unitHeightPx={STANDALONE_UNIT_PX}
        rackWidthPx={rackWidthPx}
        rackHeightPx={rackHeightPx}
        rackCaptureRef={rackCaptureRef}
        rackWidthInches={rackWidthInches}
        onUpdateDevicePosition={onUpdateDevicePosition}
        onEditDevice={onEditDevice}
        onRemoveDevice={onRemoveDevice}
        connections={connections}
        inchesPerRU={inchesPerRU}
        slackAllowanceFeet={slackAllowanceFeet}
        onAddConnection={onAddConnection}
        onPortMismatch={onPortMismatch}
        onRemoveConnection={onRemoveConnection}
      />
    </div>
  );
}

function FillParentRack(
  props: Omit<RackVisualizerProps, 'fillParent' | 'inchesPerRU'> & { inchesPerRU: number },
) {
  const {
    totalHeight,
    devices,
    onUpdateDevicePosition,
    onRemoveDevice,
    onEditDevice,
    inchesPerRU,
    rackCaptureRef,
    connections,
    slackAllowanceFeet,
    onAddConnection,
    onPortMismatch,
    onRemoveConnection,
    rackWidthInches = DEFAULT_RACK_WIDTH_INCHES,
  } = props;
  const rackId = useId().replace(/:/g, '');
  const rackContainerId = `rack-container-${rackId}`;
  const measureRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ width: 320, height: Math.max(totalHeight * STANDALONE_UNIT_PX, 200) });

  useLayoutEffect(() => {
    const el = measureRef.current;
    if (!el) return;
    let raf = 0;
    const ro = new ResizeObserver((entries) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const cr = entries[0]?.contentRect;
        if (!cr) return;
        setBox({
          width: Math.max(cr.width, 120),
          height: Math.max(cr.height, totalHeight * MIN_UNIT_PX),
        });
      });
    });
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [totalHeight]);

  const rackHeightPx = Math.max(box.height, totalHeight * MIN_UNIT_PX);
  const rackWidthPx = rackFaceWidthPx({
    rackHeightPx,
    totalHeight,
    inchesPerRU,
    rackWidthInches,
    maxWidthPx: box.width,
  });
  const unitPx = Math.max(rackHeightPx / Math.max(totalHeight, 1), MIN_UNIT_PX);

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-3">
      <p className="shrink-0 text-center text-sm text-slate-400">
        Drag from the list onto the rack. Drop left/right to set horizontal offset. On the same rack U, the{' '}
        <strong className="text-slate-300">sum of device widths</strong> cannot exceed the rack width ({rackWidthInches}
        &quot;); use the pencil on a device to set width and offset. Drop on the unassigned list to return a device to
        the pool.
      </p>
      <p className="shrink-0 text-center text-xs text-slate-500">
        Total Height: {totalHeight}U ({(totalHeight * inchesPerRU).toFixed(1)}&quot; /{' '}
        {(totalHeight * inchesPerRU * 2.54).toFixed(1)} cm) · Width: {rackWidthInches}&quot; (
        {(rackWidthInches * 2.54).toFixed(1)} cm)
      </p>
      <div
        ref={measureRef}
        className="rack-measure-area flex min-h-[160px] w-full min-w-0 flex-1 flex-col items-center justify-center overflow-visible lg:min-h-0"
      >
        <DroppableRack
          rackContainerId={rackContainerId}
          totalHeight={totalHeight}
          devices={devices}
          unitHeightPx={unitPx}
          rackWidthPx={rackWidthPx}
          rackHeightPx={rackHeightPx}
          rackCaptureRef={rackCaptureRef}
          rackWidthInches={rackWidthInches}
          onUpdateDevicePosition={onUpdateDevicePosition}
          onEditDevice={onEditDevice}
          onRemoveDevice={onRemoveDevice}
          connections={connections}
          inchesPerRU={inchesPerRU}
          slackAllowanceFeet={slackAllowanceFeet}
          onAddConnection={onAddConnection}
          onPortMismatch={onPortMismatch}
          onRemoveConnection={onRemoveConnection}
        />
      </div>
    </div>
  );
}

export function RackVisualizer({
  totalHeight,
  devices,
  onUpdateDevicePosition,
  onRemoveDevice,
  onEditDevice,
  inchesPerRU = DEFAULT_INCHES_PER_RU,
  rackWidthInches = DEFAULT_RACK_WIDTH_INCHES,
  rackCaptureRef,
  fillParent = false,
  connections,
  slackAllowanceFeet = 0,
  onAddConnection,
  onPortMismatch,
  onRemoveConnection,
}: RackVisualizerProps) {
  const common = {
    totalHeight,
    devices,
    onUpdateDevicePosition,
    onRemoveDevice,
    onEditDevice,
    inchesPerRU,
    rackWidthInches,
    rackCaptureRef,
    connections,
    slackAllowanceFeet,
    onAddConnection,
    onPortMismatch,
    onRemoveConnection,
  };
  return fillParent ? <FillParentRack {...common} /> : <StandaloneRack {...common} />;
}
