import { memo, useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useDrag, useDrop } from 'react-dnd';
import { RackDevice } from '../types/rack';
import { getDeviceDisplayName } from '../utils/deviceDisplay';
import { getDeviceWidthInches, normalizeDeviceHorizontalFields } from '../utils/rackDevicePlacement';
import { DEFAULT_RACK_WIDTH_INCHES } from '../utils/rackUnits';
import { GripVertical, Edit, Trash2 } from 'lucide-react';

/** ~7 device rows visible; remainder scrolls inside this panel. */
const UNASSIGNED_LIST_MAX_HEIGHT = 'min(31.5rem, 56vh)';

/** Estimated row block height (card + gap); TanStack measures real height via measureElement. */
const ESTIMATE_ROW_PX = 76;
const ROW_GAP_PX = 8;

interface UnassignedDevicesProps {
  devices: RackDevice[];
  /** Used so drag payload includes width for horizontal drop placement. */
  rackWidthInches?: number;
  onEditDevice: (d: RackDevice) => void;
  onRemoveDevice: (deviceId: string) => void;
  /** Drop a device from the rack here to clear its rack position. */
  onReturnFromRack?: (deviceId: string) => void;
}

const DraggableUnassignedDevice = memo(function DraggableUnassignedDevice({
  device,
  rackWidthInches,
  onEdit,
  onRemove,
}: {
  device: RackDevice;
  rackWidthInches: number;
  onEdit: (d: RackDevice) => void;
  onRemove: (deviceId: string) => void;
}) {
  const placed = normalizeDeviceHorizontalFields(device, rackWidthInches);
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'device',
    item: {
      id: device.id,
      heightInU: device.heightInU,
      deviceWidthInches: getDeviceWidthInches(placed),
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }));

  return (
    <div
      ref={drag}
      className={`rounded-lg border bg-slate-800/90 p-3 transition-all group hover:border-sky-500 ${
        isDragging ? 'cursor-grabbing border-sky-400 opacity-50' : 'cursor-grab border-slate-600'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <GripVertical className="size-5 shrink-0 text-slate-500" />
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-slate-100">
              {getDeviceDisplayName(device)}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span>{device.heightInU}U</span>
              <span>•</span>
              <span>{device.category}</span>
              {device.ports.length > 0 && (
                <>
                  <span>•</span>
                  <span>{device.ports.length} ports</span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onEdit(device);
            }}
            className="rounded p-1 text-sky-400 hover:bg-slate-700"
            title="Edit device"
          >
            <Edit className="size-4" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onRemove(device.id);
            }}
            className="rounded p-1 text-red-400 hover:bg-slate-700"
            title="Remove device"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
});

export function UnassignedDevices({
  devices,
  rackWidthInches = DEFAULT_RACK_WIDTH_INCHES,
  onEditDevice,
  onRemoveDevice,
  onReturnFromRack,
}: UnassignedDevicesProps) {
  const unassignedDevices = useMemo(
    () => devices.filter((d) => d.rackPosition === undefined),
    [devices],
  );
  const rw = rackWidthInches > 0 ? rackWidthInches : DEFAULT_RACK_WIDTH_INCHES;
  const scrollParentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: unassignedDevices.length,
    getScrollElement: () => scrollParentRef.current,
    estimateSize: () => ESTIMATE_ROW_PX,
    gap: ROW_GAP_PX,
    overscan: 10,
    useFlushSync: false,
    getItemKey: (index) => unassignedDevices[index]!.id,
  });

  const [{ isOver }, drop] = useDrop(
    () => ({
      accept: 'device',
      canDrop: () => Boolean(onReturnFromRack),
      drop: (item: { id: string }) => {
        onReturnFromRack?.(item.id);
      },
      collect: (monitor) => ({
        isOver: monitor.isOver({ shallow: true }) && monitor.canDrop(),
      }),
    }),
    [onReturnFromRack],
  );

  if (unassignedDevices.length === 0) {
    return (
      <div
        ref={drop}
        className={`flex min-h-[10rem] flex-1 items-center justify-center rounded-lg border-2 border-dashed p-8 text-center text-slate-400 transition-colors lg:min-h-0 ${
          isOver ? 'border-sky-500 bg-sky-950/30' : 'border-slate-600'
        }`}
      >
        <div>
          <p>All devices have been placed in the rack</p>
          {onReturnFromRack && (
            <p className="mt-2 text-xs text-slate-500">Drop a device here to return it to the pool</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={drop}
      className={`flex h-full min-h-0 flex-col gap-3 rounded-lg transition-colors ${isOver ? 'bg-sky-950/25 ring-2 ring-sky-600/50' : ''}`}
    >
      <div className="flex shrink-0 items-center justify-between">
        <h3 className="font-semibold text-slate-100">
          Unassigned Devices ({unassignedDevices.length})
        </h3>
        <div className="text-xs text-slate-500">Drag to rack · drop here to unplace</div>
      </div>
      <div
        ref={scrollParentRef}
        className="min-h-0 overflow-y-auto overscroll-contain pr-0.5 [scrollbar-gutter:stable]"
        style={{ maxHeight: UNASSIGNED_LIST_MAX_HEIGHT }}
      >
        <div
          className="relative w-full"
          style={{ height: `${virtualizer.getTotalSize()}px` }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const device = unassignedDevices[virtualRow.index]!;
            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                className="left-0 top-0 w-full"
                style={{
                  position: 'absolute',
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <DraggableUnassignedDevice
                  device={device}
                  rackWidthInches={rw}
                  onEdit={onEditDevice}
                  onRemove={onRemoveDevice}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
