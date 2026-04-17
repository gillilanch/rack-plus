// Equipment database with ports and connectors

import { inferManufacturerModelFromLegacyName } from '../utils/deviceDisplay';

export type ConnectorType = 
  | 'HDMI' | 'SDI' | 'XLR' | 'USB-C' | 'USB-A' | 'Thunderbolt' 
  | '3.5mm' | '1/4 TRS' | 'RCA' | 'DisplayPort' | 'Mini DisplayPort'
  | 'DVI' | 'VGA' | 'Ethernet' | 'BNC' | 'TS';

export type PortDirection = 'input' | 'output' | 'both';

export interface Port {
  type: ConnectorType;
  direction: PortDirection;
  label?: string;
  count?: number;
}

export interface Device {
  id: string;
  name: string;
  /** Maker (searchable; stored on rack devices and custom catalog entries). */
  manufacturer?: string;
  /** Model name or number (searchable). */
  model?: string;
  /**
   * Category label for UI: Google Sheet “Category” for AVCAD/Postgres catalog rows; free-form for custom gear;
   * built-ins use familiar labels.
   */
  category: string;
  /** When from server catalog: legacy coarse bucket (Camera, Audio, Interface, …). Usually omitted in UI. */
  appCategory?: string;
  ports: Port[];
  /** Default rack height (U) when adding from Fox/custom database (optional on built-in catalog). */
  heightInU?: number;
  /** Default front-panel width in inches when placed on the rack (optional). */
  deviceWidthInches?: number;
  /** Face / equipment depth in inches (optional; Fox / custom DB + CSV add flow). */
  deviceDepthInches?: number;
  /** Physical height in inches (e.g. from Fox catalog sheet). */
  physicalHeightInches?: number;
  /** Power / PSU line from catalog sheet; copied to rack `sheetPower` when placed. */
  sheetPower?: string;
  /** Catalog / sheet notes; copied to rack `deviceNotes` when placed. */
  notes?: string;
  /**
   * Browser-saved device only: when set, this entry supersedes the built-in or server catalog row with this id
   * (the catalog row is hidden in the device database until this entry is removed).
   */
  replacesCatalogDeviceId?: string;
}

export interface Cable {
  id: string;
  name: string;
  connectorA: ConnectorType;
  connectorB: ConnectorType;
  category: 'Video' | 'Audio' | 'Data';
  notes?: string;
}

export interface Adapter {
  id: string;
  name: string;
  inputType: ConnectorType;
  outputType: ConnectorType;
  notes?: string;
}

