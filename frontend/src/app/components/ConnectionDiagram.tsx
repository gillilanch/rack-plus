import { ConnectionSolution } from '../utils/cableFinder';
import { Device } from '../data/equipment';
import { ArrowRight } from 'lucide-react';

interface ConnectionDiagramProps {
  fromDevice: Device;
  toDevice: Device;
  solution: ConnectionSolution;
}

export function ConnectionDiagram({ fromDevice, toDevice, solution }: ConnectionDiagramProps) {
  if (solution.type === 'impossible') return null;

  return (
    <div className="mt-4 p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg border border-gray-300">
      <div className="text-xs font-semibold text-gray-500 uppercase mb-3">Connection Path</div>
      
      <div className="flex items-center gap-2 flex-wrap">
        {/* Source Device */}
        <div className="px-3 py-2 bg-white border-2 border-blue-400 rounded-lg shadow-sm">
          <div className="text-xs text-gray-500">From</div>
          <div className="font-semibold text-gray-900 text-sm">{fromDevice.name}</div>
        </div>

        <ArrowRight className="size-4 text-gray-400 flex-shrink-0" />

        {/* First Adapter if exists */}
        {solution.adapters && solution.adapters.length > 0 && (
          <>
            <div className="px-3 py-2 bg-yellow-50 border-2 border-yellow-400 rounded-lg shadow-sm">
              <div className="text-xs text-yellow-700">Adapter</div>
              <div className="font-medium text-gray-900 text-sm">
                {solution.adapters[0].inputType} → {solution.adapters[0].outputType}
              </div>
            </div>
            <ArrowRight className="size-4 text-gray-400 flex-shrink-0" />
          </>
        )}

        {/* Cable */}
        {solution.cable && (
          <>
            <div className="px-3 py-2 bg-green-50 border-2 border-green-400 rounded-lg shadow-sm">
              <div className="text-xs text-green-700">Cable</div>
              <div className="font-medium text-gray-900 text-sm">{solution.cable.name}</div>
            </div>
            <ArrowRight className="size-4 text-gray-400 flex-shrink-0" />
          </>
        )}

        {/* Second Adapter if exists */}
        {solution.adapters && solution.adapters.length > 1 && (
          <>
            <div className="px-3 py-2 bg-yellow-50 border-2 border-yellow-400 rounded-lg shadow-sm">
              <div className="text-xs text-yellow-700">Adapter</div>
              <div className="font-medium text-gray-900 text-sm">
                {solution.adapters[1].inputType} → {solution.adapters[1].outputType}
              </div>
            </div>
            <ArrowRight className="size-4 text-gray-400 flex-shrink-0" />
          </>
        )}

        {/* Destination Device */}
        <div className="px-3 py-2 bg-white border-2 border-purple-400 rounded-lg shadow-sm">
          <div className="text-xs text-gray-500">To</div>
          <div className="font-semibold text-gray-900 text-sm">{toDevice.name}</div>
        </div>
      </div>
    </div>
  );
}
