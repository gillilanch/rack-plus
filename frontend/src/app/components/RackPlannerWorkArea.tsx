import type { Ref } from 'react';
import { ListChecks, Plus } from 'lucide-react';
import type { RackConnection, RackDevice } from '../types/rack';
import { CSVImport, type CsvImportCompletePayload, type CsvRackExportContext } from './CSVImport';
import { ManualDeviceAdd, type ManualAddDevicePayload } from './ManualDeviceAdd';
import { RackCableConnectionsPanel } from './RackCableConnectionsPanel';
import { DEFAULT_RACK_WIDTH_INCHES } from '../utils/rackUnits';
import { RackVisualizer, type RackPortMismatchPayload } from './RackVisualizer';
import { UnassignedDevices } from './UnassignedDevices';

/**
 * Left card: unassigned (scroll) → CSV → manual → cable paths. On lg, grid stretch makes the rack
 * card the same height as this column so the rack reaches the bottom of the connections block.
 */
export function RackDevicesColumn(props: {
  devices: RackDevice[];
  rackWidthInches?: number;
  onEditDevice: (d: RackDevice) => void;
  onRemoveDevice: (id: string) => void;
  onReturnFromRack?: (deviceId: string) => void;
  onCsvImportComplete: (payload: CsvImportCompletePayload) => void;
  pendingCsvUnmatchedCount?: number;
  onReopenCsvReview?: () => void;
  rackExportContext?: CsvRackExportContext;
  onAddManualDevice: (data: ManualAddDevicePayload) => void;
}) {
  const {
    devices,
    rackWidthInches,
    onEditDevice,
    onRemoveDevice,
    onReturnFromRack,
    onCsvImportComplete,
    pendingCsvUnmatchedCount = 0,
    onReopenCsvReview,
    rackExportContext,
    onAddManualDevice,
  } = props;
  return (
    <section className="no-print flex h-full min-h-0 flex-col gap-6 rounded-xl border-2 border-slate-600/90 bg-slate-800/95 p-6 shadow-xl shadow-black/25 [contain:layout]">
      <div className="min-h-[10rem] shrink-0 rounded-lg border border-slate-600/80 bg-slate-900/50 p-2">
        <UnassignedDevices
          devices={devices}
          rackWidthInches={rackWidthInches}
          onEditDevice={onEditDevice}
          onRemoveDevice={onRemoveDevice}
          onReturnFromRack={onReturnFromRack}
        />
      </div>
      <div className="shrink-0 border-t border-slate-600/80 pt-6">
        <h3 className="mb-6 text-base font-bold uppercase tracking-[0.12em] text-[#f87171] sm:text-lg">
          Add more devices
        </h3>
        {/* Match “Build a new rack” landing: equal min-height dashed panels; CSV review banner spans both columns */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-stretch lg:gap-10">
            <div className="flex h-full min-h-0 min-w-0 flex-col">
              <CSVImport
                onCsvImportComplete={onCsvImportComplete}
                pendingUnmatchedCount={pendingCsvUnmatchedCount}
                onReopenCsvReview={onReopenCsvReview}
                rackExportContext={rackExportContext}
                uiVariant="cable"
                surface="dark"
                showCsvDownload={false}
                dashedPanelExtraClass="min-h-72 flex flex-1 min-h-0 flex-col justify-center"
                suppressPendingReviewButton
              />
            </div>
            <div className="flex h-full min-h-0 min-w-0 flex-col border-t border-slate-600/80 pt-8 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
              <div className="flex min-h-72 flex-1 flex-col justify-center rounded-xl border-2 border-dashed border-slate-600 bg-slate-800/60 p-8 text-center transition-colors hover:border-slate-500">
                <div className="flex flex-col items-center gap-4">
                  <div className="shrink-0 rounded-full bg-slate-700/80 p-4 shadow-sm">
                    <Plus className="size-12 text-[#CC0000]" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-cable-ui mb-1 font-semibold text-[#ff6b6b]">Add device manually</h3>
                    <p className="font-cable-ui text-sm text-slate-400">
                      Search the catalog or enter a custom device. It appears in the unassigned list when you add it.
                    </p>
                  </div>
                  <ManualDeviceAdd
                    onAddDevice={onAddManualDevice}
                    uiVariant="cable"
                    workSurface="rackDark"
                    landingPrimaryStyle
                  />
                </div>
              </div>
            </div>
          </div>
          {pendingCsvUnmatchedCount > 0 && onReopenCsvReview && (
            <button
              type="button"
              onClick={onReopenCsvReview}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-amber-700/60 bg-amber-950/40 px-4 py-3 text-sm font-medium text-amber-100 transition-colors hover:bg-amber-950/60"
            >
              <ListChecks className="size-4 shrink-0" />
              Review {pendingCsvUnmatchedCount} CSV name{pendingCsvUnmatchedCount !== 1 ? 's' : ''} not in database
            </button>
          )}
        </div>
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
  onUpdateDevicePosition: (deviceId: string, position: number, horizontalOffsetInches?: number) => void;
  onRemoveDevice: (deviceId: string) => void;
  onEditDevice: (device: RackDevice) => void;
  connections?: RackConnection[];
  slackAllowanceFeet?: number;
  onAddConnection?: (c: RackConnection) => void;
  onPortMismatch?: (p: RackPortMismatchPayload) => void;
  onRemoveConnection?: (connectionId: string) => void;
}) {
  const rw = props.rackWidthInches ?? DEFAULT_RACK_WIDTH_INCHES;
  return (
    <section className="rack-preview-column flex min-h-[min(60vh,22rem)] flex-col rounded-xl border-2 border-slate-600/90 bg-slate-800/95 p-6 shadow-xl shadow-black/25 lg:h-full lg:min-h-0 [contain:layout]">
      <div className="no-print mb-3 shrink-0 rounded-lg border border-amber-600/50 bg-amber-950/35 px-3 py-2 text-xs text-amber-100">
        <strong>Rack {rw}&quot; wide.</strong> Gear on the same U shares that space: total device widths must stay ≤ {rw}
        &quot; and boxes must not overlap. Open a device with the pencil to set width and left offset.
      </div>
      <div className="rack-diagram-stage flex min-h-0 flex-1 flex-col rounded-xl border border-slate-600/35 bg-slate-900/25 p-2 shadow-inner shadow-black/20 ring-1 ring-slate-600/20 sm:p-3 print:border-slate-400 print:bg-slate-100">
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
  onAddManualDevice: (data: ManualAddDevicePayload) => void;
  onUpdateDevicePosition: (deviceId: string, position: number, horizontalOffsetInches?: number) => void;
  connections?: RackConnection[];
  slackAllowanceFeet?: number;
  onAddConnection?: (c: RackConnection) => void;
  onPortMismatch?: (p: RackPortMismatchPayload) => void;
  onRemoveConnection?: (connectionId: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-stretch">
      <RackDevicesColumn
        devices={props.devices}
        rackWidthInches={props.rackWidthInches}
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
