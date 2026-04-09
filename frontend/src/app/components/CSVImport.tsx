import { useRef, useState } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, Download, Link2, ListChecks } from 'lucide-react';
import Papa from 'papaparse';
import { getDeviceDisplayName } from '../utils/deviceDisplay';
import {
  deviceCategoryToManualLabel,
  mergeBuiltInAndCustomDevices,
  resolvePartsNameToCatalogDevice,
} from '../utils/deviceCatalogSearch';
import {
  CsvCellCandidate,
  dedupeCandidates,
  extractCandidatesFromMatrix,
  extractCandidatesFromObjectRows,
} from '../utils/csvGridExtract';
import type { CsvUnmatchedQueueItem } from './CsvUnmatchedReviewModal';
import type { RackConnection, RackDevice } from '../types/rack';
import { buildRackPartsExportCsv } from '../utils/rackExportCsv';

export type CsvImportCompletePayload = {
  matchedDevices: RackDevice[];
  unmatchedItems: CsvUnmatchedQueueItem[];
  summary: ImportMatchSummary;
};

type ImportMatchSummary = {
  exact: number;
  fuzzy: number;
  unmatched: number;
  unmatchedNames: string[];
};

export type CsvRackExportContext = {
  placedDevices: RackDevice[];
  connections: RackConnection[];
};

interface CSVImportProps {
  onCsvImportComplete: (payload: CsvImportCompletePayload) => void;
  pendingUnmatchedCount?: number;
  onReopenCsvReview?: () => void;
  /** When set, download exports current rack parts + connections instead of a blank template. */
  rackExportContext?: CsvRackExportContext;
  /** Matches Cable Identification System palette (navy / red / slate). */
  uiVariant?: 'default' | 'cable';
  /** Hide CSV download (template / rack export) — e.g. on the pre-rack import screen. */
  showCsvDownload?: boolean;
}

function partitionCandidates(
  candidates: CsvCellCandidate[],
  pool: ReturnType<typeof mergeBuiltInAndCustomDevices>,
  batchId: string,
): { matchedDevices: RackDevice[]; unmatchedItems: CsvUnmatchedQueueItem[]; summary: ImportMatchSummary } {
  const matchedMap = new Map<string, RackDevice>();
  const unmatchedList: CsvUnmatchedQueueItem[] = [];
  const unmatchedSeen = new Set<string>();
  let exact = 0;
  let fuzzy = 0;
  let mIdx = 0;
  let uIdx = 0;

  for (const c of candidates) {
    const resolved = resolvePartsNameToCatalogDevice(c.text, pool);
    if (resolved) {
      const mfr = (resolved.device.manufacturer ?? '').trim();
      const mdl = (resolved.device.model ?? '').trim();
      const displayName = getDeviceDisplayName({
        name: resolved.device.name,
        manufacturer: mfr,
        model: mdl,
      });
      const key = displayName.toLowerCase();
      const existing = matchedMap.get(key);
      if (!existing) {
        matchedMap.set(key, {
          id: `imported-${batchId}-m-${mIdx++}`,
          name: displayName,
          manufacturer: mfr,
          model: mdl,
          category: deviceCategoryToManualLabel(resolved.device.category) as RackDevice['category'],
          heightInU: Math.max(1, c.heightInU),
          physicalHeightInches: c.physicalHeightInches,
          ports: resolved.device.ports.length > 0 ? [...resolved.device.ports] : [],
        });
        if (resolved.match === 'exact') exact += 1;
        else fuzzy += 1;
      } else {
        existing.heightInU = Math.max(existing.heightInU, c.heightInU);
        if (c.physicalHeightInches != null) {
          existing.physicalHeightInches = c.physicalHeightInches;
        }
      }
    } else {
      const nl = c.text.toLowerCase();
      if (!unmatchedSeen.has(nl)) {
        unmatchedSeen.add(nl);
        unmatchedList.push({
          id: `csv-pend-${batchId}-${uIdx++}`,
          name: c.text,
          heightInU: Math.max(1, c.heightInU),
          category: c.category,
          physicalHeightInches: c.physicalHeightInches,
        });
      }
    }
  }

  return {
    matchedDevices: [...matchedMap.values()],
    unmatchedItems: unmatchedList,
    summary: {
      exact,
      fuzzy,
      unmatched: unmatchedList.length,
      unmatchedNames: unmatchedList.map((u) => u.name),
    },
  };
}

