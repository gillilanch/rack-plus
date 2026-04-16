import { RackDevice, RackConnection } from '../types/rack';
import { getDeviceDisplayName } from './deviceDisplay';
import { Port } from '../data/equipment';
import { findConnection } from './cableFinder';
import { roundCableLengthInches } from './rackCableMetrics';
import { ConnectionSpec } from '../components/ConnectionSpecifier';

export function generateRackConnections(
  devices: RackDevice[],
  slackAllowance: number = 3,
  connectionSpecs?: ConnectionSpec[]
): RackConnection[] {
  const connections: RackConnection[] = [];
  const placedDevices = devices.filter(d => d.rackPosition !== undefined);

  // First, handle manually specified connections
  if (connectionSpecs && connectionSpecs.length > 0) {
    const sortedSpecs = [...connectionSpecs].sort(
      (a, b) => (b.priority || 0) - (a.priority || 0)
    );

    sortedSpecs.forEach(spec => {
      const fromDevice = placedDevices.find(
        (d) => getDeviceDisplayName(d) === spec.fromDeviceName,
      );
      const toDevice = placedDevices.find((d) => getDeviceDisplayName(d) === spec.toDeviceName);

      if (fromDevice && toDevice) {
        const generatedConnections = createConnectionsBetweenDevices(
          fromDevice,
          toDevice,
          slackAllowance
        );
        connections.push(...generatedConnections);
      }
    });

    return connections;
  }

  // If no specs provided, auto-generate connections (original behavior)
  const sortedDevices = [...placedDevices].sort(
    (a, b) => (b.rackPosition || 0) - (a.rackPosition || 0)
  );

  for (let i = 0; i < sortedDevices.length; i++) {
    for (let j = i + 1; j < sortedDevices.length; j++) {
      const deviceA = sortedDevices[i];
      const deviceB = sortedDevices[j];

      const generatedConnections = createConnectionsBetweenDevices(
        deviceA,
        deviceB,
        slackAllowance
      );
      connections.push(...generatedConnections);
    }
  }

  return connections;
}

function createConnectionsBetweenDevices(
  deviceA: RackDevice,
  deviceB: RackDevice,
  slackAllowance: number
): RackConnection[] {
  const connections: RackConnection[] = [];
  
  // Try to find matching ports
  const matchingPorts = findMatchingPortPairs(deviceA, deviceB);
  
  matchingPorts.forEach(({ fromPort, toPort, fromDeviceId, toDeviceId }) => {
    const fromDevice = fromDeviceId === deviceA.id ? deviceA : deviceB;
    const toDevice = toDeviceId === deviceA.id ? deviceA : deviceB;
    
    const distance = calculateRackDistance(
      fromDevice.rackPosition!,
      fromDevice.heightInU,
      toDevice.rackPosition!,
      toDevice.heightInU
    );

    const estimatedLength = roundCableLengthInches(distance + slackAllowance);

    // Find cable solution
    const solution = findConnection(fromDevice, toDevice);
    if (solution.length > 0) {
      const bestSolution = solution[0];
      
      connections.push({
        id: `conn-${fromDeviceId}-${toDeviceId}-${fromPort.type}`,
        fromDeviceId,
        fromPort,
        toDeviceId,
        toPort,
        cableType: bestSolution.cables[0] || fromPort.type,
        estimatedLength,
        adapters: bestSolution.adapters,
      });
    }
  });

  return connections;
}

export function findMatchingPortPairs(
  deviceA: RackDevice,
  deviceB: RackDevice
): Array<{ fromPort: Port; toPort: Port; fromDeviceId: string; toDeviceId: string }> {
  const matches: Array<{ fromPort: Port; toPort: Port; fromDeviceId: string; toDeviceId: string }> = [];

  // Look for output ports on deviceA and input ports on deviceB
  deviceA.ports.forEach(portA => {
    if (portA.direction === 'output' || portA.direction === 'both') {
      deviceB.ports.forEach(portB => {
        if (portA === portB) return;
        if (portB.direction === 'input' || portB.direction === 'both') {
          // Direct match
          if (portA.type === portB.type) {
            matches.push({ 
              fromPort: portA, 
              toPort: portB,
              fromDeviceId: deviceA.id,
              toDeviceId: deviceB.id
            });
          }
        }
      });
    }
  });

  // Also check reverse direction (deviceB to deviceA)
  deviceB.ports.forEach(portB => {
    if (portB.direction === 'output' || portB.direction === 'both') {
      deviceA.ports.forEach(portA => {
        if (portB === portA) return;
        if (portA.direction === 'input' || portA.direction === 'both') {
          if (portB.type === portA.type) {
            matches.push({ 
              fromPort: portB, 
              toPort: portA,
              fromDeviceId: deviceB.id,
              toDeviceId: deviceA.id
            });
          }
        }
      });
    }
  });

  return matches;
}

