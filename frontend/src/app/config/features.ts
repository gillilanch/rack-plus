/**
 * Feature flags — turn on when you reintroduce non–rack-MVP flows.
 *
 * Cable suggestions: integrated in the rack planner (`RackCableConnectionsPanel`); standalone `CableFinderView` is unused.
 * Connection map: restore `ConnectionSpecifier` / generate / export in `RackPlanner` when you wire the API.
 */
export const FEATURES = {
  rackConnectionMap: false,
} as const;
