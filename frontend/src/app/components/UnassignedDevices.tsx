import { useDrag, useDrop } from 'react-dnd';
import { RackDevice } from '../types/rack';
import { GripVertical, Edit, Trash2 } from 'lucide-react';

/** ~7 device rows visible; remainder scrolls inside this panel. */
const UNASSIGNED_LIST_MAX_HEIGHT = 'min(31.5rem, 56vh)';

interface UnassignedDevicesProps {
  devices: RackDevice[];
  onEditDevice: (device: RackDevice) => void;
  onRemoveDevice: (deviceId: string) => void;
  /** Drop a device from the rack here to clear its rack position. */
  onReturnFromRack?: (deviceId: string) => void;
}

interface DraggableUnassignedDeviceProps {
  device: RackDevice;
  onEdit: (device: RackDevice) => void;
  onRemove: (deviceId: string) => void;
}

function DraggableUnassignedDevice({ device, onEdit, onRemove }: DraggableUnassignedDeviceProps) {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'device',
    item: { id: device.id, heightInU: device.heightInU },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }));

  return (
    <div
      ref={drag}
      className={`p-3 border rounded-lg bg-white hover:border-blue-500 transition-all cursor-move group ${
        isDragging ? 'opacity-50 border-blue-400' : 'border-gray-300'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <GripVertical className="size-5 text-gray-400 flex-shrink-0" />
          <div className="min-w-0">
            <div className="font-medium text-gray-900 text-sm truncate">
              {device.name}
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
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
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onEdit(device);
            }}
            className="p-1 hover:bg-blue-50 rounded text-blue-600"
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
            className="p-1 hover:bg-red-50 rounded text-red-600"
            title="Remove device"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function UnassignedDevices({
  devices,
  onEditDevice,
  onRemoveDevice,
  onReturnFromRack,
}: UnassignedDevicesProps) {
  const unassignedDevices = devices.filter((d) => d.rackPosition === undefined);

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
        className={`flex min-h-[10rem] flex-1 items-center justify-center rounded-lg border-2 border-dashed p-8 text-center text-gray-500 transition-colors lg:min-h-0 ${
          isOver ? 'border-blue-400 bg-blue-50/50' : 'border-gray-300'
        }`}
      >
        <div>
          <p>All devices have been placed in the rack</p>
          {onReturnFromRack && (
            <p className="mt-2 text-xs text-gray-400">Drop a device here to return it to the pool</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div ref={drop} className={`flex h-full min-h-0 flex-col gap-3 rounded-lg transition-colors ${isOver ? 'bg-blue-50/40 ring-2 ring-blue-200' : ''}`}>
      <div className="flex shrink-0 items-center justify-between">
        <h3 className="font-semibold text-gray-900">
          Unassigned Devices ({unassignedDevices.length})
        </h3>
        <div className="text-xs text-gray-500">
          Drag to rack · drop here to unplace
        </div>
      </div>
      <div
        className="min-h-0 space-y-2 overflow-y-auto overscroll-contain pr-0.5 [scrollbar-gutter:stable]"
        style={{ maxHeight: UNASSIGNED_LIST_MAX_HEIGHT }}
      >
        {unassignedDevices.map((device) => (
          <DraggableUnassignedDevice
            key={device.id}
            device={device}
            onEdit={onEditDevice}
            onRemove={onRemoveDevice}
          />
        ))}
      </div>
    </div>
  );
}
