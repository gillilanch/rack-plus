import { Device } from '../data/equipment';
import { Sparkles } from 'lucide-react';

interface Preset {
  name: string;
  fromId: string;
  toId: string;
  description: string;
}

interface QuickPresetsProps {
  devices: Device[];
  onSelectPreset: (from: Device, to: Device) => void;
  /** When set, only presets whose catalog IDs are both present in this rack are listed. */
  requiredDeviceIds?: Set<string>;
  /** `embedded` = compact block for rack sidebar; default = full standalone card. */
  variant?: 'default' | 'embedded';
  /** When variant=embedded: match dark rack sidebar (`dark`) vs light cable finder page (`default`). */
  embeddedSurface?: 'default' | 'dark';
}

export const quickConnectionPresets: Preset[] = [
  {
    name: 'Camera to Monitor',
    fromId: 'sony-fx6',
    toId: 'flanders-scientific',
    description: 'Sony FX6 → Flanders Monitor'
  },
  {
    name: 'Camera to Recorder',
    fromId: 'canon-c70',
    toId: 'atomos-ninja-v',
    description: 'Canon C70 → Atomos Ninja V'
  },
  {
    name: 'Laptop to Monitor',
    fromId: 'macbook-pro-m3',
    toId: 'dell-ultrasharp',
    description: 'MacBook Pro → Dell Monitor'
  },
  {
    name: 'Mic to Recorder',
    fromId: 'shure-sm7b',
    toId: 'zoom-h6',
    description: 'Shure SM7B → Zoom H6'
  },
  {
    name: 'Audio Interface to Laptop',
    fromId: 'focusrite-scarlett',
    toId: 'macbook-pro-m3',
    description: 'Focusrite → MacBook Pro'
  },
];

export function QuickPresets({
  devices,
  onSelectPreset,
  requiredDeviceIds,
  variant = 'default',
  embeddedSurface = 'default',
}: QuickPresetsProps) {
  const presets = requiredDeviceIds
    ? quickConnectionPresets.filter(
        (p) => requiredDeviceIds.has(p.fromId) && requiredDeviceIds.has(p.toId),
      )
    : quickConnectionPresets;

  const handlePresetClick = (preset: Preset) => {
    const fromDevice = devices.find((d) => d.id === preset.fromId);
    const toDevice = devices.find((d) => d.id === preset.toId);

    if (fromDevice && toDevice) {
      onSelectPreset(fromDevice, toDevice);
    }
  };

  if (presets.length === 0) {
    return null;
  }

  const isEmbedded = variant === 'embedded';
  const embeddedDark = isEmbedded && embeddedSurface === 'dark';

  return (
    <div
      className={
        isEmbedded
          ? embeddedDark
            ? 'mb-4 rounded-lg border border-violet-900/50 bg-violet-950/30 p-3'
            : 'mb-4 rounded-lg border border-purple-100 bg-purple-50/40 p-3'
          : 'mb-6 rounded-xl bg-white p-6 shadow-lg'
      }
    >
      <div className={`flex flex-wrap items-center gap-2 ${isEmbedded ? 'mb-3' : 'mb-4'}`}>
        <Sparkles
          className={`shrink-0 ${isEmbedded ? 'size-4' : 'size-5'} ${embeddedDark ? 'text-violet-300' : 'text-purple-600'}`}
        />
        <h2
          className={`font-semibold ${isEmbedded ? 'text-sm' : 'text-lg'} ${embeddedDark ? 'text-violet-100' : 'text-gray-900'}`}
        >
          Quick presets
        </h2>
        <span className={`text-xs ${embeddedDark ? 'text-violet-300/80' : 'text-gray-500'}`}>
          when both devices are on this rack
        </span>
      </div>

      <div className={`grid grid-cols-1 gap-2 ${isEmbedded ? 'sm:grid-cols-2' : 'gap-3 sm:grid-cols-2 lg:grid-cols-3'}`}>
        {presets.map((preset, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handlePresetClick(preset)}
            className={
              embeddedDark
                ? 'group rounded-lg border border-slate-600 bg-slate-800/90 p-2.5 text-left transition-all hover:border-violet-500 hover:bg-slate-700 sm:p-3'
                : 'group rounded-lg border-2 border-gray-200 bg-white p-2.5 text-left transition-all hover:border-purple-400 hover:bg-purple-50 sm:p-3'
            }
          >
            <div
              className={`mb-0.5 text-sm font-medium ${embeddedDark ? 'text-slate-100 group-hover:text-violet-200' : 'text-gray-900 group-hover:text-purple-900'}`}
            >
              {preset.name}
            </div>
            <div
              className={`text-xs ${embeddedDark ? 'text-slate-400 group-hover:text-violet-200/90' : 'text-gray-500 group-hover:text-purple-700'}`}
            >
              {preset.description}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
