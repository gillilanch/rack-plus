import { ConnectionSolution } from '../utils/cableFinder';
import { Cable, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { Device } from '../data/equipment';
import { ConnectionDiagram } from './ConnectionDiagram';

interface ConnectionResultsProps {
  solutions: ConnectionSolution[];
  fromDevice: Device;
  toDevice: Device;
}

export function ConnectionResults({ solutions, fromDevice, toDevice }: ConnectionResultsProps) {
  if (solutions.length === 0) return null;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">Cable Recommendations</h3>
      
      {solutions.map((solution, idx) => (
        <div
          key={idx}
          className={`p-4 rounded-lg border-2 ${
            solution.type === 'impossible' 
              ? 'bg-red-50 border-red-200'
              : solution.confidence === 'high'
              ? 'bg-green-50 border-green-300'
              : 'bg-yellow-50 border-yellow-300'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className={`mt-1 ${
              solution.type === 'impossible' ? 'text-red-600' :
              solution.confidence === 'high' ? 'text-green-600' : 'text-yellow-600'
            }`}>
              {solution.type === 'impossible' ? (
                <AlertCircle className="size-6" />
              ) : solution.type === 'direct' ? (
                <CheckCircle2 className="size-6" />
              ) : (
                <Info className="size-6" />
              )}
            </div>
            
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold uppercase ${
                  solution.type === 'impossible' ? 'bg-red-200 text-red-800' :
                  solution.type === 'direct' ? 'bg-green-200 text-green-800' :
                  solution.type === 'adapter' ? 'bg-blue-200 text-blue-800' :
                  'bg-yellow-200 text-yellow-800'
                }`}>
                  {solution.type === 'direct' ? 'Direct Connection' :
                   solution.type === 'adapter' ? 'Adapter Required' :
                   solution.type === 'converter' ? 'Converter Required' :
                   'No Connection Available'}
                </span>
                
                <span className={`inline-block px-2 py-0.5 rounded text-xs ${
                  solution.confidence === 'high' ? 'bg-gray-200 text-gray-700' :
                  solution.confidence === 'medium' ? 'bg-gray-300 text-gray-800' :
                  'bg-gray-400 text-gray-900'
                }`}>
                  {solution.confidence} confidence
                </span>
              </div>

              {solution.cable && (
                <div className="mb-2">
                  <div className="flex items-center gap-2 text-gray-900 font-medium">
                    <Cable className="size-4" />
                    <span>{solution.cable.name}</span>
                  </div>
                  <div className="text-sm text-gray-600 ml-6">
                    {solution.cable.connectorA} ↔ {solution.cable.connectorB}
                    {solution.cable.notes && (
                      <span className="ml-2 italic">• {solution.cable.notes}</span>
                    )}
                  </div>
                </div>
              )}

              {solution.adapters && solution.adapters.length > 0 && (
                <div className="mb-2 ml-6">
                  <div className="text-sm font-medium text-gray-700 mb-1">Required Adapters:</div>
                  <ul className="space-y-1">
                    {solution.adapters.map((adapter, adapterIdx) => (
                      <li key={adapterIdx} className="text-sm text-gray-600">
                        • {adapter.name}
                        {adapter.notes && (
                          <span className="ml-2 italic text-gray-500">({adapter.notes})</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {solution.notes && (
                <div className="text-sm text-gray-700 bg-white bg-opacity-50 rounded p-2">
                  <strong>Note:</strong> {solution.notes}
                </div>
              )}

              {/* Add visual diagram for successful connections */}
              {solution.type !== 'impossible' && (
                <ConnectionDiagram 
                  fromDevice={fromDevice} 
                  toDevice={toDevice} 
                  solution={solution} 
                />
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}