const rawDevices: Device[] = [
  // Cameras
  {
    id: 'sony-fx6',
    name: 'Sony FX6',
    category: 'Camera',
    ports: [
      { type: 'HDMI', direction: 'output', label: 'HDMI Type A' },
      { type: 'SDI', direction: 'output', label: '12G-SDI', count: 2 },
      { type: 'XLR', direction: 'input', label: 'Audio In', count: 2 },
      { type: '3.5mm', direction: 'input', label: 'Mic In' },
      { type: '3.5mm', direction: 'output', label: 'Headphone' },
    ]
  },
  {
    id: 'sony-fx3',
    name: 'Sony FX3',
    category: 'Camera',
    ports: [
      { type: 'HDMI', direction: 'output', label: 'HDMI Type A' },
      { type: 'USB-C', direction: 'both', label: 'USB 3.2' },
      { type: '3.5mm', direction: 'input', label: 'Mic In' },
      { type: '3.5mm', direction: 'output', label: 'Headphone' },
    ]
  },
  {
    id: 'canon-c70',
    name: 'Canon C70',
    category: 'Camera',
    ports: [
      { type: 'HDMI', direction: 'output', label: 'HDMI 2.0' },
      { type: 'SDI', direction: 'output', label: '3G-SDI' },
      { type: 'XLR', direction: 'input', label: 'Audio In', count: 2 },
      { type: '3.5mm', direction: 'output', label: 'Headphone' },
    ]
  },
  {
    id: 'blackmagic-ursa',
    name: 'Blackmagic URSA Mini Pro',
    category: 'Camera',
    ports: [
      { type: 'SDI', direction: 'output', label: '12G-SDI', count: 4 },
      { type: 'HDMI', direction: 'output', label: 'HDMI' },
      { type: 'XLR', direction: 'input', label: 'Audio In', count: 2 },
      { type: 'Ethernet', direction: 'both', label: 'RJ45' },
    ]
  },

  // Laptops
  {
    id: 'macbook-pro-m3',
    name: 'MacBook Pro (M3)',
    category: 'Laptop',
    ports: [
      { type: 'Thunderbolt', direction: 'both', label: 'Thunderbolt 4/USB-C', count: 3 },
      { type: 'HDMI', direction: 'output', label: 'HDMI 2.1' },
      { type: '3.5mm', direction: 'output', label: 'Headphone' },
    ]
  },
  {
    id: 'macbook-air-m2',
    name: 'MacBook Air (M2)',
    category: 'Laptop',
    ports: [
      { type: 'Thunderbolt', direction: 'both', label: 'Thunderbolt/USB 4', count: 2 },
      { type: '3.5mm', direction: 'output', label: 'Headphone' },
    ]
  },
  {
    id: 'dell-precision',
    name: 'Dell Precision 5570',
    category: 'Laptop',
    ports: [
      { type: 'Thunderbolt', direction: 'both', label: 'Thunderbolt 4', count: 2 },
      { type: 'USB-A', direction: 'both', label: 'USB 3.2', count: 2 },
      { type: 'HDMI', direction: 'output', label: 'HDMI 2.0' },
      { type: '3.5mm', direction: 'both', label: 'Audio' },
    ]
  },

  // Recording Decks
  {
    id: 'atomos-ninja-v',
    name: 'Atomos Ninja V',
    category: 'Recording Deck',
    ports: [
      { type: 'HDMI', direction: 'both', label: 'HDMI 2.0' },
      { type: 'SDI', direction: 'both', label: 'SDI (with module)' },
      { type: '3.5mm', direction: 'input', label: 'Mic In' },
      { type: '3.5mm', direction: 'output', label: 'Headphone' },
    ]
  },
  {
    id: 'blackmagic-hyperdeck',
    name: 'Blackmagic HyperDeck Studio',
    category: 'Recording Deck',
    ports: [
      { type: 'SDI', direction: 'input', label: 'SDI In', count: 2 },
      { type: 'SDI', direction: 'output', label: 'SDI Out', count: 2 },
      { type: 'HDMI', direction: 'input', label: 'HDMI In' },
      { type: 'HDMI', direction: 'output', label: 'HDMI Out' },
      { type: 'XLR', direction: 'input', label: 'Audio In', count: 2 },
      { type: 'Ethernet', direction: 'both', label: 'RJ45' },
    ]
  },

  // Audio Equipment
  {
    id: 'zoom-h6',
    name: 'Zoom H6 Recorder',
    category: 'Audio',
    ports: [
      { type: 'XLR', direction: 'input', label: 'XLR/TRS Input', count: 2 },
      { type: '1/4 TRS', direction: 'input', label: 'Line In', count: 2 },
      { type: '3.5mm', direction: 'output', label: 'Headphone' },
      { type: 'USB-C', direction: 'both', label: 'USB Audio Interface' },
    ]
  },
  {
    id: 'sound-devices-mixpre',
    name: 'Sound Devices MixPre-6 II',
    category: 'Audio',
    ports: [
      { type: 'XLR', direction: 'input', label: 'XLR/TRS Input', count: 4 },
      { type: '1/4 TRS', direction: 'output', label: 'Line Out', count: 2 },
      { type: '3.5mm', direction: 'output', label: 'Headphone' },
      { type: 'USB-C', direction: 'both', label: 'USB Audio' },
    ]
  },
  {
    id: 'shure-sm7b',
    name: 'Shure SM7B Microphone',
    category: 'Audio',
    ports: [
      { type: 'XLR', direction: 'output', label: 'XLR Output' },
    ]
  },
  {
    id: 'sony-mdr-7506',
    name: 'Sony MDR-7506 Headphones',
    category: 'Audio',
    ports: [
      { type: '3.5mm', direction: 'input', label: '3.5mm TRS' },
      { type: '1/4 TRS', direction: 'input', label: '1/4" (with adapter)' },
    ]
  },
  {
    id: 'focusrite-scarlett',
    name: 'Focusrite Scarlett 2i2',
    category: 'Interface',
    ports: [
      { type: 'XLR', direction: 'input', label: 'XLR/TRS Input', count: 2 },
      { type: '1/4 TRS', direction: 'output', label: 'Monitor Out', count: 2 },
      { type: '3.5mm', direction: 'output', label: 'Headphone' },
      { type: 'USB-C', direction: 'both', label: 'USB Audio' },
    ]
  },
  {
    id: 'yamaha-mg10xu',
    name: 'Yamaha MG10XU',
    category: 'Audio',
    ports: [
      { type: 'XLR', direction: 'input', label: 'Mic', count: 4 },
      { type: '1/4 TRS', direction: 'both', label: 'Line', count: 3 },
      { type: 'USB-C', direction: 'both', label: 'USB' },
    ]
  },
  {
    id: 'yamaha-ql5',
    name: 'Yamaha QL5',
    category: 'Audio',
    ports: [
      { type: 'XLR', direction: 'input', label: 'Analog in', count: 16 },
      { type: 'XLR', direction: 'output', label: 'Analog out', count: 8 },
      { type: 'Ethernet', direction: 'both', label: 'Dante' },
    ]
  },

  // Monitors
  {
    id: 'lg-ultrafine-5k',
    name: 'LG UltraFine 5K',
    category: 'Monitor',
    ports: [
      { type: 'Thunderbolt', direction: 'input', label: 'Thunderbolt 3', count: 3 },
      { type: 'USB-C', direction: 'both', label: 'USB-C (downstream)' },
    ]
  },
  {
    id: 'dell-ultrasharp',
    name: 'Dell UltraSharp U2720Q',
    category: 'Monitor',
    ports: [
      { type: 'HDMI', direction: 'input', label: 'HDMI', count: 2 },
      { type: 'DisplayPort', direction: 'input', label: 'DisplayPort' },
      { type: 'USB-C', direction: 'input', label: 'USB-C (with DP alt mode)' },
      { type: 'USB-A', direction: 'both', label: 'USB Hub', count: 4 },
    ]
  },
  {
    id: 'flanders-scientific',
    name: 'Flanders Scientific DM240',
    category: 'Monitor',
    ports: [
      { type: 'SDI', direction: 'input', label: '3G-SDI', count: 2 },
      { type: 'HDMI', direction: 'input', label: 'HDMI 2.0' },
      { type: 'DisplayPort', direction: 'input', label: 'DisplayPort 1.2' },
    ]
  },
];

