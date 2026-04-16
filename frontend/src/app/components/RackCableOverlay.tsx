import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { findAllConnectablePairs, type ConnectablePair } from '../utils/cableFinder';
import {
  connectionFromManualPorts,
  connectionFromSuggestedPair,
  findFirstUnusedMatchingPortPair,
  hasDirectedPortConnection,
  type BuildManualConnectionVisualRoute,
} from '../utils/rackConnectionHelpers';
import {
  cableRunInchesBetweenAnchors,
  cableRunInchesFromPixelAnchors,
  dragCableRunDisplayInches,
  formatCableLengthInches,
  roundCableLengthInches,
} from '../utils/rackCableMetrics';
import type { RackConnection, RackDevice } from '../types/rack';
import { deviceFaceHorizontalSpanPx } from '../utils/rackDevicePlacement';
import { DEFAULT_RACK_WIDTH_INCHES } from '../utils/rackUnits';

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

/** Inset of cable anchor from rack left/right (matches SVG connection points). */
const DEVICE_EDGE_PAD_PX = 10;
/** Hit width along left/right of each device row (left strip sits in device pl-3 gutter). */
const EDGE_STRIP_PX = 22;
/** Extra vertical slack when mapping a drop Y to a device row (gaps between U lines, fuzzy release). */
function dropRowPadPx(unitHeightPx: number): number {
  return Math.max(28, unitHeightPx * 0.45);
}

/** Always a straight segment — matches the in-rack drag preview. */
function cableSvgPath(x1: number, y1: number, x2: number, y2: number): string {
  return `M ${x1} ${y1} L ${x2} ${y2}`;
}

