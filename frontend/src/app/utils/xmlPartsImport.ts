import { type CsvCellCandidate, extractCandidatesFromMatrix, shouldSkipCellValue } from './csvGridExtract';

function ln(el: Element): string {
  return el.localName.toLowerCase();
}

/** Collect `<tr>` / `<Row>` style grids into string rows. */
function buildMatrixFromTables(doc: Document): string[][] {
  const matrix: string[][] = [];
  const all = doc.getElementsByTagName('*');

  const trs: Element[] = [];
  for (let i = 0; i < all.length; i++) {
    const e = all[i]!;
    if (ln(e) === 'tr') trs.push(e);
  }
  for (const tr of trs) {
    const cells = [...tr.children].filter((c) => {
      const l = ln(c);
      return l === 'td' || l === 'th';
    });
    if (cells.length === 0) continue;
    matrix.push(cells.map((c) => (c.textContent ?? '').replace(/\s+/g, ' ').trim()));
  }
  if (matrix.length > 0) return matrix;

  // Generic <row><cell>… or <Row><Cell>…
  for (let i = 0; i < all.length; i++) {
    const e = all[i]!;
    if (ln(e) !== 'row') continue;
    const cells: string[] = [];
    for (const child of e.children) {
      const cl = ln(child);
      if (cl !== 'cell' && cl !== 'c' && cl !== 'td' && cl !== 'th') continue;
      let text = '';
      for (const sub of child.getElementsByTagName('*')) {
        const sl = ln(sub);
        if (sl === 'v' || sl === 'data' || sl === 't') {
          const t = (sub.textContent ?? '').replace(/\s+/g, ' ').trim();
          if (t) text = t;
        }
      }
      if (!text) text = (child.textContent ?? '').replace(/\s+/g, ' ').trim();
      cells.push(text);
    }
    if (cells.length > 0) matrix.push(cells);
  }

  return matrix;
}

const PART_LIKE = new Set(['part', 'item', 'device', 'equipment', 'component', 'line', 'product']);
const ATTR_KEYS = new Set(['name', 'partname', 'partnumber', 'description', 'model', 'title', 'sku']);

function collectFromPartLikeElements(doc: Document): CsvCellCandidate[] {
  const out: CsvCellCandidate[] = [];
  const seen = new Set<string>();
  const push = (s: string) => {
    const t = s.replace(/\s+/g, ' ').trim();
    if (shouldSkipCellValue(t)) return;
    const k = t.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    out.push({
      text: t,
      heightInU: 1,
      category: '',
      physicalHeightInches: 0,
      fromNameColumn: true,
      deviceWidthInches: 0,
      deviceDepthInches: 0,
      sheetPower: '',
      sheetHadHeightColumn: false,
      sheetHadDepthColumn: false,
      sheetHadWidthColumn: false,
    });
  };

  const all = doc.getElementsByTagName('*');
  for (let i = 0; i < all.length; i++) {
    const el = all[i]!;
    if (!PART_LIKE.has(ln(el))) continue;
    const txt = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (txt.length > 0 && txt.length < 800) push(txt);
    for (let a = 0; a < el.attributes.length; a++) {
      const attr = el.attributes[a]!;
      if (ATTR_KEYS.has(attr.name.toLowerCase()) && attr.value.trim()) {
        push(attr.value);
      }
    }
  }
  return out;
}

/** Last resort: leaf elements with substantive text (e.g. `<Name>…</Name>`). */
function collectLeafTextCandidates(doc: Document): CsvCellCandidate[] {
  const out: CsvCellCandidate[] = [];
  const seen = new Set<string>();
  const root = doc.documentElement;
  if (!root) return out;

  const walk = (el: Element) => {
    if (el.children.length > 0) {
      for (const c of el.children) walk(c);
      return;
    }
    const t = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (shouldSkipCellValue(t) || t.length > 500) return;
    const k = t.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    out.push({
      text: t,
      heightInU: 1,
      category: '',
      physicalHeightInches: 0,
      fromNameColumn: ln(el) === 'name',
      deviceWidthInches: 0,
      deviceDepthInches: 0,
      sheetPower: '',
      sheetHadHeightColumn: false,
      sheetHadDepthColumn: false,
      sheetHadWidthColumn: false,
    });
  };

  walk(root);
  return out;
}

/**
 * Parse a parts-oriented XML file into the same cell candidates used by CSV import.
 */
export async function extractCandidatesFromXmlFile(file: File): Promise<CsvCellCandidate[]> {
  const text = await file.text();
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  const pe = doc.querySelector('parsererror');
  if (pe && pe.textContent?.trim()) {
    throw new Error('Invalid or malformed XML (not well-formed or wrong encoding).');
  }

  const matrix = buildMatrixFromTables(doc);
  if (matrix.length > 0) {
    const fromMatrix = extractCandidatesFromMatrix(matrix);
    if (fromMatrix.length > 0) return fromMatrix;
  }

  const fromParts = collectFromPartLikeElements(doc);
  if (fromParts.length > 0) return fromParts;

  const fromLeaves = collectLeafTextCandidates(doc);
  if (fromLeaves.length > 0) return fromLeaves;

  throw new Error(
    'No table rows, part/item elements, or leaf text found. Use a grid (rows/cells) or tags like <part>, <item>, <device>.',
  );
}
