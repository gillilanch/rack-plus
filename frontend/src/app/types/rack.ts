import { Device, Port } from '../data/equipment';

export interface RackDevice extends Device {
  heightInU: number; // Rack units (1U = 1.75 inches)
  rackPosition?: number; // Starting U position (from bottom)
  physicalHeightInches?: number; // Original height in inches
}

/** Which side of the device row the cable meets in the rack diagram. */
export type RackCableVisualEdge = 'left' | 'right';

export interface RackConnection {
  id: string;
  fromDeviceId: string;
  fromPort: Port;
  toDeviceId: string;
  toPort: Port;
  cableType: string;
  estimatedLength: number; // in feet
  adapters?: string[];
  /** Minimum cable run in inches (rack geometry + slack); label shows >&nbsp;n */
  minCableLengthInches?: number;
  extraSlackInches?: number;
  cableStyle?: 'suggested' | 'manual';
  /** SVG anchor side (default: right at from, left at to — crosses rack). */
  routeFromEdge?: RackCableVisualEdge;
  routeToEdge?: RackCableVisualEdge;
  /** 0 = top of device row, 1 = bottom (default 0.5 = center). */
  routeFromYRatio?: number;
  routeToYRatio?: number;
}

export interface RackConfiguration {
  id: string;
  name: string;
  totalHeight: number; // Total rack units
  /** Inches per 1U (RU); default 1.75" for standard racks. */
  inchesPerRU?: number;
  /** Front-panel / rail width in inches (typical 19"). */
  rackWidthInches?: number;
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