export const devices: Device[] = rawDevices.map((d) => {
  const { manufacturer, model } = inferManufacturerModelFromLegacyName(d.name);
  return { ...d, manufacturer, model };
});

export const cables: Cable[] = [
  // HDMI Cables
  { id: 'hdmi-std', name: 'HDMI Cable (Standard)', connectorA: 'HDMI', connectorB: 'HDMI', category: 'Video' },
  { id: 'hdmi-mini', name: 'HDMI to Mini HDMI Cable', connectorA: 'HDMI', connectorB: 'HDMI', category: 'Video', notes: 'For cameras with mini HDMI' },
  
  // SDI Cables
  { id: 'sdi-std', name: 'SDI Cable (BNC to BNC)', connectorA: 'SDI', connectorB: 'SDI', category: 'Video', notes: 'Use 12G-SDI rated for 4K' },
  
  // USB Cables
  { id: 'usb-c-to-c', name: 'USB-C to USB-C Cable', connectorA: 'USB-C', connectorB: 'USB-C', category: 'Data' },
  { id: 'usb-c-to-a', name: 'USB-C to USB-A Cable', connectorA: 'USB-C', connectorB: 'USB-A', category: 'Data' },
  
  // Thunderbolt Cables
  { id: 'tb4-cable', name: 'Thunderbolt 4 Cable', connectorA: 'Thunderbolt', connectorB: 'Thunderbolt', category: 'Data', notes: 'Also works for USB-C' },
  { id: 'tb3-cable', name: 'Thunderbolt 3 Cable', connectorA: 'Thunderbolt', connectorB: 'Thunderbolt', category: 'Data' },
  
  // Audio Cables
  { id: 'xlr-male-female', name: 'XLR Cable (Male to Female)', connectorA: 'XLR', connectorB: 'XLR', category: 'Audio' },
  { id: 'trs-quarter', name: '1/4" TRS Cable', connectorA: '1/4 TRS', connectorB: '1/4 TRS', category: 'Audio' },
  { id: '3.5mm-cable', name: '3.5mm TRS Cable', connectorA: '3.5mm', connectorB: '3.5mm', category: 'Audio' },
  { id: '3.5mm-to-quarter', name: '3.5mm to 1/4" Adapter Cable', connectorA: '3.5mm', connectorB: '1/4 TRS', category: 'Audio' },
  
  // DisplayPort
  { id: 'dp-std', name: 'DisplayPort Cable', connectorA: 'DisplayPort', connectorB: 'DisplayPort', category: 'Video' },
  { id: 'mini-dp', name: 'Mini DisplayPort Cable', connectorA: 'Mini DisplayPort', connectorB: 'DisplayPort', category: 'Video' },
  
  // Ethernet
  { id: 'cat6-cable', name: 'Ethernet Cable (Cat6)', connectorA: 'Ethernet', connectorB: 'Ethernet', category: 'Data' },
];

