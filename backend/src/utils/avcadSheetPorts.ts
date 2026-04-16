/**
 * Parse Fox AVCAD "Ins" / "Outs" cells like:
 *   VideoA:4_BNC(12G-SDI), LAN:4_RJ45
 *   VideoD:1_HDMI 2.0
 *   1x Thunderbolt In
 * Signal prefix (VideoA, LAN, …) is kept in the port label together with purpose text.
 */

export type ParsedCatalogPort = {
  type: string;
  direction: 'input' | 'output' | 'both';
  label?: string;
  count?: number;
};

/** Split on commas not inside parentheses. */
export function splitTopLevelCommas(s: string): string[] {
  const t = s.trim();
  if (!t) return [];
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (let i = 0; i < t.length; i++) {
    const ch = t[i]!;
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      const p = cur.trim();
      if (p) out.push(p);
      cur = '';
      continue;
    }
    cur += ch;
  }
  const last = cur.trim();
  if (last) out.push(last);
  return out;
}

function purposeToDirection(
  purpose: string | undefined,
  column: 'in' | 'out',
): 'input' | 'output' | 'both' {
  const p = (purpose ?? '').toLowerCase();
  if (/\bi\/o\b|bidirectional|both|in\/out/i.test(purpose ?? '')) return 'both';
  if (/\bin\b/.test(p) && /\bout\b/.test(p)) return 'both';
  if (/\bout\b|output|rec(ording)?\b/i.test(purpose ?? '')) return 'output';
  if (/\bin\b|input|mic\b|capture\b/i.test(purpose ?? '')) return 'input';
  return column === 'in' ? 'input' : 'output';
}

/** Map raw connector token (after count_) to Rack+ / cable UI connector string. */
export function mapConnectorToken(raw: string): string {
  const t = raw.trim().replace(/\s+/g, ' ');
  const u = t.toUpperCase();
  if (!t) return 'TS';
  if (u.includes('THUNDERBOLT')) return 'Thunderbolt';
  if (u.includes('USB-C') || u === 'USB C') return 'USB-C';
  if (u.includes('USB') || u.includes('TBU')) return 'USB-A';
  if (u.includes('RJ45') || u === 'LAN' || u.includes('ETHERNET')) return 'Ethernet';
  if (u.includes('HDMI')) return 'HDMI';
  if (u.includes('DISPLAYPORT') || u === 'DP') return 'DisplayPort';
  if (u.includes('DVI')) return 'DVI';
  if (u.includes('VGA')) return 'VGA';
  // Rack+ cables/adapters use SDI for BNC coax digital video (see equipment.ts).
  if (u.includes('BNC') || u === 'SDI' || u.includes('12G') || u.includes('3G')) return 'SDI';
  if (u.includes('XLR') || u.includes('AES') || u.includes('MADI')) return 'XLR';
  if (u.includes('RCA')) return 'RCA';
  if (u.includes('TRS') || u.includes('1/4')) return '1/4 TRS';
  if (u.includes('3.5MM') || u.includes('MINI JACK')) return '3.5mm';
  if (u.includes('LC') || u.includes('SC') || u.includes('ST') || u.includes('CWDM') || u.includes('FIBRE') || u.includes('FIBER')) return 'TS';
  if (u.includes('DANTE')) return 'Ethernet';
  if (u.includes('TALKBACK')) return 'XLR';
  if (u.includes('MINI DISPLAY')) return 'Mini DisplayPort';
  return 'TS';
}

function buildLabel(signal: string | undefined, connectorRaw: string, purpose: string | undefined): string {
  const parts = [signal, connectorRaw.trim(), purpose?.trim()].filter(Boolean);
  return parts.join(' · ').replace(/\s+/g, ' ').trim() || connectorRaw.trim();
}

/**
 * Parse one comma-separated chunk from an Ins or Outs cell.
 * @param column which column this chunk came from (default direction hint).
 */
export function parsePortChunk(chunk: string, column: 'in' | 'out'): ParsedCatalogPort[] {
  const s = chunk.trim();
  if (!s || /^none$/i.test(s) || /^n\/a$/i.test(s)) return [];

  if (/^modular$/i.test(s)) {
    return [{ type: 'TS', direction: purposeToDirection(undefined, column), label: 'Modular', count: 1 }];
  }

  const thunder = s.match(/^(\d+)\s*x\s*(.+)$/i);
  if (thunder) {
    const count = Math.max(1, parseInt(thunder[1]!, 10) || 1);
    const rest = thunder[2]!.trim();
    const dir = /\bin\b/i.test(rest) ? 'input' : /\bout\b/i.test(rest) ? 'output' : purposeToDirection(rest, column);
    const type = mapConnectorToken(rest);
    return [{ type, direction: dir, label: rest, count }];
  }

  const slots = s.match(/^(\d+)\s*x\s*slots?$/i);
  if (slots) {
    const n = Math.max(1, parseInt(slots[1]!, 10) || 1);
    return [{ type: 'TS', direction: 'both', label: s, count: n }];
  }

  // Optional Signal: then Count_Connector with optional (purpose)
  const m = s.match(/^([\w]+):\s*(.+)$/);
  let signal: string | undefined;
  let body: string;
  if (m) {
    signal = m[1]!;
    body = m[2]!.trim();
  } else {
    body = s;
  }

  const paren = body.match(/^(\d+)\s*[_x]\s*(.+?)\s*(?:\(([^)]*)\))?\s*$/i);
  if (paren) {
    const count = Math.max(1, parseInt(paren[1]!, 10) || 1);
    const connectorAndPurpose = paren[2]!.trim();
    const purpose = paren[3]?.trim();
    const direction = purposeToDirection(purpose, column);
    const connectorRaw = connectorAndPurpose.replace(/\s+/g, ' ').trim();
    const type = mapConnectorToken(connectorRaw.split(/\s+/)[0] ?? connectorRaw);
    const label = buildLabel(signal, connectorAndPurpose, purpose);
    return [{ type, direction, label, count }];
  }

  // Fallback: store as generic with full text
  return [{ type: 'TS', direction: purposeToDirection(undefined, column), label: buildLabel(signal, body, undefined), count: 1 }];
}

export function parseInsOutsCells(insCell: string, outsCell: string): ParsedCatalogPort[] {
  const out: ParsedCatalogPort[] = [];
  for (const c of splitTopLevelCommas(insCell)) {
    out.push(...parsePortChunk(c, 'in'));
  }
  for (const c of splitTopLevelCommas(outsCell)) {
    out.push(...parsePortChunk(c, 'out'));
  }
  return out;
}