function calculateRackDistance(
  positionA: number,
  heightA: number,
  positionB: number,
  heightB: number
): number {
  // Calculate vertical distance in rack units
  const centerA = positionA + heightA / 2;
  const centerB = positionB + heightB / 2;
  const rackUnitsDistance = Math.abs(centerA - centerB);
  
  // Convert to feet (1U = 1.75 inches)
  const inches = rackUnitsDistance * 1.75;
  const feet = inches / 12;
  
  // Add some horizontal distance for routing (assume 2 feet horizontal)
  const horizontalDistance = 2;
  
  // Use Pythagorean theorem for cable path
  const totalDistance = Math.sqrt(feet * feet + horizontalDistance * horizontalDistance);
  
  return totalDistance;
}

export function exportRackConfiguration(
  rackConfig: {
    name: string;
    totalHeight: number;
    slackAllowance: number;
    devices: RackDevice[];
    connections: RackConnection[];
  }
): string {
  let output = '';
  
  // Header
  output += `RACK BUILD PLAN\n`;
  output += `===============\n`;
  output += `Configuration: ${rackConfig.name}\n`;
  output += `Rack Height: ${rackConfig.totalHeight}U\n`;
  output += `Cable Slack Allowance: ${rackConfig.slackAllowance} feet\n`;
  output += `Generated: ${new Date().toLocaleString()}\n\n`;

  // Device Layout
  output += `DEVICE LAYOUT\n`;
  output += `=============\n`;
  const placedDevices = rackConfig.devices
    .filter(d => d.rackPosition !== undefined)
    .sort((a, b) => (b.rackPosition || 0) - (a.rackPosition || 0));
  
  placedDevices.forEach(device => {
    output += `\n[${device.rackPosition}U - ${device.rackPosition! + device.heightInU}U] ${getDeviceDisplayName(device)}\n`;
    output += `  Category: ${device.category}\n`;
    output += `  Height: ${device.heightInU}U\n`;
    if (device.ports.length > 0) {
      output += `  Ports:\n`;
      device.ports.forEach(port => {
        output += `    - ${port.type} (${port.direction})`;
        if (port.label) output += ` - ${port.label}`;
        output += `\n`;
      });
    }
  });

  // Connection Map
  output += `\n\nCONNECTION MAP\n`;
  output += `==============\n`;
  
  if (rackConfig.connections.length === 0) {
    output += `No connections configured.\n`;
  } else {
    rackConfig.connections.forEach((conn, idx) => {
      const fromDevice = rackConfig.devices.find(d => d.id === conn.fromDeviceId);
      const toDevice = rackConfig.devices.find(d => d.id === conn.toDeviceId);
      
      output += `\n${idx + 1}. ${fromDevice ? getDeviceDisplayName(fromDevice) : '?'} → ${toDevice ? getDeviceDisplayName(toDevice) : '?'}\n`;
      output += `   Cable: ${conn.cableType}\n`;
      output += `   From Port: ${conn.fromPort.type}`;
      if (conn.fromPort.label) output += ` (${conn.fromPort.label})`;
      output += `\n`;
      output += `   To Port: ${conn.toPort.type}`;
      if (conn.toPort.label) output += ` (${conn.toPort.label})`;
      output += `\n`;
      output += `   Estimated Length: ${roundCableLengthInches(conn.estimatedLength)} feet\n`;
      
      if (conn.adapters && conn.adapters.length > 0) {
        output += `   Adapters Required: ${conn.adapters.join(', ')}\n`;
      }
    });
  }

  // Cable/Adapter List
  output += `\n\nCABLE & ADAPTER LIST\n`;
  output += `====================\n`;
  
  const cablesByType: Record<string, number[]> = {};
  const adapterCounts: Record<string, number> = {};

  rackConfig.connections.forEach(conn => {
    // Count cables by type and length
    if (!cablesByType[conn.cableType]) {
      cablesByType[conn.cableType] = [];
    }
    cablesByType[conn.cableType].push(conn.estimatedLength);

    // Count adapters
    if (conn.adapters) {
      conn.adapters.forEach(adapter => {
        adapterCounts[adapter] = (adapterCounts[adapter] || 0) + 1;
      });
    }
  });

  output += `\nCables:\n`;
  Object.entries(cablesByType).forEach(([type, lengths]) => {
    output += `  ${type}:\n`;
    lengths.forEach((length, idx) => {
      output += `    - ${roundCableLengthInches(length)}ft (Connection ${idx + 1})\n`;
    });
  });

  if (Object.keys(adapterCounts).length > 0) {
    output += `\nAdapters:\n`;
    Object.entries(adapterCounts).forEach(([adapter, count]) => {
      output += `  - ${adapter}: ${count}x\n`;
    });
  }

  // Summary
  const totalCables = rackConfig.connections.length;
  const totalAdapters = Object.values(adapterCounts).reduce((sum, count) => sum + count, 0);
  
  output += `\n\nSUMMARY\n`;
  output += `=======\n`;
  output += `Total Devices: ${placedDevices.length}\n`;
  output += `Total Connections: ${totalCables}\n`;
  output += `Total Adapters: ${totalAdapters}\n`;

  return output;
}