export function CSVImport({
  onCsvImportComplete,
  pendingUnmatchedCount = 0,
  onReopenCsvReview,
  rackExportContext,
  uiVariant = 'default',
  showCsvDownload = true,
}: CSVImportProps) {
  const cable = uiVariant === 'cable';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [matchSummary, setMatchSummary] = useState<ImportMatchSummary | null>(null);
  const [emptyRackExportConfirmOpen, setEmptyRackExportConfirmOpen] = useState(false);

  const runRackExportDownload = () => {
    const placed = rackExportContext?.placedDevices ?? [];
    const conns = rackExportContext?.connections ?? [];
    const csv = buildRackPartsExportCsv(placed, conns);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'rack_parts_and_connections.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadTemplate = () => {
    const placed = rackExportContext?.placedDevices ?? [];
    if (placed.length === 0) {
      setEmptyRackExportConfirmOpen(true);
      return;
    }
    runRackExportDownload();
  };

  const emitImport = (
    candidates: CsvCellCandidate[],
    pool: ReturnType<typeof mergeBuiltInAndCustomDevices>,
    batchId: string,
  ) => {
    const deduped = dedupeCandidates(candidates);
    if (deduped.length === 0) {
      setError('No text values found in the sheet (all cells empty or numeric-only).');
      return;
    }

    const payload = partitionCandidates(deduped, pool, batchId);
    if (payload.matchedDevices.length === 0 && payload.unmatchedItems.length === 0) {
      setError('No devices could be derived from the file.');
      return;
    }

    setMatchSummary(payload.summary);
    onCsvImportComplete(payload);
  };

  const handleFileSelect = (file: File) => {
    setError(null);
    setMatchSummary(null);
    const pool = mergeBuiltInAndCustomDevices();
    const batchId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    const fileExtension = file.name.split('.').pop()?.toLowerCase();

    if (fileExtension !== 'csv' && fileExtension !== 'txt') {
      setError('Please upload a CSV file (.csv or .txt)');
      return;
    }

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      complete: (results) => {
        try {
          const fields = results.meta.fields?.filter(Boolean) ?? [];
          const rows = (results.data as Record<string, unknown>[]).filter(
            (r) => r && typeof r === 'object',
          );

          if (fields.length > 0 && rows.length > 0) {
            const raw = extractCandidatesFromObjectRows(rows, fields);
            emitImport(raw, pool, batchId);
          } else {
            parseAsMatrix(file, pool, batchId);
          }
        } catch (err) {
          setError(`Error processing file: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      },
      error: () => {
        parseAsMatrix(file, pool, batchId);
      },
    });
  };

  const parseAsMatrix = (file: File, pool: ReturnType<typeof mergeBuiltInAndCustomDevices>, batchId: string) => {
    Papa.parse(file, {
      header: false,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const matrix = (results.data as unknown[][]).filter((row) => Array.isArray(row));
          const raw = extractCandidatesFromMatrix(matrix);
          emitImport(raw, pool, batchId);
        } catch (err) {
          setError(`Error processing file: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      },
      error: (err) => {
        setError(`Failed to parse file: ${err.message}`);
      },
    });
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  return (
    <div className={`space-y-4 ${cable ? 'font-cable-ui' : ''}`}>
      {emptyRackExportConfirmOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="empty-rack-export-title"
        >
          <div className="max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 id="empty-rack-export-title" className="text-lg font-bold text-gray-900">
              No parts on rack
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              There are no devices placed on the rack to export. Would you still like to continue? You will get a CSV
              with headers only.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEmptyRackExportConfirmOpen(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                No
              </button>
              <button
                type="button"
                onClick={() => {
                  setEmptyRackExportConfirmOpen(false);
                  runRackExportDownload();
                }}
                className="rounded-lg bg-[#003366] px-4 py-2 text-sm font-medium text-white hover:bg-[#004080]"
              >
                Yes, continue
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
          isDragging
            ? cable
              ? 'border-[#CC0000] bg-red-50/50'
              : 'border-blue-500 bg-blue-50'
            : cable
              ? 'border-slate-300 bg-slate-50/80 hover:border-[#003366]/45'
              : 'border-gray-300 bg-gray-50 hover:border-gray-400'
        }`}
      >
        <input ref={fileInputRef} type="file" accept=".csv,.txt" onChange={handleFileInput} className="hidden" />

        <div className={`flex flex-col items-center ${cable ? 'gap-5' : 'gap-4'}`}>
          {!cable && (
            <div className="rounded-full bg-white p-4 shadow-sm">
              <FileSpreadsheet className="size-12 text-blue-600" />
            </div>
          )}

          {cable ? (
            <>
              <FileSpreadsheet className="size-11 text-[#003366]" aria-hidden />
              <div className="text-center">
                <h3 className="font-cable-display text-2xl font-bold tracking-tight text-[#003366] sm:text-3xl">
                  Import Parts List
                </h3>
                <p className="font-cable-display mt-2 text-sm font-semibold uppercase tracking-[0.15em] text-slate-600">
                  Supported format: .csv
                </p>
              </div>
            </>
          ) : (
            <div>
              <h3 className="mb-1 font-semibold text-gray-900">Import rack parts list</h3>
              <p className="text-sm text-gray-600">
                All text cells are scanned. Matched names join the rack; others open a review panel.
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={`flex items-center gap-2 rounded-lg bg-[#003366] px-6 py-2 text-white transition-colors hover:bg-[#004080] ${
              cable ? 'font-cable-display text-sm font-bold uppercase tracking-[0.12em]' : 'font-medium'
            }`}
          >
            <Upload className="size-5" />
            Choose file
          </button>
        </div>
      </div>

      {pendingUnmatchedCount > 0 && onReopenCsvReview && (
        <button
          type="button"
          onClick={onReopenCsvReview}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-950 hover:bg-amber-100"
        >
          <ListChecks className="size-4" />
          Review {pendingUnmatchedCount} CSV name{pendingUnmatchedCount !== 1 ? 's' : ''} not in database
        </button>
      )}

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-red-600" />
          <div className="flex-1">
            <div className="mb-1 font-medium text-red-900">Import error</div>
            <div className="text-sm text-red-700">{error}</div>
          </div>
        </div>
      )}

      {matchSummary && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900">
          <div className="flex items-center gap-2 font-semibold text-green-950">
            <Link2 className="size-4 shrink-0" />
            Import summary
          </div>
          <p className="mt-2 text-green-800">
            Every non-empty text cell was considered. Purely numeric cells are skipped. Matches use the built-in + Fox
            catalog.
          </p>
          <ul className="mt-2 list-inside list-disc space-y-0.5 text-green-800">
            <li>
              {matchSummary.exact} exact name match{matchSummary.exact !== 1 ? 'es' : ''} (added to rack)
            </li>
            <li>
              {matchSummary.fuzzy} close (fuzzy) match{matchSummary.fuzzy !== 1 ? 'es' : ''} (added to rack)
            </li>
            <li>
              {matchSummary.unmatched} not in database — queued for review (not added to rack until you choose)
            </li>
          </ul>
          {matchSummary.unmatchedNames.length > 0 && matchSummary.unmatchedNames.length <= 8 && (
            <p className="mt-2 text-xs text-green-700">Pending review: {matchSummary.unmatchedNames.join(', ')}</p>
          )}
        </div>
      )}

      <div
        className={
          cable
            ? 'overflow-hidden rounded-lg border-2 border-slate-300 bg-white shadow-[0_4px_20px_-6px_rgba(0,51,102,0.2)]'
            : 'rounded-lg border border-blue-200 bg-blue-50 p-4'
        }
      >
        {cable ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 bg-gradient-to-r from-[#003366] via-[#004080] to-[#003366] px-4 py-3 text-white">
              <span className="font-cable-display text-sm font-bold uppercase tracking-[0.22em]">CSV format</span>
              <span className="font-cable-display rounded border border-white/35 bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white/95">
                File spec
              </span>
            </div>
            <div className="divide-y divide-slate-200 bg-white">
              <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:gap-5 sm:py-3">
                <div className="shrink-0 sm:w-36 sm:pt-0.5">
                  <span className="font-cable-display inline-block rounded border-2 border-[#CC0000] bg-red-50 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#CC0000]">
                    Required
                  </span>
                </div>
                <p className="font-cable-ui text-sm leading-relaxed text-slate-700">
                  <span className="font-semibold text-[#003366]">Device name</span> — be as specific as you can
                  (manufacturer, model, and series). More specific names match the catalog more reliably.
                </p>
              </div>
              <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:gap-5 sm:py-3">
                <div className="shrink-0 sm:w-36 sm:pt-0.5">
                  <span className="font-cable-display inline-block rounded border-2 border-[#003366] bg-slate-50 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#003366]">
                    Encouraged
                  </span>
                </div>
                <p className="font-cable-ui text-sm leading-relaxed text-slate-700">
                  <span className="font-semibold text-[#003366]">Device manufacturer + model</span> — you can use
                  columns <code className="rounded bg-white/80 px-1 text-slate-900">manufacturer</code> and{' '}
                  <code className="rounded bg-white/80 px-1 text-slate-900">model</code> (or{' '}
                  <code className="rounded bg-white/80 px-1 text-slate-900">modelNumber</code>) per row; they are
                  combined for matching. Also encouraged:{' '}
                  <span className="font-semibold text-[#003366]">rack units (U)</span>.
                </p>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="mb-2 text-sm font-semibold text-blue-900">CSV format</div>
            <div className="space-y-1 text-xs text-blue-800">
              <div>
                <strong>Full sheet:</strong> Every text cell in every column and row is scanned (duplicates merged).
                Numbers-only cells are ignored.
              </div>
              <div>
                <strong>With headers:</strong> Use <code className="rounded bg-white px-1">name</code>,{' '}
                <code className="rounded bg-white px-1">category</code>,{' '}
                <code className="rounded bg-white px-1">heightInches</code> or{' '}
                <code className="rounded bg-white px-1">heightU</code> on the row that contains each name.
              </div>
            </div>
          </>
        )}
      </div>

      {showCsvDownload && (
        <>
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="flex items-center gap-2 rounded-lg bg-[#003366] px-6 py-2 font-medium text-white transition-colors hover:bg-[#004080]"
          >
            <Download className="size-5" />
            {rackExportContext ? 'Download rack export (CSV)' : 'Download template'}
          </button>
          {rackExportContext && !cable && (
            <p className="text-xs text-gray-600">
              Exports every part currently on the rack and how each is connected (other device and port path). Use when
              the rack is empty to get headers only — you will be asked to confirm.
            </p>
          )}
          {rackExportContext && cable && (
            <p className="text-xs text-slate-600">
              Download includes parts on the rack and connection paths. Empty rack → headers only (confirm when
              prompted).
            </p>
          )}
        </>
      )}
    </div>
  );
}
