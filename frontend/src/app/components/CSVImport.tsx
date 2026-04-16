import { useRef, useState } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, Download, Link2, ListChecks } from 'lucide-react';
import Papa from 'papaparse';
import {
  buildDeviceExactLookup,
  mergeBuiltInAndCustomDevices,
  resolveCsvImportRowToCatalogDevice,
  resolveImportCategory,
  tryResolveUnmatchedToCatalogDevice,
} from '../utils/deviceCatalogSearch';
import { prefetchServerCatalogDevices } from '../utils/serverCatalogCache';
import { getDeviceCategoryNames, prefetchDeviceCategories } from '../utils/deviceCategoryCache';
import {
  CsvCellCandidate,
  dedupeCandidates,
  extractCandidatesFromMatrix,
  extractCandidatesFromObjectRows,
} from '../utils/csvGridExtract';
import { extractCandidatesFromXmlFile } from '../utils/xmlPartsImport';
import type { RackConnection, RackDevice } from '../types/rack';
import type { CsvUnmatchedQueueItem } from './CsvUnmatchedReviewModal';

/** Passed from the rack planner for optional CSV export features; reserved for future use. */
export type CsvRackExportContext = {
  placedDevices: RackDevice[];
  connections: RackConnection[];
};

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
  /** Set for header-based CSV: Papa data rows (non-empty objects). */
  sheetDataRows?: number;
  /** Device labels extracted before merging duplicate names in the file. */
  candidatesBeforeDedupe?: number;
  /** After merging rows that share the same device label. */
  candidatesAfterDedupe?: number;
};

interface CSVImportProps {
  onCsvImportComplete: (payload: CsvImportCompletePayload) => void;
  pendingUnmatchedCount?: number;
  onReopenCsvReview?: () => void;
  rackExportContext?: CsvRackExportContext;
  uiVariant?: 'default' | 'cable';
  /** When false, hides the template download block (e.g. initial “build a new rack” screen). */
  showCsvDownload?: boolean;
  /** Dark rack workspace panels vs light standalone import. */
  surface?: 'light' | 'dark';
  /** Appended to the dashed drop zone (e.g. min-h + flex) so it matches a paired panel on the build rack screen. */
  dashedPanelExtraClass?: string;
}

