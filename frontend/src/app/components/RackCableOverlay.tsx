import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  findAllConnectableOutputToOutputPairs,
  findAllConnectablePairs,
  type ConnectablePair,
} from '../utils/cableFinder';
import {
  connectionFromManualPorts,
  connectionFromSuggestedPair,
  findFirstUnusedMatchingPortPair,
  hasDirectedPortConnection,
  type BuildManualConnectionVisualRoute,
} from '../utils/rackConnectionHelpers';
import {
  cableRunInchesOrthogonalAnchors,
  dragCableRunDisplayInches,
  formatCableLengthInches,
  roundCableLengthInches,
} from '../utils/rackCableMetrics';
import type { RackConnection, RackDevice } from '../types/rack';
import { deviceFaceHorizontalSpanPx, normalizeDeviceHorizontalFields } from '../utils/rackDevicePlacement';
import {
  getDeviceManufacturerSideLabel,
  shouldShowManufacturerOnDeviceSide,
} from '../utils/rackDeviceFaceLabels';
import { DEFAULT_RACK_WIDTH_INCHES } from '../utils/rackUnits';
import { getDeviceDisplayName } from '../utils/deviceDisplay';

type DeviceEdge = 'left' | 'right';

type DragState = {
  fromDeviceId: string;
  fromEdge: DeviceEdge;
  startX: number;
  startY: number;
  curX: number;
  curY: number;
};

function deviceCenterY(device: RackDevice, totalHeight: number, unitHeightPx: number): number {
  const top = (totalHeight - device.rackPosition! - device.heightInU) * unitHeightPx;
  return top + (device.heightInU * unitHeightPx) / 2;
}

function deviceRowBounds(device: RackDevice, totalHeight: number, unitHeightPx: number) {
  const top = (totalHeight - device.rackPosition! - device.heightInU) * unitHeightPx;
  const h = device.heightInU * unitHeightPx;
  return { top, height: h };
}

/**
 * Horizontal cable segment [xMin,xMax] at Y must not cross device front panels (name area),
 * so pick a Y near the desired level that lies outside every overlapping device row.
 */
function findSafeHorizontalCableY(
  desiredY: number,
  xMin: number,
  xMax: number,
  placedDevices: RackDevice[],
  totalHeight: number,
  unitHeightPx: number,
  rackWidthPx: number,
  rackWidthInches: number,
  rackHeightPx: number,
): number {
  const hitsFace = (y: number): boolean => {
    for (const d of placedDevices) {
      if (d.rackPosition === undefined) continue;
      const placed = normalizeDeviceHorizontalFields(d, rackWidthInches);
      const { leftPx, widthPx } = deviceFaceHorizontalSpanPx(placed, rackWidthPx, rackWidthInches);
      const faceL = leftPx;
      const faceR = leftPx + widthPx;
      if (xMax <= faceL || xMin >= faceR) continue;
      const { top, height } = deviceRowBounds(d, totalHeight, unitHeightPx);
      if (y >= top && y <= top + height) return true;
    }
    return false;
  };

  if (!hitsFace(desiredY)) return desiredY;

  const step = Math.max(2, unitHeightPx * 0.08);
  const maxSteps = Math.ceil(rackHeightPx / step) + 8;
  for (let i = 1; i <= maxSteps; i++) {
    const up = desiredY - i * step;
    if (up >= 0 && !hitsFace(up)) return up;
    const down = desiredY + i * step;
    if (down <= rackHeightPx && !hitsFace(down)) return down;
  }
  return desiredY;
}

/** Inset of cable anchor from rack left/right (matches SVG connection points). */
const DEVICE_EDGE_PAD_PX = 10;
/** Hit width along left/right of each device row (left strip sits in device pl-3 gutter). */
const EDGE_STRIP_PX = 22;
/** Extra vertical slack when mapping a drop Y to a device row (gaps between U lines, fuzzy release). */
function dropRowPadPx(unitHeightPx: number): number {
  return Math.max(28, unitHeightPx * 0.45);
}

/**
 * Vertical-first L: straight from (x1,y1) to the destination row (y2 + spreadY), then across to (x2,y2).
 * Stays in one column until the destination row — no long detour through mid-rack.
 */
function verticalFirstCablePath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  spreadY: number,
): string {
  const yH = y2 + spreadY;
  if (Math.abs(x1 - x2) < 0.5) {
    return `M ${x1} ${y1} L ${x1} ${y2}`;
  }
  if (Math.abs(spreadY) < 1e-6) {
    return `M ${x1} ${y1} L ${x1} ${y2} L ${x2} ${y2}`;
  }
  return `M ${x1} ${y1} L ${x1} ${yH} L ${x2} ${yH} L ${x2} ${y2}`;
}

function anchorXForDeviceEdge(
  device: RackDevice,
  edge: DeviceEdge,
  rackWidthPx: number,
  rackWidthInches: number,
): number {
  const { leftPx, widthPx } = deviceFaceHorizontalSpanPx(device, rackWidthPx, rackWidthInches);
  const w = Math.max(widthPx, DEVICE_EDGE_PAD_PX * 2 + 1);
  if (edge === 'right') return leftPx + w - DEVICE_EDGE_PAD_PX;
  return leftPx + DEVICE_EDGE_PAD_PX;
}

