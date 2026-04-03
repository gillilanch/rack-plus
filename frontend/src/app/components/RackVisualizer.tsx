import {
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type MutableRefObject,
  type Ref,
} from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { RackDevice } from '../types/rack';
import { Trash2, Edit, GripVertical } from 'lucide-react';
import { DEFAULT_INCHES_PER_RU } from '../utils/rackUnits';

const STANDALONE_UNIT_PX = 40;
const STANDALONE_RACK_WIDTH_PX = 400;
const MIN_UNIT_PX = 3;

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (!ref) return;
  if (typeof ref === 'function') ref(value);
  else (ref as MutableRefObject<T | null>).current = value;
}

interface RackVisualizerProps {
  totalHeight: number;
  devices: RackDevice[];
  onUpdateDevicePosition: (deviceId: string, position: number) => void;
  onRemoveDevice: (deviceId: string) => void;
  onEditDevice: (device: RackDevice) => void;
  inchesPerRU?: number;
  /** Set on the rack frame (bordered area) for JPG export / screenshots. */
  rackCaptureRef?: Ref<HTMLDivElement | null>;
  /** Rack fills parent card: width and per-U height come from layout (ResizeObserver). */
  fillParent?: boolean;
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
      className="relative flex min-h-0 items-center border-b border-gray-300 bg-gradient-to-r from-gray-100 to-gray-50 px-1 sm:px-2"
    >
      <span className="text-[10px] font-mono text-gray-400 sm:text-xs">{totalHeight - position}U</span>
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

function DraggableDevice({ device, unitHeightPx, onEdit, onRemove }: DraggableDeviceProps) {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'device',
    item: { id: device.id, heightInU: device.heightInU },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }));

  const heightPx = device.heightInU * unitHeightPx;

  return (
    <div
      ref={drag}
      style={{ height: `${heightPx}px` }}
      className={`absolute left-0 right-0 cursor-grab rounded border-2 bg-white shadow-md transition-all active:cursor-grabbing group ${
        isDragging ? 'border-blue-400 opacity-50' : 'border-gray-400 hover:border-blue-500'
      }`}
    >
      <div className="flex h-full min-w-0 items-center justify-between gap-1 px-1 py-1 sm:px-2 sm:py-2">
        <div className="flex min-w-0 flex-1 items-center gap-1 sm:gap-2">
          <GripVertical className="size-4 shrink-0 text-gray-400 sm:size-5" aria-hidden />
          <div className="min-w-0">
            <div className="truncate text-xs font-medium text-gray-900 sm:text-sm">{device.name}</div>
            <div className="truncate text-[10px] text-gray-500 sm:text-xs">
              {device.heightInU}U • {device.category}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 gap-0.5 sm:gap-1">
          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onEdit(device);
            }}
            className="rounded p-0.5 text-blue-600 opacity-0 hover:bg-blue-50 group-hover:opacity-100 sm:p-1"
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
            className="rounded p-0.5 text-red-600 opacity-0 hover:bg-red-50 group-hover:opacity-100 sm:p-1"
            title="Remove device"
          >
            <Trash2 className="size-3.5 sm:size-4" />
          </button>
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
  onUpdateDevicePosition: (deviceId: string, position: number) => void;
  onEditDevice: (device: RackDevice) => void;
  onRemoveDevice: (deviceId: string) => void;
  stretchWidth?: boolean;
  rackCaptureRef?: Ref<HTMLDivElement | null>;
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
}: DroppableRackProps) {
  const unitPxRef = useRef(unitHeightPx);
  unitPxRef.current = unitHeightPx;

  const [, drop] = useDrop(
    () => ({
      accept: 'device',
      drop: (item: { id: string; heightInU: number }, monitor) => {
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
        if (position !== null) onUpdateDevicePosition(item.id, position);
      },
    }),
    [totalHeight, onUpdateDevicePosition, rackContainerId],
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
      className={`relative max-w-full rounded-lg border-4 border-gray-800 bg-white shadow-xl ${
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
          return (
            <div key={device.id} className="absolute left-0 right-0" style={{ top: `${topPosition}px` }}>
              <DraggableDevice
                device={device}
                unitHeightPx={unitHeightPx}
                onEdit={onEditDevice}
                onRemove={onRemoveDevice}
              />
            </div>
          );
        })}
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
  } = props;
  const rackId = useId().replace(/:/g, '');
  const rackContainerId = `rack-container-${rackId}`;
  const rackHeightPx = totalHeight * STANDALONE_UNIT_PX;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="text-center text-sm text-gray-600">
        Drag from the list onto the rack. Drag a placed device from anywhere on its box to move it, or drop it on
        the unassigned list to remove it from the rack.
      </div>
      <div className="text-center text-xs text-gray-500">
        Total Height: {totalHeight}U ({(totalHeight * inchesPerRU).toFixed(1)}&quot; /{' '}
        {(totalHeight * inchesPerRU * 2.54).toFixed(1)} cm)
      </div>
      <DroppableRack
        rackContainerId={rackContainerId}
        totalHeight={totalHeight}
        devices={devices}
        unitHeightPx={STANDALONE_UNIT_PX}
        rackWidthPx={STANDALONE_RACK_WIDTH_PX}
        rackHeightPx={rackHeightPx}
        rackCaptureRef={rackCaptureRef}
        onUpdateDevicePosition={onUpdateDevicePosition}
        onEditDevice={onEditDevice}
        onRemoveDevice={onRemoveDevice}
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
  const rackWidthPx = Math.max(box.width, 120);
  const unitPx = Math.max(rackHeightPx / Math.max(totalHeight, 1), MIN_UNIT_PX);

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-3">
      <p className="shrink-0 text-center text-sm text-gray-600">
        Drag from the list onto the rack. Drag a placed device from anywhere on its box; drop on the unassigned
        list to return it to the pool.
      </p>
      <p className="shrink-0 text-center text-xs text-gray-500">
        Total Height: {totalHeight}U ({(totalHeight * inchesPerRU).toFixed(1)}&quot; /{' '}
        {(totalHeight * inchesPerRU * 2.54).toFixed(1)} cm)
      </p>
      <div
        ref={measureRef}
        className="flex min-h-[160px] w-full min-w-0 flex-1 flex-col items-stretch justify-center overflow-hidden lg:min-h-0"
      >
        <DroppableRack
          rackContainerId={rackContainerId}
          totalHeight={totalHeight}
          devices={devices}
          unitHeightPx={unitPx}
          rackWidthPx={rackWidthPx}
          rackHeightPx={rackHeightPx}
          stretchWidth
          rackCaptureRef={rackCaptureRef}
          onUpdateDevicePosition={onUpdateDevicePosition}
          onEditDevice={onEditDevice}
          onRemoveDevice={onRemoveDevice}
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
  rackCaptureRef,
  fillParent = false,
}: RackVisualizerProps) {
  const common = {
    totalHeight,
    devices,
    onUpdateDevicePosition,
    onRemoveDevice,
    onEditDevice,
    inchesPerRU,
    rackCaptureRef,
  };
  return fillParent ? <FillParentRack {...common} /> : <StandaloneRack {...common} />;
}
