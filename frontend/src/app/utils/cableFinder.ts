import { Device, Cable, Adapter, ConnectorType, cables, adapters, type Port } from '../data/equipment';

export interface ConnectionSolution {
  type: 'direct' | 'adapter' | 'converter' | 'impossible';
  cable?: Cable;
  adapters?: Adapter[];
  notes?: string;
  confidence: 'high' | 'medium' | 'low';
}

// Check if two connector types are compatible
export function areConnectorsCompatible(typeA: ConnectorType, typeB: ConnectorType): boolean {
  if (typeA === typeB) return true;
  
  // USB-C and Thunderbolt are often compatible
  if ((typeA === 'USB-C' && typeB === 'Thunderbolt') || 
      (typeA === 'Thunderbolt' && typeB === 'USB-C')) {
    return true;
  }
  
  return false;
}

// Find a direct cable connection
function findDirectCable(fromType: ConnectorType, toType: ConnectorType): Cable | undefined {
  return cables.find(cable => 
    (cable.connectorA === fromType && cable.connectorB === toType) ||
    (cable.connectorA === toType && cable.connectorB === fromType) ||
    (areConnectorsCompatible(cable.connectorA, fromType) && cable.connectorB === toType) ||
    (cable.connectorA === fromType && areConnectorsCompatible(cable.connectorB, toType))
  );
}

// Find an adapter between two connector types
function findAdapter(fromType: ConnectorType, toType: ConnectorType): Adapter | undefined {
  return adapters.find(adapter =>
    (adapter.inputType === fromType && adapter.outputType === toType) ||
    (adapter.outputType === fromType && adapter.inputType === toType)
  );
}

// Find connection with one adapter
function findAdapterSolution(fromType: ConnectorType, toType: ConnectorType): ConnectionSolution | null {
  const adapter = findAdapter(fromType, toType);
  if (!adapter) return null;

  // Determine which side needs the adapter and find cable
  let cable: Cable | undefined;
  let intermediateType: ConnectorType;
  
  if (adapter.inputType === fromType) {
    intermediateType = adapter.outputType;
    cable = findDirectCable(intermediateType, toType);
  } else {
    intermediateType = adapter.inputType;
    cable = findDirectCable(fromType, intermediateType);
  }

  if (cable) {
    return {
      type: 'adapter',
      cable,
      adapters: [adapter],
      confidence: 'high',
      notes: `Use ${adapter.name} to convert ${fromType} to ${intermediateType}`
    };
  }

  return null;
}

// Find the best connection solution between two devices
export function findConnection(fromDevice: Device, toDevice: Device): ConnectionSolution[] {
  const solutions: ConnectionSolution[] = [];

  // Get output ports from source device
  const outputPorts = fromDevice.ports.filter(p => p.direction === 'output' || p.direction === 'both');
  
  // Get input ports from destination device
  const inputPorts = toDevice.ports.filter(p => p.direction === 'input' || p.direction === 'both');

  // Try to find connections for each output-input pair
  for (const outputPort of outputPorts) {
    for (const inputPort of inputPorts) {
      // Try direct cable first
      const directCable = findDirectCable(outputPort.type, inputPort.type);
      if (directCable) {
        solutions.push({
          type: 'direct',
          cable: directCable,
          confidence: 'high',
          notes: `Connect ${outputPort.label || outputPort.type} to ${inputPort.label || inputPort.type}`
        });
        continue;
      }

      // Try with one adapter
      const adapterSolution = findAdapterSolution(outputPort.type, inputPort.type);
      if (adapterSolution) {
        solutions.push({
          ...adapterSolution,
          notes: `${outputPort.label || outputPort.type} → ${inputPort.label || inputPort.type}: ${adapterSolution.notes}`
        });
        continue;
      }

      // Try to find two-adapter solution (less common)
      for (const intermediateAdapter of adapters) {
        if (intermediateAdapter.inputType === outputPort.type || intermediateAdapter.outputType === outputPort.type) {
          const intermediateType = intermediateAdapter.inputType === outputPort.type 
            ? intermediateAdapter.outputType 
            : intermediateAdapter.inputType;
          
          const secondAdapter = findAdapter(intermediateType, inputPort.type);
          if (secondAdapter) {
            const cable = findDirectCable(
              intermediateAdapter.outputType === intermediateType ? intermediateType : intermediateAdapter.inputType,
              secondAdapter.inputType === intermediateType ? secondAdapter.outputType : secondAdapter.inputType
            );
            
            if (cable) {
              solutions.push({
                type: 'converter',
                cable,
                adapters: [intermediateAdapter, secondAdapter],
                confidence: 'medium',
                notes: `Complex connection: ${outputPort.type} → ${intermediateType} → ${inputPort.type}`
              });
            }
          }
        }
      }
    }
  }

  // If no solutions found, return impossible
  if (solutions.length === 0) {
    solutions.push({
      type: 'impossible',
      confidence: 'low',
      notes: 'No compatible connection found. Check device specifications or consult engineering team.'
    });
  }

  // Sort by confidence and simplicity (direct > adapter > converter)
  return solutions.sort((a, b) => {
    const typeOrder = { direct: 0, adapter: 1, converter: 2, impossible: 3 };
    return typeOrder[a.type] - typeOrder[b.type];
  });
}

export type ConnectablePair = {
  fromPort: Port;
  toPort: Port;
  solution: ConnectionSolution;
};

/** Enumerate distinct output→input port pairs that have a direct or single-adapter cable path. */
export function findAllConnectablePairs(fromDevice: Device, toDevice: Device, max = 16): ConnectablePair[] {
  const out: ConnectablePair[] = [];
  const seen = new Set<string>();
  const outputPorts = fromDevice.ports.filter(
    (p) => p.direction === 'output' || p.direction === 'both',
  );
  const inputPorts = toDevice.ports.filter((p) => p.direction === 'input' || p.direction === 'both');

  for (const outputPort of outputPorts) {
    for (const inputPort of inputPorts) {
      const directCable = findDirectCable(outputPort.type, inputPort.type);
      if (directCable) {
        const key = `d-${outputPort.type}-${inputPort.type}-${outputPort.label ?? ''}-${inputPort.label ?? ''}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({
          fromPort: outputPort,
          toPort: inputPort,
          solution: {
            type: 'direct',
            cable: directCable,
            confidence: 'high',
            notes: `Connect ${outputPort.label || outputPort.type} to ${inputPort.label || inputPort.type}`,
          },
        });
        if (out.length >= max) return out;
        continue;
      }
      const adapterSolution = findAdapterSolution(outputPort.type, inputPort.type);
      if (adapterSolution) {
        const key = `a-${outputPort.type}-${inputPort.type}-${outputPort.label ?? ''}-${inputPort.label ?? ''}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({
          fromPort: outputPort,
          toPort: inputPort,
          solution: adapterSolution,
        });
        if (out.length >= max) return out;
      }
    }
  }
  return out;
}