/** X center for vertical manufacturer text: in the rack margin beside the face (not on the device), like cable space. */
function manufacturerSideLabelCenterX(leftPx: number, widthPx: number, rackWidthPx: number): number {
  const faceR = leftPx + widthPx;
  const gap = 12;
  const minSideSpace = 26;
  if (leftPx >= minSideSpace) {
    return leftPx - gap;
  }
  if (faceR <= rackWidthPx - minSideSpace) {
    return faceR + gap;
  }
  return Math.max(10, Math.min(rackWidthPx - 10, leftPx + 14));
}

function connectionAnchorPoints(
  from: RackDevice,
  to: RackDevice,
  totalHeight: number,
  unitHeightPx: number,
  rackWidthPx: number,
  rackWidthInches: number,
  route?: {
    routeFromEdge?: 'left' | 'right';
    routeToEdge?: 'left' | 'right';
    routeFromYRatio?: number;
    routeToYRatio?: number;
  },
): { x1: number; y1: number; x2: number; y2: number } {
  const fromEdge = route?.routeFromEdge ?? 'right';
  const toEdge = route?.routeToEdge ?? 'left';
  const fr = route?.routeFromYRatio ?? 0.5;
  const tr = route?.routeToYRatio ?? 0.5;
  const x1 = anchorXForDeviceEdge(from, fromEdge, rackWidthPx, rackWidthInches);
  const x2 = anchorXForDeviceEdge(to, toEdge, rackWidthPx, rackWidthInches);
  const b1 = deviceRowBounds(from, totalHeight, unitHeightPx);
  const b2 = deviceRowBounds(to, totalHeight, unitHeightPx);
  const h1 = Math.max(b1.height, 1);
  const h2 = Math.max(b2.height, 1);
  const y1 = b1.top + Math.min(1, Math.max(0, fr)) * h1;
  const y2 = b2.top + Math.min(1, Math.max(0, tr)) * h2;
  return { x1, y1, x2, y2 };
}

function yRatioAlongDeviceRow(
  yRelRack: number,
  device: RackDevice,
  totalHeight: number,
  unitHeightPx: number,
): number {
  const { top, height } = deviceRowBounds(device, totalHeight, unitHeightPx);
  const h = Math.max(height, 1);
  return Math.min(1, Math.max(0, (yRelRack - top) / h));
}

/** Map drag geometry to the connection's `from` device (port direction may differ from drag order). */
function yRatioForConnectionDeviceEnd(
  endDeviceId: string,
  dragSourceId: string,
  dragTargetId: string,
  startYRel: number,
  curYRel: number,
  endDevice: RackDevice,
  totalHeight: number,
  unitHeightPx: number,
): number {
  if (endDeviceId === dragSourceId) return yRatioAlongDeviceRow(startYRel, endDevice, totalHeight, unitHeightPx);
  if (endDeviceId === dragTargetId) return yRatioAlongDeviceRow(curYRel, endDevice, totalHeight, unitHeightPx);
  return 0.5;
}

function edgeForConnectionDeviceEnd(
  endDeviceId: string,
  dragSourceId: string,
  dragTargetId: string,
  sourceEdge: DeviceEdge,
  targetEdge: DeviceEdge,
): DeviceEdge {
  if (endDeviceId === dragSourceId) return sourceEdge;
  if (endDeviceId === dragTargetId) return targetEdge;
  return 'right';
}

/** Target side follows where the cable tip sits: edge strips snap; middle uses nearest half. */
function inferToEdgeFromRackX(xRelRack: number, rackWidthPx: number): DeviceEdge {
  const x = Math.min(rackWidthPx, Math.max(0, xRelRack));
  const zone = EDGE_STRIP_PX + 14;
  if (x <= zone) return 'left';
  if (x >= rackWidthPx - zone) return 'right';
  return x < rackWidthPx * 0.5 ? 'left' : 'right';
}

/**
 * If the user drags mostly up/down while staying on the same side of the rack (left or right strip),
 * anchor the target on that same side so the cable stays straight (not forced across the rack).
 * Only when the tip clearly crosses to the other side (or drag is more horizontal) use X-based inference.
 */
function portDirectionLabel(p: { direction: string }): string {
  if (p.direction === 'output') return 'output';
  if (p.direction === 'input') return 'input';
  return 'I/O';
}

function formatSuggestionLabel(toDevice: RackDevice, pair: ConnectablePair): string {
  const dev = getDeviceDisplayName(toDevice);
  const fromD = portDirectionLabel(pair.fromPort);
  const toD = portDirectionLabel(pair.toPort);
  const cable = pair.solution.cable?.name ?? `${pair.fromPort.type} cable`;
  return `${dev}: ${pair.fromPort.type} (${fromD}) → ${pair.toPort.type} (${toD}) · ${cable}`;
}