export const adapters: Adapter[] = [
  // Video Adapters
  { id: 'hdmi-to-sdi', name: 'HDMI to SDI Converter', inputType: 'HDMI', outputType: 'SDI', notes: 'Requires power' },
  { id: 'sdi-to-hdmi', name: 'SDI to HDMI Converter', inputType: 'SDI', outputType: 'HDMI', notes: 'Requires power' },
  { id: 'usbc-to-hdmi', name: 'USB-C to HDMI Adapter', inputType: 'USB-C', outputType: 'HDMI' },
  { id: 'tb-to-hdmi', name: 'Thunderbolt to HDMI Adapter', inputType: 'Thunderbolt', outputType: 'HDMI' },
  { id: 'usbc-to-dp', name: 'USB-C to DisplayPort Adapter', inputType: 'USB-C', outputType: 'DisplayPort' },
  { id: 'hdmi-to-dp', name: 'HDMI to DisplayPort Adapter', inputType: 'HDMI', outputType: 'DisplayPort', notes: 'Active adapter required' },
  { id: 'dp-to-hdmi', name: 'DisplayPort to HDMI Adapter', inputType: 'DisplayPort', outputType: 'HDMI' },
  
  // Audio Adapters
  { id: 'xlr-to-trs', name: 'XLR to 1/4" TRS Adapter', inputType: 'XLR', outputType: '1/4 TRS' },
  { id: 'trs-to-xlr', name: '1/4" TRS to XLR Adapter', inputType: '1/4 TRS', outputType: 'XLR' },
  { id: '3.5mm-to-xlr', name: '3.5mm to XLR Adapter', inputType: '3.5mm', outputType: 'XLR', notes: 'May require impedance matching' },
  { id: 'quarter-adapter', name: '3.5mm to 1/4" Adapter', inputType: '3.5mm', outputType: '1/4 TRS' },
  
  // Data Adapters
  { id: 'usbc-to-usba', name: 'USB-C to USB-A Adapter', inputType: 'USB-C', outputType: 'USB-A' },
  { id: 'usba-to-usbc', name: 'USB-A to USB-C Adapter', inputType: 'USB-A', outputType: 'USB-C' },
];