function partitionCandidates(
  candidates: CsvCellCandidate[],
  pool: ReturnType<typeof mergeBuiltInAndCustomDevices>,
  batchId: string,
  dbCategoryNames: string[],
): { matchedDevices: RackDevice[]; unmatchedItems: CsvUnmatchedQueueItem[]; summary: ImportMatchSummary } {
  const exactLookup = buildDeviceExactLookup(pool);
  const matchedMap = new Map<string, RackDevice>();
  const unmatchedList: CsvUnmatchedQueueItem[] = [];
  const unmatchedSeen = new Set<string>();
  let exact = 0;
  let fuzzy = 0;
  let mIdx = 0;
  let uIdx = 0;

  for (const c of candidates) {
    const resolved = resolveCsvImportRowToCatalogDevice(c, pool, exactLookup);
    if (resolved) {
      const key = c.text.trim().toLowerCase();
      const existing = matchedMap.get(key);
      const mfr = (c.manufacturer ?? resolved.device.manufacturer ?? '').trim();
      const mdl = (c.model ?? resolved.device.model ?? '').trim();
      if (!existing) {
        matchedMap.set(key, {
          id: `imported-${batchId}-m-${mIdx++}`,
          name: c.text,
          manufacturer: mfr,
          model: mdl,
          category: resolveImportCategory(c.category, dbCategoryNames),
          heightInU: Math.max(1, c.heightInU),
          physicalHeightInches: c.physicalHeightInches > 0 ? c.physicalHeightInches : undefined,
          deviceWidthInches: c.deviceWidthInches,
          deviceDepthInches: c.deviceDepthInches,
          sheetPower: c.sheetPower.trim() || undefined,
          ports: resolved.device.ports.length > 0 ? [...resolved.device.ports] : [],
        });
        if (resolved.match === 'exact') exact += 1;
        else fuzzy += 1;
      } else {
        existing.heightInU = Math.max(existing.heightInU, c.heightInU);
        if (c.physicalHeightInches > 0) {
          existing.physicalHeightInches = Math.max(
            existing.physicalHeightInches ?? 0,
            c.physicalHeightInches,
          );
        }
        existing.deviceWidthInches = Math.max(existing.deviceWidthInches ?? 0, c.deviceWidthInches);
        existing.deviceDepthInches = Math.max(existing.deviceDepthInches ?? 0, c.deviceDepthInches);
        if (c.sheetPower.trim()) {
          existing.sheetPower = [existing.sheetPower, c.sheetPower].filter(Boolean).join(' · ') || undefined;
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
          category: resolveImportCategory(c.category, dbCategoryNames),
          physicalHeightInches: c.physicalHeightInches > 0 ? c.physicalHeightInches : undefined,
          manufacturer: c.manufacturer?.trim() || undefined,
          model: c.model?.trim() || undefined,
          deviceWidthInches: c.deviceWidthInches,
          deviceDepthInches: c.deviceDepthInches,
          sheetPower: c.sheetPower.trim() || undefined,
          sheetHadHeightColumn: c.sheetHadHeightColumn,
          sheetHadDepthColumn: c.sheetHadDepthColumn,
          sheetHadWidthColumn: c.sheetHadWidthColumn,
        });
      }
    }
  }

  // Second pass: Fox AVCAD rows that missed first match (BOM headers, server-catalog-only keys, label quirks).
  const finalUnmatched: CsvUnmatchedQueueItem[] = [];
  for (const u of unmatchedList) {
    const second = tryResolveUnmatchedToCatalogDevice(u, pool);
    if (second) {
      const key = u.name.trim().toLowerCase();
      const existing = matchedMap.get(key);
      const mfr = (u.manufacturer ?? second.device.manufacturer ?? '').trim();
      const mdl = (u.model ?? second.device.model ?? '').trim();
      if (!existing) {
        matchedMap.set(key, {
          id: `imported-${batchId}-m-${mIdx++}`,
          name: u.name,
          manufacturer: mfr,
          model: mdl,
          category: resolveImportCategory(u.category, dbCategoryNames),
          heightInU: Math.max(1, u.heightInU),
          physicalHeightInches: u.physicalHeightInches && u.physicalHeightInches > 0 ? u.physicalHeightInches : undefined,
          deviceWidthInches: u.deviceWidthInches,
          deviceDepthInches: u.deviceDepthInches,
          sheetPower: u.sheetPower?.trim() || undefined,
          ports: second.device.ports.length > 0 ? [...second.device.ports] : [],
        });
        if (second.match === 'exact') exact += 1;
        else fuzzy += 1;
      } else {
        existing.heightInU = Math.max(existing.heightInU, u.heightInU);
        if (u.physicalHeightInches && u.physicalHeightInches > 0) {
          existing.physicalHeightInches = Math.max(
            existing.physicalHeightInches ?? 0,
            u.physicalHeightInches,
          );
        }
        existing.deviceWidthInches = Math.max(
          existing.deviceWidthInches ?? 0,
          u.deviceWidthInches ?? 0,
        );
        existing.deviceDepthInches = Math.max(
          existing.deviceDepthInches ?? 0,
          u.deviceDepthInches ?? 0,
        );
        if (u.sheetPower?.trim()) {
          existing.sheetPower = [existing.sheetPower, u.sheetPower].filter(Boolean).join(' · ') || undefined;
        }
      }
    } else {
      finalUnmatched.push(u);
    }
  }

  return {
    matchedDevices: [...matchedMap.values()],
    unmatchedItems: finalUnmatched,
    summary: {
      exact,
      fuzzy,
      unmatched: finalUnmatched.length,
      unmatchedNames: finalUnmatched.map((u) => u.name),
    },
  };
}