function inferToEdgeFromDrag(d: DragState, rackWidthPx: number): DeviceEdge {
  const dx = Math.abs(d.curX - d.startX);
  const dy = Math.abs(d.curY - d.startY);
  const zone = EDGE_STRIP_PX + 24;
  const w = Math.max(1, rackWidthPx);
  const left = (x: number) => x <= zone;
  const right = (x: number) => x >= w - zone;

  const verticalish = dy >= dx * 0.7 && dy > 8;
  if (verticalish) {
    if (left(d.startX) && left(d.curX)) return 'left';
    if (right(d.startX) && right(d.curX)) return 'right';
  }

  return inferToEdgeFromRackX(d.curX, rackWidthPx);
}

function portSocketCircle(cx: number, cy: number, edge: DeviceEdge) {
  if (edge === 'left') {
    return (
      <circle
        cx={cx}
        cy={cy}
        r={4}
        fill="#0f172a"
        stroke="#94a3b8"
        strokeWidth={1.5}
        style={{ pointerEvents: 'none' }}
      />
    );
  }
  return (
    <circle
      cx={cx}
      cy={cy}
      r={4}
      fill="#0f172a"
      stroke="#38bdf8"
      strokeWidth={1.5}
      style={{ pointerEvents: 'none' }}
    />
  );
}

function verticalDistanceToRow(yRel: number, top: number, height: number, pad: number): number {
  const lo = top - pad;
  const hi = top + height + pad;
  if (yRel >= lo && yRel <= hi) return 0;
  return yRel < lo ? lo - yRel : yRel - hi;
}

/** Stable client position for drop: if pointerup lands outside the rack, use last drag point inside rack. */
function clientPointForCableDrop(
  e: MouseEvent | PointerEvent,
  rackRect: DOMRect,
  drag: DragState,
  rackWidthPx: number,
  rackHeightPx: number,
): { clientX: number; clientY: number } {
  let cx = e.clientX;
  let cy = e.clientY;
  const xRel = cx - rackRect.left;
  const yRel = cy - rackRect.top;
  const margin = 72;
  const outside =
    !Number.isFinite(cx) ||
    !Number.isFinite(cy) ||
    xRel < -margin ||
    xRel > rackWidthPx + margin ||
    yRel < -margin ||
    yRel > rackHeightPx + margin;
  if (outside) {
    cx = rackRect.left + Math.max(0, Math.min(rackWidthPx, drag.curX));
    cy = rackRect.top + Math.max(0, Math.min(rackHeightPx, drag.curY));
  }
  return { clientX: cx, clientY: cy };
}

/**
 * Always pick a placed device when possible: nearest row by Y (works in U gaps and empty rack space),
 * with preference for the element under the cursor when it matches a device row.
 */
function resolveDropTargetDevice(
  clientX: number,
  clientY: number,
  rackRect: DOMRect,
  rackWidthPx: number,
  placedDevices: RackDevice[],
  totalHeight: number,
  unitHeightPx: number,
  byId: Map<string, RackDevice>,
  /** Rack-relative Y of cable end (biases target when release snaps back onto the source strip). */
  trailYRel: number,
  fromDeviceId: string,
): RackDevice | undefined {
  const placed = placedDevices.filter((d) => d.rackPosition !== undefined);
  if (placed.length === 0) return undefined;

  const yRel = clientY - rackRect.top;
  const yPick = yRel * 0.35 + trailYRel * 0.65;
  const rowPad = dropRowPadPx(unitHeightPx);
  const hitSlop = Math.max(10, unitHeightPx * 0.12);

  const el = typeof document !== 'undefined' ? document.elementFromPoint(clientX, clientY) : null;
  const hitId = el?.closest('[data-rack-device-id]')?.getAttribute('data-rack-device-id');
  if (hitId) {
    const hitDev = byId.get(hitId);
    if (hitDev?.rackPosition !== undefined) {
      const { top, height } = deviceRowBounds(hitDev, totalHeight, unitHeightPx);
      const vDistRelease = verticalDistanceToRow(yRel, top, height, rowPad);
      const vDistTrail = verticalDistanceToRow(trailYRel, top, height, rowPad);
      const aligned = vDistRelease <= hitSlop || vDistTrail <= hitSlop;
      if (aligned) {
        if (hitDev.id !== fromDeviceId || vDistTrail <= hitSlop) {
          return hitDev;
        }
      }
    }
  }

  let best: RackDevice | undefined;
  let bestRowDist = Infinity;
  let bestMidDist = Infinity;
  for (const d of placed) {
    const { top, height } = deviceRowBounds(d, totalHeight, unitHeightPx);
    const rowDist = verticalDistanceToRow(yPick, top, height, rowPad);
    const midDist = Math.abs(yPick - (top + height / 2));
    if (
      rowDist < bestRowDist ||
      (rowDist === bestRowDist && midDist < bestMidDist)
    ) {
      best = d;
      bestRowDist = rowDist;
      bestMidDist = midDist;
    }
  }
  return best;
}

