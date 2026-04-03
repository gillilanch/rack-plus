import { Device, Port } from '../data/equipment';

export interface RackDevice extends Device {
  heightInU: number; // Rack units (1U = 1.75 inches)
  rackPosition?: number; // Starting U position (from bottom)
  physicalHeightInches?: number; // Original height in inches
}

export interface RackConnection {
  id: string;
  fromDeviceId: string;
  fromPort: Port;
  toDeviceId: string;
  toPort: Port;
  cableType: string;
  estimatedLength: number; // in feet
  adapters?: string[];
}

export interface RackConfiguration {
  id: string;
  name: string;
  totalHeight: number; // Total rack units
  /** Inches per 1U (RU); default 1.75" for standard racks. */
  inchesPerRU?: number;
  slackAllowance: number; // Additional cable length in feet
  devices: RackDevice[];
  connections: RackConnection[];
}

export interface CSVDeviceRow {
  name: string;
  category?: string;
  heightInches?: number;
  heightU?: number;
  [key: string]: any; // Allow additional columns
}
