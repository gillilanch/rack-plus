import type { ConnectablePair } from './cableFinder';
import type { Port } from '../data/equipment';
import type { RackCableVisualEdge, RackConnection, RackDevice } from '../types/rack';
import { minCableInchesBetweenPlacedDevices } from './rackCableMetrics';
import { findMatchingPortPairs } from './rackConnections';

export function portsEqual(a: Port, b: Port): boolean {
  return (
    a.type === b.type && a.direction === b.direction && (a.label ?? '') === (b.label ?? '')
  );
}

/** True if this exact directed port link already exists (same from→to ports). */
export function hasDirectedPortConnection(
  connections: RackConnection[],
  fromDeviceId: string,
  toDeviceId: string,
  fromPort: Port,
  toPort: Port,
): boolean {
  return connections.some(
    (c) =>
      c.fromDeviceId === fromDeviceId &&
      c.toDeviceId === toDeviceId &&
      portsEqual(c.fromPort, fromPort) &&
      portsEqual(c.toPort, toPort),
  );
}

/** Any connection between two devices (ignores which ports). */
export function hasConnectionBetween(aId: string, bId: string, connections: RackConnection[]): boolean {
  return connections.some(
    (c) =>
      (c.fromDeviceId === aId && c.toDeviceId === bId) ||
      (c.fromDeviceId === bId && c.toDeviceId === aId),
  );
}

/** First matching output→input port pair that is not already used for a connection in that direction. */
export function findFirstUnusedMatchingPortPair(
  from: RackDevice,
  to: RackDevice,
  connections: RackConnection[],
): { fromPort: Port; toPort: Port; fromDeviceId: string; toDeviceId: string } | undefined {
  for (const m of findMatchingPortPairs(from, to)) {
    if (
      !hasDirectedPortConnection(
        connections,
        m.fromDeviceId,
        m.toDeviceId,
        m.fromPort,
        m.toPort,
      )
    ) {
      return m;
    }
  }
  return undefined;
}

export function connectionFromSuggestedPair(
  from: RackDevice,
  to: RackDevice,
  pair: ConnectablePair,
  inchesPerRU: number,
  slackFeet: number,
): RackConnection {
  const minIn = minCableInchesBetweenPlacedDevices(from, to, inchesPerRU, slackFeet);
  const cableType = pair.solution.cable?.name ?? `${pair.fromPort.type}→${pair.toPort.type}`;
  const adapters = pair.solution.adapters?.map((a) => a.name);
  return {
    id: `conn-${from.id}-${to.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    fromDeviceId: from.id,
    toDeviceId: to.id,
    fromPort: pair.fromPort,
    toPort: pair.toPort,
    cableType,
    estimatedLength: Math.max(1, Math.ceil(minIn / 12)),
    adapters,
    minCableLengthInches: minIn,
    extraSlackInches: 0,
    cableStyle: 'suggested',
    routeFromEdge: 'right',
    routeToEdge: 'left',
    routeFromYRatio: 0.5,
    routeToYRatio: 0.5,
  };
}

export type ManualConnectionVisualRoute = {
  fromEdge: RackCableVisualEdge;
  toEdge: RackCableVisualEdge;
  fromYRatio?: number;
  toYRatio?: number;
};

export function connectionFromManualPorts(
  from: RackDevice,
  to: RackDevice,
  fromPort: Port,
  toPort: Port,
  inchesPerRU: number,
  slackFeet: number,
  extraSlackInches: number,
  visualRoute?: ManualConnectionVisualRoute,
): RackConnection {
  const minIn = minCableInchesBetweenPlacedDevices(from, to, inchesPerRU, slackFeet);
  const totalMin = Math.ceil(minIn + extraSlackInches);
  return {
    id: `conn-manual-${from.id}-${to.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    fromDeviceId: from.id,
    toDeviceId: to.id,
    fromPort,
    toPort,
    cableType: `${fromPort.type}→${toPort.type}`,
    estimatedLength: Math.max(1, Math.ceil(totalMin / 12)),
    minCableLengthInches: totalMin,
    extraSlackInches,
    cableStyle: 'manual',
    ...(visualRoute
      ? {
          routeFromEdge: visualRoute.fromEdge,
          routeToEdge: visualRoute.toEdge,
          ...(visualRoute.fromYRatio !== undefined ? { routeFromYRatio: visualRoute.fromYRatio } : {}),
          ...(visualRoute.toYRatio !== undefined ? { routeToYRatio: visualRoute.toYRatio } : {}),
        }
      : {}),
  };
}