/** Offset both ends along the normal so bundled cables fan out without changing length much. */
function bundleSpreadOffset(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  spread: number,
): { ox: number; oy: number } {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 1e-3) return { ox: 0, oy: spread };
  return { ox: (-dy / len) * spread, oy: (dx / len) * spread };
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
        r={3.5}
        fill="#f3f4f6"
        stroke="#9ca3af"
        strokeWidth={1}
        style={{ pointerEvents: 'none' }}
      />
    );
  }
  return (
    <circle
      cx={cx}
      cy={cy}
      r={3.5}
      fill="#eef2ff"
      stroke="#6366f1"
      strokeWidth={1}
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

  /** Fan out multiple links between the same two devices so paths are easier to see and hit. */
  const cableBundleSpreadY = useMemo(() => {
    const groups = new Map<string, RackConnection[]>();
    for (const conn of connections) {
      const k =
        conn.fromDeviceId < conn.toDeviceId
          ? `${conn.fromDeviceId}\0${conn.toDeviceId}`
          : `${conn.toDeviceId}\0${conn.fromDeviceId}`;
      const arr = groups.get(k);
      if (arr) arr.push(conn);
      else groups.set(k, [conn]);
    }
    const out = new Map<string, number>();
    const stepPx = 5;
    for (const arr of groups.values()) {
      if (arr.length <= 1) continue;
      const sorted = [...arr].sort((a, b) => a.id.localeCompare(b.id));
      sorted.forEach((conn, i) => {
        out.set(conn.id, (i - (sorted.length - 1) / 2) * stepPx);
      });
    }
    return out;
  }, [connections]);

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
      const pairs = findAllConnectablePairs(from, to, 12);
      for (const pair of pairs) {
        if (hasDirectedPortConnection(connections, from.id, to.id, pair.fromPort, pair.toPort)) continue;
        out.push({
          to,
          pair,
          label: `${to.name}: ${pair.solution.cable?.name ?? pair.fromPort.type} (${pair.solution.type})`,
        });
      }
    }
    return out.slice(0, 12);
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
      const dragGeomInches = cableRunInchesBetweenAnchors(
        d.startX,
        d.startY,
        d.curX,
        d.curY,
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
            const anchorGeomInches = cableRunInchesBetweenAnchors(
              base.x1,
              base.y1,
              base.x2,
              base.y2,
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
    onAddConnection(connectionFromSuggestedPair(from, to, pair, inchesPerRU, slackAllowanceFeet));
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
    if (!d?.rackPosition) return false;
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
        {connections.map((c) => {
          const a = byId.get(c.fromDeviceId);
          const b = byId.get(c.toDeviceId);
          if (!a?.rackPosition || !b?.rackPosition) return null;
          const base = connectionAnchorPoints(a, b, totalHeight, unitHeightPx, rackWidthPx, rackWidthInches, c);
          let { x1, y1, x2, y2 } = base;
          const spread = cableBundleSpreadY.get(c.id) ?? 0;
          if (spread !== 0) {
            const { ox, oy } = bundleSpreadOffset(x1, y1, x2, y2, spread);
            x1 += ox;
            y1 += oy;
            x2 += ox;
            y2 += oy;
          }
          const dPath = cableSvgPath(x1, y1, x2, y2);
          const stroke = c.cableStyle === 'manual' ? '#111827' : '#2563eb';
          const min =
            c.minCableLengthInches ??
            cableRunInchesFromPixelAnchors(
              base.x1,
              base.y1,
              base.x2,
              base.y2,
              unitHeightPx,
              inchesPerRU,
              slackAllowanceFeet,
              c.extraSlackInches ?? 0,
              rackWidthPx,
              rackWidthInches,
            );
          const label = `>${formatCableLengthInches(min)}"`;
          const fromEdge = c.routeFromEdge ?? 'right';
          const toEdge = c.routeToEdge ?? 'left';
          const midX = (x1 + x2) / 2;
          const midY = (y1 + y2) / 2 - 4;
          return (
            <g key={c.id} style={{ pointerEvents: 'auto' }}>
              <path d={dPath} fill="none" stroke={stroke} strokeWidth={c.cableStyle === 'manual' ? 1.5 : 2} opacity={0.92} style={{ pointerEvents: 'none' }} />
              {portSocketCircle(x1, y1, fromEdge)}
              {portSocketCircle(x2, y2, toEdge)}
              <circle cx={x1} cy={y1} r={5.5} fill="#cbd5e1" stroke={stroke} strokeWidth={1.75} style={{ pointerEvents: 'none' }} />
              <circle cx={x2} cy={y2} r={5.5} fill="#cbd5e1" stroke={stroke} strokeWidth={1.75} style={{ pointerEvents: 'none' }} />
              <text
                x={midX}
                y={midY}
                textAnchor="middle"
                className="fill-gray-800 text-[9px] font-semibold"
                style={{ fontSize: 9, pointerEvents: 'none' }}
              >
                {label}
              </text>
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
        {drag && (
          <path
            d={`M ${drag.startX} ${drag.startY} L ${drag.curX} ${drag.curY}`}
            fill="none"
            stroke="#111827"
            strokeWidth={1.5}
            strokeDasharray="4 2"
            style={{ pointerEvents: 'none' }}
          />
        )}
      </svg>

      {drag && (
        <div
          className="pointer-events-none absolute rounded border border-gray-800 bg-white/95 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-gray-900 shadow"
          style={{
            left: Math.min(drag.curX + 8, rackWidthPx - 52),
            top: Math.max(4, drag.curY - 20),
          }}
        >
          {formatCableLengthInches(
            cableRunInchesBetweenAnchors(
              drag.startX,
              drag.startY,
              drag.curX,
              drag.curY,
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
          'pointer-events-auto absolute touch-none cursor-crosshair select-none bg-transparent hover:bg-blue-500/15 active:bg-blue-500/25';
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
                className="pointer-events-auto absolute z-[9] max-h-48 w-[min(220px,calc(100%-24px))] overflow-y-auto rounded-lg border border-gray-200 bg-white p-2 text-xs shadow-lg"
                style={{ left: 8, top: Math.min(top + rowH + 4, rackHeightPx - 120) }}
                onMouseDown={(e) => e.stopPropagation()}
                onMouseEnter={() => {
                  clearHoverLeaveTimer();
                  setHoveredId(d.id);
                }}
                onMouseLeave={() => scheduleHoverClear(d.id)}
              >
                <div className="mb-1 font-semibold text-gray-800">Suggested connections</div>
                <ul className="space-y-1">
                  {suggestions.map((s, i) => {
                    const from = byId.get(hoveredId)!;
                    return (
                      <li key={`${s.to.id}-${i}`}>
                        <button
                          type="button"
                          className="w-full rounded border border-transparent px-2 py-1 text-left hover:border-blue-300 hover:bg-blue-50"
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