export function CSVImport({
  onCsvImportComplete,
  pendingUnmatchedCount = 0,
  onReopenCsvReview,
  showCsvDownload = true,
  surface = 'light',
  dashedPanelExtraClass = '',
}: CSVImportProps) {
  const dim = surface === 'dark';
  const pairedLanding = dashedPanelExtraClass.trim().length > 0;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [matchSummary, setMatchSummary] = useState<ImportMatchSummary | null>(null);


  /* placeholder CSV, change to parse through images */ 
  
  const handleDownloadTemplate = () => {
    const template = `name,category,heightInches
Sony FX6,Camera,7.5
MacBook Pro (M3),Laptop,1.75
Focusrite Scarlett 2i2,Audio,1.75
Dell UltraSharp U2720Q,Monitor,14.5
Unlisted part number XYZ,Interface,2`;

    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'rack_parts_template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const emitImport = (
    candidates: CsvCellCandidate[],
    pool: ReturnType<typeof mergeBuiltInAndCustomDevices>,
    batchId: string,
    dbCategoryNames: string[],
    sheetDataRowCount?: number,
  ) => {
    const candidatesBeforeDedupe = candidates.length;
    const deduped = dedupeCandidates(candidates);
    if (deduped.length === 0) {
      setError('No text values found in the sheet (all cells empty or numeric-only).');
      return;
    }

    const payload = partitionCandidates(deduped, pool, batchId, dbCategoryNames);
    if (sheetDataRowCount != null) {
      payload.summary = {
        ...payload.summary,
        sheetDataRows: sheetDataRowCount,
        candidatesBeforeDedupe,
        candidatesAfterDedupe: deduped.length,
      };
    }
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
    const batchId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    const fileExtension = file.name.split('.').pop()?.toLowerCase();

    const runWithPool = async (
      fn: (pool: ReturnType<typeof mergeBuiltInAndCustomDevices>, dbCats: string[]) => void,
    ) => {
      try {
        await Promise.all([prefetchServerCatalogDevices(), prefetchDeviceCategories()]);
      } catch {
        /* offline: still import with built-in + cached catalog if any */
      }
      fn(mergeBuiltInAndCustomDevices(), getDeviceCategoryNames());
    };

    if (fileExtension === 'xml') {
      void runWithPool((pool, dbCats) => {
        void extractCandidatesFromXmlFile(file)
          .then((raw) => emitImport(raw, pool, batchId, dbCats))
          .catch((err) => {
            setError(err instanceof Error ? err.message : 'Failed to read XML file.');
          });
      });
      return;
    }

    if (fileExtension !== 'csv' && fileExtension !== 'txt') {
      setError('Please upload a CSV (.csv, .txt) or parts XML (.xml) file.');
      return;
    }

    void runWithPool((pool, dbCats) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      worker: false,
      transformHeader: (header) => header.replace(/^\uFEFF/, '').trim(),
      complete: (results) => {
        try {
          const fields = (results.meta.fields?.filter(Boolean) ?? []).map((f) =>
            String(f).replace(/^\uFEFF/, '').trim(),
          );
          const rows = (results.data as Record<string, unknown>[]).filter(
            (r) => r && typeof r === 'object',
          );

          if (fields.length > 0 && rows.length > 0) {
            const raw = extractCandidatesFromObjectRows(rows, fields, pool);
            emitImport(raw, pool, batchId, dbCats, rows.length);
          } else {
            parseAsMatrix(file, pool, batchId, dbCats);
          }
        } catch (err) {
          setError(`Error processing file: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      },
      error: () => {
        parseAsMatrix(file, pool, batchId, dbCats);
      },
    });
    });
  };

  const parseAsMatrix = (
    file: File,
    pool: ReturnType<typeof mergeBuiltInAndCustomDevices>,
    batchId: string,
    dbCats: string[],
  ) => {
    Papa.parse(file, {
      header: false,
      skipEmptyLines: true,
      worker: false,
      complete: (results) => {
        try {
          const matrix = (results.data as unknown[][]).filter((row) => Array.isArray(row));
          const raw = extractCandidatesFromMatrix(matrix);
          emitImport(raw, pool, batchId, dbCats);
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
    <div className={pairedLanding ? 'flex min-h-0 min-w-0 flex-1 flex-col gap-4' : 'space-y-4'}>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors ${dashedPanelExtraClass} ${
          isDragging
            ? dim
              ? 'border-sky-500 bg-sky-950/40'
              : 'border-blue-500 bg-blue-50'
            : dim
              ? 'border-slate-600 bg-slate-800/60 hover:border-slate-500'
              : 'border-gray-300 bg-gray-50 hover:border-gray-400'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.txt,.xml,text/csv,application/xml,text/xml"
          onChange={handleFileInput}
          className="hidden"
        />

        <div className="flex flex-col items-center gap-4">
          <div className={`rounded-full p-4 shadow-sm ${dim ? 'bg-slate-700/80' : 'bg-white'}`}>
            <FileSpreadsheet className={`size-12 ${dim ? 'text-sky-400' : 'text-blue-600'}`} />
          </div>

          <div>
            <h3
              className={`mb-1 font-semibold ${dim ? 'font-cable-ui text-slate-100' : 'text-gray-900'}`}
            >
              Import rack parts list
            </h3>
            <p className={`text-sm ${dim ? 'font-cable-ui text-slate-400' : 'text-gray-600'}`}>
              Upload CSV/TXT (sheet cells) or XML (tables, or tags like part/item/device). Matched names join the rack;
              others open a review panel.
            </p>
          </div>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 rounded-lg bg-[#003366] px-6 py-2 font-medium text-white transition-colors hover:bg-blue-700"
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
          className={`flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium ${
            dim
              ? 'border-amber-700/60 bg-amber-950/40 text-amber-100 hover:bg-amber-950/60'
              : 'border-amber-300 bg-amber-50 text-amber-950 hover:bg-amber-100'
          }`}
        >
          <ListChecks className="size-4" />
          Review {pendingUnmatchedCount} CSV name{pendingUnmatchedCount !== 1 ? 's' : ''} not in database
        </button>
      )}

      {error && (
        <div
          className={`flex items-start gap-3 rounded-lg border p-4 ${
            dim ? 'border-red-800/60 bg-red-950/40' : 'border-red-200 bg-red-50'
          }`}
        >
          <AlertCircle className={`mt-0.5 size-5 shrink-0 ${dim ? 'text-red-400' : 'text-red-600'}`} />
          <div className="flex-1">
            <div className={`mb-1 font-medium ${dim ? 'text-red-200' : 'text-red-900'}`}>Import error</div>
            <div className={`text-sm ${dim ? 'text-red-300/90' : 'text-red-700'}`}>{error}</div>
          </div>
        </div>
      )}

      {matchSummary && (
        <div
          className={`rounded-lg border p-4 text-sm ${
            dim ? 'border-emerald-800/50 bg-emerald-950/35 text-emerald-100' : 'border-green-200 bg-green-50 text-green-900'
          }`}
        >
          <div className={`flex items-center gap-2 font-semibold ${dim ? 'text-emerald-100' : 'text-green-950'}`}>
            <Link2 className="size-4 shrink-0" />
            Import summary
          </div>
          <p className={`mt-2 ${dim ? 'text-emerald-200/90' : 'text-green-800'}`}>
            Every non-empty text cell was considered. Purely numeric cells are skipped. Matches use the built-in + Fox
            catalog.
          </p>
          {matchSummary.sheetDataRows != null && (
            <p className={`mt-2 text-xs ${dim ? 'text-emerald-200/85' : 'text-green-800'}`}>
              Sheet: {matchSummary.sheetDataRows} data row{matchSummary.sheetDataRows !== 1 ? 's' : ''} →{' '}
              {matchSummary.candidatesBeforeDedupe ?? '—'} device label
              {(matchSummary.candidatesBeforeDedupe ?? 0) !== 1 ? 's' : ''} extracted
              {matchSummary.candidatesAfterDedupe != null &&
              matchSummary.candidatesBeforeDedupe != null &&
              matchSummary.candidatesAfterDedupe < matchSummary.candidatesBeforeDedupe
                ? ` (${matchSummary.candidatesBeforeDedupe - matchSummary.candidatesAfterDedupe} merged as duplicate names in the file)`
                : ''}
              {matchSummary.candidatesAfterDedupe != null ? ` → ${matchSummary.candidatesAfterDedupe} unique after merge` : ''}
              . Same label on multiple rows becomes one import line (dimensions merged).
            </p>
          )}
          <ul className={`mt-2 list-inside list-disc space-y-0.5 ${dim ? 'text-emerald-200/90' : 'text-green-800'}`}>
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
            <p className={`mt-2 text-xs ${dim ? 'text-emerald-300/90' : 'text-green-700'}`}>
              Pending review: {matchSummary.unmatchedNames.join(', ')}
            </p>
          )}
        </div>
      )}

      <div
        className={`rounded-lg border p-4 ${
          dim ? 'border-sky-800/50 bg-sky-950/35' : 'border-blue-200 bg-blue-50'
        }`}
      >
        <div className={`mb-2 text-sm font-medium ${dim ? 'text-sky-100' : 'text-blue-900'}`}>CSV and XML</div>
        <div className={`space-y-1 text-xs ${dim ? 'text-sky-200/90' : 'text-blue-800'}`}>
          <div>
            <strong>CSV full sheet:</strong> Header rows: one device per data row; duplicate <em>names</em> in the file
            merge into one line. Numbers-only cells are ignored. There is no fixed row cap — the full file is parsed.
          </div>
          <div>
            <strong>Server catalog (Google Sheet / CSV → Postgres):</strong> Set backend env (see admin page): optional{' '}
            <code className={`rounded px-1 ${dim ? 'bg-slate-800 text-slate-200' : 'bg-white'}`}>FOX_CATALOG_CSV_FETCH_AUTHORIZATION</code> /{' '}
            <code className={`rounded px-1 ${dim ? 'bg-slate-800 text-slate-200' : 'bg-white'}`}>FOX_CATALOG_CSV_FETCH_HEADERS_JSON</code> for a private CSV URL;{' '}
            <code className={`rounded px-1 ${dim ? 'bg-slate-800 text-slate-200' : 'bg-white'}`}>CATALOG_WEBHOOK_SECRET</code> + POST{' '}
            <code className={`rounded px-1 ${dim ? 'bg-slate-800 text-slate-200' : 'bg-white'}`}>/api/catalog/sync-webhook</code> for a private sheet without a public link.{' '}
            <code className={`rounded px-1 ${dim ? 'bg-slate-800 text-slate-200' : 'bg-white'}`}>FOX_CATALOG_SYNC_INTERVAL_MS</code> (≥ 15s; use webhook for instant) upserts into{' '}
            <code className={`rounded px-1 ${dim ? 'bg-slate-800 text-slate-200' : 'bg-white'}`}>/api/catalog/devices</code>. Frontend reloads that
            list on load; optional <code className={`rounded px-1 ${dim ? 'bg-slate-800 text-slate-200' : 'bg-white'}`}>VITE_CATALOG_POLL_MS</code> in{' '}
            <code className={`rounded px-1 ${dim ? 'bg-slate-800 text-slate-200' : 'bg-white'}`}>.env.development</code> refreshes the catalog while the app stays open.
          </div>
          <div>
            <strong>CSV with headers:</strong> Use <code className={`rounded px-1 ${dim ? 'bg-slate-800 text-slate-200' : 'bg-white'}`}>name</code>,{' '}
            <code className={`rounded px-1 ${dim ? 'bg-slate-800 text-slate-200' : 'bg-white'}`}>category</code>,{' '}
            <code className={`rounded px-1 ${dim ? 'bg-slate-800 text-slate-200' : 'bg-white'}`}>heightInches</code> or{' '}
            <code className={`rounded px-1 ${dim ? 'bg-slate-800 text-slate-200' : 'bg-white'}`}>heightU</code> on the row that contains each name.
          </div>
          <div>
            <strong>XML:</strong> HTML-style tables (<code className={`rounded px-1 ${dim ? 'bg-slate-800 text-slate-200' : 'bg-white'}`}>&lt;tr&gt;&lt;td&gt;</code>
            ), row/cell grids, or elements named part, item, device, etc. Export from tools like AvCAD works when the
            file is well-formed XML with readable part names.
          </div>
        </div>
      </div>

      {showCsvDownload && (
        <button
          type="button"
          onClick={handleDownloadTemplate}
          className="flex items-center gap-2 rounded-lg bg-[#003366] px-6 py-2 font-medium text-white transition-colors hover:bg-blue-700"
        >
          <Download className="size-5" />
          Download template
        </button>
      )}
    </div>
  );
}
