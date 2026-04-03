import { Device } from '../data/equipment';

const STORAGE_KEY = 'visual-finder-custom-devices';

export const FOX_EQUIPMENT_CHANGED_EVENT = 'fox-equipment-changed';

function notifyFoxEquipmentChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(FOX_EQUIPMENT_CHANGED_EVENT));
  }
}

export function saveCustomDevice(device: Device): void {
  const customDevices = getCustomDevices();
  customDevices.push(device);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(customDevices));
  notifyFoxEquipmentChanged();
}

export function updateCustomDevice(device: Device): void {
  const customDevices = getCustomDevices();
  const i = customDevices.findIndex((d) => d.id === device.id);
  if (i === -1) return;
  customDevices[i] = device;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(customDevices));
  notifyFoxEquipmentChanged();
}

export function getCustomDevices(): Device[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Error loading custom devices:', error);
  }
  return [];
}

export function deleteCustomDevice(deviceId: string): void {
  const customDevices = getCustomDevices();
  const filtered = customDevices.filter((d) => d.id !== deviceId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  notifyFoxEquipmentChanged();
}

export function isCustomDevice(deviceId: string): boolean {
  return deviceId.startsWith('custom-');
}