interface RackCableOverlayProps {
  totalHeight: number;
  placedDevices: RackDevice[];
  unitHeightPx: number;
  rackWidthPx: number;
  rackHeightPx: number;
  rackWidthInches?: number;
  connections: RackConnection[];
  inchesPerRU: number;
  slackAllowanceFeet: number;
  onAddConnection: (c: RackConnection) => void;
  onPortMismatch: (payload: {
    from: RackDevice;
    to: RackDevice;
    extraSlackInches: number;
    /** Captures drag geometry so the connection matches the user's cable path after port setup. */
    buildVisualRoute: BuildManualConnectionVisualRoute;
  }) => void;
  onRemoveConnection?: (connectionId: string) => void;
}

export function RackCableOverlay({
  totalHeight,
  placedDevices,
  unitHeightPx,
  rackWidthPx,
  rackHeightPx,
  rackWidthInches = DEFAULT_RACK_WIDTH_INCHES,
  connections,
  inchesPerRU,
  slackAllowanceFeet,
  onAddConnection,
  onPortMismatch,
  onRemoveConnection,
}: RackCableOverlayProps) {
  const rackAreaRef = useRef<HTMLDivElement>(null);
  const cableDragCaptureElRef = useRef<HTMLElement | null>(null);
  const hoverClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  dragRef.current = drag;
  const byId = useMemo(() => new Map(placedDevices.map((d) => [d.id, d])), [placedDevices]);

  /**
   * Fan out cables that share the same rounded anchor geometry (same visual route) so overlaps read as
   * separate connections — not only multiple links between one device pair.
   */
  const cableBundleSpreadY = useMemo(() => {
    const groups = new Map<string, RackConnection[]>();
    for (const conn of connections) {
      const a = byId.get(conn.fromDeviceId);
      const b = byId.get(conn.toDeviceId);
      if (!a || !b || a.rackPosition === undefined || b.rackPosition === undefined) continue;
      const { x1, y1, x2, y2 } = connectionAnchorPoints(
        a,
        b,
        totalHeight,
        unitHeightPx,
        rackWidthPx,
        rackWidthInches,
        conn,
      );
      const r = (v: number) => Math.round(v / 4) * 4;
      const k = `${r(x1)}|${r(y1)}|${r(x2)}|${r(y2)}`;
      const arr = groups.get(k);
      if (arr) arr.push(conn);
      else groups.set(k, [conn]);
    }
    const out = new Map<string, number>();
    const stepPx = 10;
    for (const arr of groups.values()) {
      if (arr.length <= 1) continue;
      const sorted = [...arr].sort((a, b) => a.id.localeCompare(b.id));
      sorted.forEach((conn, i) => {
        out.set(conn.id, (i - (sorted.length - 1) / 2) * stepPx);
      });
    }
    return out;
  }, [connections, byId, totalHeight, unitHeightPx, rackWidthPx, rackWidthInches]);

  const rackMetrics = useCallback(() => {
    const el = rackAreaRef.current;
    if (!el) return null;
    return el.getBoundingClientRect();
  }, []);

  const suggestions = useMemo(() => {
    if (!hoveredId) return [] as { to: RackDevice; pair: ConnectablePair; label: string }[];
    const from = byId.get(hoveredId);
    if (!from) return [];
    const out: { to: RackDevice; pair: ConnectablePair; label: string }[] = [];
    for (const to of placedDevices) {
      if (to.id === from.id) continue;
      const standardPairs = findAllConnectablePairs(from, to, 14);
      const outputPairs = findAllConnectableOutputToOutputPairs(from, to, 8);
      const pairs = [...standardPairs, ...outputPairs];
      for (const pair of pairs) {
        if (hasDirectedPortConnection(connections, from.id, to.id, pair.fromPort, pair.toPort)) continue;
        out.push({
          to,
          pair,
          label: formatSuggestionLabel(to, pair),
        });
      }
    }
    return out.slice(0, 14);
  }, [hoveredId, byId, placedDevices, connections]);

  const releaseCableDragCapture = useCallback((e: MouseEvent | PointerEvent | null) => {
    const el = cableDragCaptureElRef.current;
    cableDragCaptureElRef.current = null;
    if (el && e && 'pointerId' in e) {
      try {
        el.releasePointerCapture((e as PointerEvent).pointerId);
      } catch {
        /* not capturing or already released */
      }
    }
  }, []);

  const endDrag = useCallback(
    (e: MouseEvent | PointerEvent | null) => {
      releaseCableDragCapture(e);
      const d = dragRef.current;
      if (!d) return;
      const from = byId.get(d.fromDeviceId);
      const r = rackMetrics();
      if (!from || !e || !r) {
        setDrag(null);
        return;
      }
      const { clientX, clientY } = clientPointForCableDrop(e, r, d, rackWidthPx, rackHeightPx);
      const to = resolveDropTargetDevice(
        clientX,
        clientY,
        r,
        rackWidthPx,
        placedDevices,
        totalHeight,
        unitHeightPx,
        byId,
        d.curY,
        from.id,
      );

      const slackInches = slackAllowanceFeet * 12;
      const dragGeomInches = cableRunInchesOrthogonalAnchors(
        d.startX,
        d.startY,
        d.curX,
        d.curY,
        0,
        unitHeightPx,
        inchesPerRU,
        rackWidthPx,
        rackWidthInches,
      );
      const dragNeedInches = roundCableLengthInches(dragGeomInches + slackInches);
      const extraSlack = Math.max(0, dragCableRunDisplayInches({
        x1: d.startX,
        y1: d.startY,
        x2: d.curX,
        y2: d.curY,
        unitHeightPx,
        inchesPerRU,
        rackWidthPx,
        rackWidthInches,
      }));

      if (to) {
        const m = findFirstUnusedMatchingPortPair(from, to, connections);
        if (!m) {
          const dSnap = { ...d };
          const rackW = rackWidthPx;
          const th = totalHeight;
          const uPy = unitHeightPx;
          const dragFromId = from.id;
          const dragToId = to.id;
          const buildVisualRoute: BuildManualConnectionVisualRoute = (m2, devFrom, devTo) => {
            const targetEdge = inferToEdgeFromDrag(dSnap, rackW);
            return {
              fromEdge: edgeForConnectionDeviceEnd(
                m2.fromDeviceId,
                dragFromId,
                dragToId,
                dSnap.fromEdge,
                targetEdge,
              ),
              toEdge: edgeForConnectionDeviceEnd(
                m2.toDeviceId,
                dragFromId,
                dragToId,
                dSnap.fromEdge,
                targetEdge,
              ),
              fromYRatio: yRatioForConnectionDeviceEnd(
                m2.fromDeviceId,
                dragFromId,
                dragToId,
                dSnap.startY,
                dSnap.curY,
                devFrom,
                th,
                uPy,
              ),
              toYRatio: yRatioForConnectionDeviceEnd(
                m2.toDeviceId,
                dragFromId,
                dragToId,
                dSnap.startY,
                dSnap.curY,
                devTo,
                th,
                uPy,
              ),
            };
          };
          onPortMismatch({ from, to, extraSlackInches: extraSlack, buildVisualRoute });
        } else {
          const devFrom = byId.get(m.fromDeviceId);
          const devTo = byId.get(m.toDeviceId);
          if (devFrom && devTo) {
            const targetEdge = inferToEdgeFromDrag(d, rackWidthPx);
            const fromYRatio = yRatioForConnectionDeviceEnd(
              m.fromDeviceId,
              from.id,
              to.id,
              d.startY,
              d.curY,
              devFrom,
              totalHeight,
              unitHeightPx,
            );
            const toYRatio = yRatioForConnectionDeviceEnd(
              m.toDeviceId,
              from.id,
              to.id,
              d.startY,
              d.curY,
              devTo,
              totalHeight,
              unitHeightPx,
            );
            const routeFromEdge = edgeForConnectionDeviceEnd(
              m.fromDeviceId,
              from.id,
              to.id,
              d.fromEdge,
              targetEdge,
            );
            const routeToEdge = edgeForConnectionDeviceEnd(
              m.toDeviceId,
              from.id,
              to.id,
              d.fromEdge,
              targetEdge,
            );
            const route = {
              routeFromEdge,
              routeToEdge,
              routeFromYRatio: fromYRatio,
              routeToYRatio: toYRatio,
            };
            const base = connectionAnchorPoints(
              devFrom,
              devTo,
              totalHeight,
              unitHeightPx,
              rackWidthPx,
              rackWidthInches,
              route,
            );
            const anchorGeomInches = cableRunInchesOrthogonalAnchors(
              base.x1,
              base.y1,
              base.x2,
              base.y2,
              0,
              unitHeightPx,
              inchesPerRU,
              rackWidthPx,
              rackWidthInches,
            );
            const baseNeedInches = roundCableLengthInches(anchorGeomInches + slackInches);
            const totalMinInches = roundCableLengthInches(Math.max(baseNeedInches, dragNeedInches));
            const extraBeyondAnchor = roundCableLengthInches(Math.max(0, totalMinInches - baseNeedInches));
            const conn = connectionFromManualPorts(
              devFrom,
              devTo,
              m.fromPort,
              m.toPort,
              inchesPerRU,
              slackAllowanceFeet,
              extraBeyondAnchor,
              {
                fromEdge: routeFromEdge,
                toEdge: routeToEdge,
                fromYRatio,
                toYRatio,
              },
              totalMinInches,
            );
            onAddConnection(conn);
          }
        }
      }
      setDrag(null);
    },
    [
      byId,
      placedDevices,
      totalHeight,
      unitHeightPx,
      rackWidthPx,
      rackWidthInches,
      rackHeightPx,
      inchesPerRU,
      slackAllowanceFeet,
      onAddConnection,
      onPortMismatch,
      rackMetrics,
      releaseCableDragCapture,
      connections,
    ],
  );

  const dragSessionKey = drag
    ? `${drag.fromDeviceId}-${drag.fromEdge}-${drag.startX}-${drag.startY}`
    : null;
  useEffect(() => {
    if (!dragSessionKey) return;
    const move = (e: PointerEvent) => {
      const rect = rackMetrics();
      if (!rect) return;
      const xRel = e.clientX - rect.left;
      const yRel = e.clientY - rect.top;
      setDrag((prev) =>
        prev
          ? {
              ...prev,
              curX: Math.max(0, Math.min(rackWidthPx, xRel)),
              curY: Math.max(0, Math.min(rackHeightPx, yRel)),
            }
          : null,
      );
    };
    const up = (e: PointerEvent) => endDrag(e);
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
    document.addEventListener('pointercancel', up);
    return () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', up);
    };
  }, [dragSessionKey, endDrag, rackMetrics, rackWidthPx, rackHeightPx]);

  const handleSuggestionClick = (from: RackDevice, to: RackDevice, pair: ConnectablePair) => {
    if (hasDirectedPortConnection(connections, from.id, to.id, pair.fromPort, pair.toPort)) return;
    onAddConnection(
      connectionFromSuggestedPair(
        from,
        to,
        pair,
        inchesPerRU,
        slackAllowanceFeet,
        rackWidthPx,
        rackWidthInches,
      ),
    );
    setHoveredId(null);
  };

  const clearHoverLeaveTimer = useCallback(() => {
    if (hoverClearTimerRef.current) {
      clearTimeout(hoverClearTimerRef.current);
      hoverClearTimerRef.current = null;
    }
  }, []);

  const scheduleHoverClear = useCallback((deviceId: string) => {
    clearHoverLeaveTimer();
    hoverClearTimerRef.current = setTimeout(() => {
      setHoveredId((cur) => (cur === deviceId ? null : cur));
      hoverClearTimerRef.current = null;
    }, 240);
  }, [clearHoverLeaveTimer]);

  const startCableDragFromEdge = (
    deviceId: string,
    edge: DeviceEdge,
    clientX: number,
    clientY: number,
  ): boolean => {
    const r = rackMetrics();
    if (!r) return false;
    const d = byId.get(deviceId);
    if (d?.rackPosition === undefined) return false;
    const { top, height } = deviceRowBounds(d, totalHeight, unitHeightPx);
    const yRel = clientY - r.top;
    const yClamped = Math.min(Math.max(yRel, top + 2), top + height - 2);
    const xAnchor = anchorXForDeviceEdge(d, edge, rackWidthPx, rackWidthInches);
    const xRel = clientX - r.left;
    const yStart = Number.isFinite(yClamped) ? yClamped : deviceCenterY(d, totalHeight, unitHeightPx);
    setDrag({
      fromDeviceId: deviceId,
      fromEdge: edge,
      startX: xAnchor,
      startY: yStart,
      curX: Math.max(0, Math.min(rackWidthPx, xRel)),
      curY: Math.max(0, Math.min(rackHeightPx, yRel)),
    });
    setHoveredId(null);
    return true;
  };

  useEffect(() => {
    return () => clearHoverLeaveTimer();
  }, [clearHoverLeaveTimer]);

  return (
    <div ref={rackAreaRef} className="pointer-events-none absolute inset-0 z-[8] overflow-visible">
      <svg
        width={rackWidthPx}
        height={rackHeightPx}
        className="absolute left-0 top-0 overflow-visible"
        style={{ pointerEvents: 'none' }}
        aria-hidden
      >
        <g className="rack-side-manufacturer-labels">
          {placedDevices.map((d) => {
            if (d.rackPosition === undefined) return null;
            const placed = normalizeDeviceHorizontalFields(d, rackWidthInches);
            const { leftPx, widthPx } = deviceFaceHorizontalSpanPx(placed, rackWidthPx, rackWidthInches);
            if (!shouldShowManufacturerOnDeviceSide(d, widthPx, rackWidthInches)) return null;
            const raw = getDeviceManufacturerSideLabel(d).trim();
            if (!raw) return null;
            const { top, height } = deviceRowBounds(d, totalHeight, unitHeightPx);
            const fs = Math.min(11, Math.max(8, height / 16));
            const maxChars = Math.max(4, Math.floor((height - 8) / (fs * 0.95)));
            const label = raw.length > maxChars ? `${raw.slice(0, Math.max(0, maxChars - 1))}…` : raw;
            const cx = manufacturerSideLabelCenterX(leftPx, widthPx, rackWidthPx);
            const cy = top + height / 2;
            return (
              <text
                key={`mfr-edge-${d.id}`}
                x={cx}
                y={cy}
                transform={`rotate(-90 ${cx} ${cy})`}
                textAnchor="middle"
                dominantBaseline="central"
                fill="#e2e8f0"
                stroke="#020617"
                strokeWidth={2}
                style={{
                  fontSize: fs,
                  fontWeight: 600,
                  fontFamily: 'ui-monospace, Menlo, Monaco, Consolas, monospace',
                  paintOrder: 'stroke fill',
                }}
              >
                {label}
              </text>
            );
          })}
        </g>
        {connections.map((c) => {
          const a = byId.get(c.fromDeviceId);
          const b = byId.get(c.toDeviceId);
          if (a?.rackPosition === undefined || b?.rackPosition === undefined) return null;
          const base = connectionAnchorPoints(a, b, totalHeight, unitHeightPx, rackWidthPx, rackWidthInches, c);
          const { x1, y1, x2, y2 } = base;
          const bundleSpread = cableBundleSpreadY.get(c.id) ?? 0;
          const desiredYH = y2 + bundleSpread;
          const xSegMin = Math.min(x1, x2);
          const xSegMax = Math.max(x1, x2);
          const yHRaw = findSafeHorizontalCableY(
            desiredYH,
            xSegMin,
            xSegMax,
            placedDevices,
            totalHeight,
            unitHeightPx,
            rackWidthPx,
            rackWidthInches,
            rackHeightPx,
          );
          const yH = Math.max(0, Math.min(rackHeightPx, yHRaw));
          const spread = yH - y2;
          const dPath = verticalFirstCablePath(x1, y1, x2, y2, spread);
          const stroke = c.cableStyle === 'manual' ? '#cbd5e1' : '#38bdf8';
          const slackIn = slackAllowanceFeet * 12;
          const orthRun = cableRunInchesOrthogonalAnchors(
            x1,
            y1,
            x2,
            y2,
            spread,
            unitHeightPx,
            inchesPerRU,
            rackWidthPx,
            rackWidthInches,
          );
          /* Always derive from current anchor geometry when devices move — do not freeze on saved minCableLengthInches */
          const minInches = roundCableLengthInches(orthRun + slackIn + (c.extraSlackInches ?? 0));
          const lengthLabel = `>${formatCableLengthInches(minInches)}"`;
          const connectorLabel = `${c.fromPort.type} → ${c.toPort.type}`;
          const fromEdge = c.routeFromEdge ?? 'right';
          const toEdge = c.routeToEdge ?? 'left';
          const labelX = (x1 + x2) / 2;
          const labelYBase = yH;
          return (
            <g key={c.id} style={{ pointerEvents: 'auto' }}>
              <path
                d={dPath}
                fill="none"
                stroke={stroke}
                strokeWidth={c.cableStyle === 'manual' ? 2.25 : 2.75}
                opacity={0.98}
                style={{ pointerEvents: 'none', filter: 'drop-shadow(0 1px 2px rgb(0 0 0 / 0.85))' }}
              />
              {portSocketCircle(x1, y1, fromEdge)}
              {portSocketCircle(x2, y2, toEdge)}
              <circle
                cx={x1}
                cy={y1}
                r={6}
                fill="#020617"
                stroke={stroke}
                strokeWidth={2}
                style={{ pointerEvents: 'none' }}
              />
              <circle
                cx={x2}
                cy={y2}
                r={6}
                fill="#020617"
                stroke={stroke}
                strokeWidth={2}
                style={{ pointerEvents: 'none' }}
              />
              <text
                x={labelX}
                y={labelYBase - 1}
                textAnchor="middle"
                fill="#f8fafc"
                stroke="#020617"
                strokeWidth={3}
                style={{
                  fontSize: 11,
                  pointerEvents: 'none',
                  fontWeight: 700,
                  paintOrder: 'stroke fill',
                }}
              >
                {connectorLabel}
              </text>
              <text
                x={labelX}
                y={labelYBase + 14}
                textAnchor="middle"
                fill="#e2e8f0"
                stroke="#020617"
                strokeWidth={2.5}
                style={{
                  fontSize: 10,
                  pointerEvents: 'none',
                  fontWeight: 600,
                  paintOrder: 'stroke fill',
                }}
              >
                {lengthLabel}
              </text>
              {c.cableType && c.cableType !== connectorLabel ? (
                <text
                  x={labelX}
                  y={labelYBase + 28}
                  textAnchor="middle"
                  fill="#cbd5e1"
                  stroke="#020617"
                  strokeWidth={2}
                  style={{
                    fontSize: 9,
                    pointerEvents: 'none',
                    paintOrder: 'stroke fill',
                  }}
                >
                  {c.cableType.length > 36 ? `${c.cableType.slice(0, 34)}…` : c.cableType}
                </text>
              ) : null}
              {onRemoveConnection && (
                <path
                  d={dPath}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={20}
                  style={{ cursor: 'pointer', pointerEvents: 'stroke' }}
                  onClick={(ev) => {
                    ev.preventDefault();
                    ev.stopPropagation();
                    if (window.confirm('Remove this cable?')) onRemoveConnection(c.id);
                  }}
                />
              )}
            </g>
          );
        })}
        {drag ? (
          <path
            d={verticalFirstCablePath(drag.startX, drag.startY, drag.curX, drag.curY, 0)}
            fill="none"
            stroke="#67e8f9"
            strokeWidth={2.5}
            strokeDasharray="7 4"
            opacity={0.95}
            style={{ pointerEvents: 'none', filter: 'drop-shadow(0 0 6px rgb(34 211 238 / 0.45))' }}
          />
        ) : null}
      </svg>

      {drag && (
        <div
          className="pointer-events-none absolute rounded-md border border-cyan-500/40 bg-slate-950 px-2.5 py-1.5 text-xs font-mono font-bold tabular-nums text-cyan-100 shadow-xl shadow-black/70 ring-1 ring-cyan-500/20"
          style={{
            left: Math.min(drag.curX + 8, rackWidthPx - 72),
            top: Math.max(4, drag.curY - 28),
          }}
        >
          {formatCableLengthInches(
            cableRunInchesOrthogonalAnchors(
              drag.startX,
              drag.startY,
              drag.curX,
              drag.curY,
              0,
              unitHeightPx,
              inchesPerRU,
              rackWidthPx,
              rackWidthInches,
            ) + slackAllowanceFeet * 12,
          )}
          &quot;
        </div>
      )}

      {/* Full-height edge strips — grab here to pull a cable; center of row stays free for moving the device */}
      {placedDevices.map((d) => {
        if (d.rackPosition === undefined) return null;
        const { top, height } = deviceRowBounds(d, totalHeight, unitHeightPx);
        const rowH = Math.max(height, 8);
        const { leftPx, widthPx } = deviceFaceHorizontalSpanPx(d, rackWidthPx, rackWidthInches);
        const faceW = Math.max(widthPx, EDGE_STRIP_PX * 2 + 2);
        const stripClass =
          'pointer-events-auto absolute touch-none cursor-crosshair select-none border-y border-transparent bg-slate-950/40 hover:border-cyan-500/35 hover:bg-cyan-950/50 active:bg-cyan-900/40';
        return (
          <div key={`edge-${d.id}`}>
            <div
              role="presentation"
              title="Drag cable from left edge — release where the cable tip points; left/right strips on the target pick that side"
              className={stripClass}
              data-rack-device-id={d.id}
              style={{ left: leftPx, top, width: EDGE_STRIP_PX, height: rowH }}
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!startCableDragFromEdge(d.id, 'left', e.clientX, e.clientY)) return;
                const t = e.currentTarget;
                if (t instanceof HTMLElement) {
                  try {
                    t.setPointerCapture(e.pointerId);
                    cableDragCaptureElRef.current = t;
                  } catch {
                    /* ignore */
                  }
                }
              }}
              onMouseEnter={() => {
                clearHoverLeaveTimer();
                setHoveredId(d.id);
              }}
              onMouseLeave={() => scheduleHoverClear(d.id)}
            />
            <div
              role="presentation"
              title="Drag cable from right edge — release where the cable tip points; left/right strips on the target pick that side"
              className={stripClass}
              data-rack-device-id={d.id}
              style={{ left: leftPx + faceW - EDGE_STRIP_PX, top, width: EDGE_STRIP_PX, height: rowH }}
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!startCableDragFromEdge(d.id, 'right', e.clientX, e.clientY)) return;
                const t = e.currentTarget;
                if (t instanceof HTMLElement) {
                  try {
                    t.setPointerCapture(e.pointerId);
                    cableDragCaptureElRef.current = t;
                  } catch {
                    /* ignore */
                  }
                }
              }}
              onMouseEnter={() => {
                clearHoverLeaveTimer();
                setHoveredId(d.id);
              }}
              onMouseLeave={() => scheduleHoverClear(d.id)}
            />
            {hoveredId === d.id && suggestions.length > 0 && (
              <div
                className="pointer-events-auto absolute z-[9] max-h-52 w-[min(280px,calc(100%-16px))] overflow-y-auto rounded-xl border border-slate-700/90 bg-slate-950 p-3 text-sm text-slate-100 shadow-2xl shadow-black/80 ring-1 ring-cyan-950/60"
                style={{ left: 8, top: Math.min(top + rowH + 4, rackHeightPx - 140) }}
                onMouseDown={(e) => e.stopPropagation()}
                onMouseEnter={() => {
                  clearHoverLeaveTimer();
                  setHoveredId(d.id);
                }}
                onMouseLeave={() => scheduleHoverClear(d.id)}
              >
                <div className="mb-2 border-b border-slate-700 pb-2 text-sm font-bold uppercase tracking-wide text-cyan-200">
                  Suggested connections
                </div>
                <ul className="space-y-1">
                  {suggestions.map((s, i) => {
                    const from = byId.get(hoveredId)!;
                    return (
                      <li key={`${s.to.id}-${i}`}>
                        <button
                          type="button"
                          className="w-full rounded-lg border border-slate-800 bg-slate-900/90 px-3 py-2 text-left text-sm font-medium leading-snug text-slate-100 hover:border-cyan-600/50 hover:bg-slate-800 hover:text-cyan-50"
                          onClick={() => handleSuggestionClick(from, s.to, s.pair)}
                        >
                          {s.label}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
