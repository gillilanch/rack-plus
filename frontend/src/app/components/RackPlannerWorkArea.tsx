import type { Ref } from 'react';
import type { Port } from '../data/equipment';
import type { RackConnection, RackDevice } from '../types/rack';
import { CSVImport, type CsvImportCompletePayload, type CsvRackExportContext } from './CSVImport';
import { ManualDeviceAdd } from './ManualDeviceAdd';
import { RackCableConnectionsPanel } from './RackCableConnectionsPanel';
import { RackVisualizer } from './RackVisualizer';
import { UnassignedDevices } from './UnassignedDevices';

/**
 * Left card: unassigned (scroll) → CSV → manual → cable paths. On lg, grid stretch makes the rack
 * card the same height as this column so the rack reaches the bottom of the connections block.
 */
export function RackDevicesColumn(props: {
  devices: RackDevice[];
  onEditDevice: (d: RackDevice) => void;
  onRemoveDevice: (id: string) => void;
  onReturnFromRack?: (deviceId: string) => void;
  onCsvImportComplete: (payload: CsvImportCompletePayload) => void;
  pendingCsvUnmatchedCount?: number;
  onReopenCsvReview?: () => void;
  rackExportContext?: CsvRackExportContext;
  onAddManualDevice: (data: {
    manufacturer: string;
    model: string;
    name: string;
    category: string;
    heightInU: number;
    heightInches?: number;
    ports?: Port[];
  }) => void;
}) {
  const {
    devices,
    onEditDevice,
    onRemoveDevice,
    onReturnFromRack,
    onCsvImportComplete,
    pendingCsvUnmatchedCount,
    onReopenCsvReview,
    rackExportContext,
    onAddManualDevice,
  } = props;
  return (
    <section className="flex h-full min-h-0 flex-col gap-6 rounded-xl border-2 border-slate-200 bg-white p-6 shadow-xl [contain:layout]">
      <div className="min-h-[10rem] shrink-0 rounded-lg border border-gray-100 bg-slate-50/70 p-2 lg:min-h-0 lg:flex-1 lg:overflow-hidden">
        <UnassignedDevices
          devices={devices}
          onEditDevice={onEditDevice}
          onRemoveDevice={onRemoveDevice}
          onReturnFromRack={onReturnFromRack}
        />
      </div>
      <div className="shrink-0 border-t border-slate-200 pt-6">
        <h3 className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-[#CC0000]">Add more devices</h3>
        <CSVImport
          onCsvImportComplete={onCsvImportComplete}
          pendingUnmatchedCount={pendingCsvUnmatchedCount}
          onReopenCsvReview={onReopenCsvReview}
          rackExportContext={rackExportContext}
          uiVariant="cable"
        />
      </div>
      <div className="shrink-0 border-t border-gray-100 pt-6">
        <h3 className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-[#CC0000]">
          Add a device manually
        </h3>
        <ManualDeviceAdd onAddDevice={onAddManualDevice} uiVariant="cable" />
      </div>
      <RackCableConnectionsPanel devices={devices} />
    </section>
  );
}

/** Rack card fills the grid cell so its bottom aligns with the left column (including connections). */
export function RackPreviewColumn(props: {
  totalHeight: number;
  inchesPerRU: number;
  rackWidthInches?: number;
  devices: RackDevice[];
  rackCaptureRef?: Ref<HTMLDivElement | null>;
  onUpdateDevicePosition: (deviceId: string, position: number) => void;
  onRemoveDevice: (deviceId: string) => void;
  onEditDevice: (device: RackDevice) => void;
  connections?: RackConnection[];
  slackAllowanceFeet?: number;
  onAddConnection?: (c: RackConnection) => void;
  onPortMismatch?: (p: { from: RackDevice; to: RackDevice; extraSlackInches: number }) => void;
  onRemoveConnection?: (connectionId: string) => void;
}) {
  return (
    <section className="rack-preview-column flex min-h-[min(60vh,22rem)] flex-col rounded-xl border-2 border-slate-200 bg-white p-6 shadow-xl lg:h-full lg:min-h-0 [contain:layout]">
      <div className="flex min-h-0 flex-1 flex-col">
        <RackVisualizer
          fillParent
          totalHeight={props.totalHeight}
          inchesPerRU={props.inchesPerRU}
          rackWidthInches={props.rackWidthInches}
          devices={props.devices}
          rackCaptureRef={props.rackCaptureRef}
          onUpdateDevicePosition={props.onUpdateDevicePosition}
          onRemoveDevice={props.onRemoveDevice}
          onEditDevice={props.onEditDevice}
          connections={props.connections}
          slackAllowanceFeet={props.slackAllowanceFeet}
          onAddConnection={props.onAddConnection}
          onPortMismatch={props.onPortMismatch}
          onRemoveConnection={props.onRemoveConnection}
        />
      </div>
    </section>
  );
}

export function RackPlannerWorkArea(props: {
  devices: RackDevice[];
  totalHeight: number;
  inchesPerRU: number;
  rackWidthInches?: number;
  rackCaptureRef?: Ref<HTMLDivElement | null>;
  onEditDevice: (d: RackDevice) => void;
  onRemoveDevice: (id: string) => void;
  onReturnFromRack: (deviceId: string) => void;
  onCsvImportComplete: (payload: CsvImportCompletePayload) => void;
  pendingCsvUnmatchedCount?: number;
  onReopenCsvReview?: () => void;
  rackExportContext?: CsvRackExportContext;
  onAddManualDevice: (data: {
    manufacturer: string;
    model: string;
    name: string;
    category: string;
    heightInU: number;
    heightInches?: number;
    ports?: Port[];
  }) => void;
  onUpdateDevicePosition: (deviceId: string, position: number) => void;
  connections?: RackConnection[];
  slackAllowanceFeet?: number;
  onAddConnection?: (c: RackConnection) => void;
  onPortMismatch?: (p: { from: RackDevice; to: RackDevice; extraSlackInches: number }) => void;
  onRemoveConnection?: (connectionId: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-stretch">
      <RackDevicesColumn
        devices={props.devices}
        onEditDevice={props.onEditDevice}
        onRemoveDevice={props.onRemoveDevice}
        onReturnFromRack={props.onReturnFromRack}
        onCsvImportComplete={props.onCsvImportComplete}
        pendingCsvUnmatchedCount={props.pendingCsvUnmatchedCount}
        onReopenCsvReview={props.onReopenCsvReview}
        rackExportContext={props.rackExportContext}
        onAddManualDevice={props.onAddManualDevice}
      />
      <RackPreviewColumn
        totalHeight={props.totalHeight}
        inchesPerRU={props.inchesPerRU}
        rackWidthInches={props.rackWidthInches}
        devices={props.devices}
        rackCaptureRef={props.rackCaptureRef}
        onUpdateDevicePosition={props.onUpdateDevicePosition}
        onRemoveDevice={props.onRemoveDevice}
        onEditDevice={props.onEditDevice}
        connections={props.connections}
        slackAllowanceFeet={props.slackAllowanceFeet}
        onAddConnection={props.onAddConnection}
        onPortMismatch={props.onPortMismatch}
        onRemoveConnection={props.onRemoveConnection}
      />
    </div>
  );
}
