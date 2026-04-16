import { useCallback, useEffect, useId, useState } from 'react';
import {
  ensureDeviceCategoryInDb,
  getDeviceCategoryNames,
  prefetchDeviceCategories,
} from '../utils/deviceCategoryCache';

type RackCategoryFieldProps = {
  id?: string;
  label?: string;
  value: string;
  onChange: (next: string) => void;
  className?: string;
  inputClassName?: string;
  placeholder?: string;
  /** When false, hides the server-sync hint under the input. */
  showHint?: boolean;
};

export function RackCategoryField({
  id,
  label = 'Category',
  value,
  onChange,
  className,
  inputClassName = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500',
  placeholder = 'Type or pick a category',
  showHint = true,
}: RackCategoryFieldProps) {
  const listId = useId();
  const [options, setOptions] = useState<string[]>([]);

  const refresh = useCallback(() => {
    void prefetchDeviceCategories().then(() => setOptions(getDeviceCategoryNames()));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleBlur = () => {
    const t = value.trim();
    if (!t) return;
    const lower = new Set(options.map((o) => o.toLowerCase()));
    if (!lower.has(t.toLowerCase())) {
      void ensureDeviceCategoryInDb(t).then(() => refresh());
    }
  };

  return (
    <div className={className}>
      {label ? (
        <label htmlFor={id} className="mb-1 block text-xs font-medium text-gray-600">
          {label}
        </label>
      ) : null}
      <input
        id={id}
        list={listId}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={handleBlur}
        placeholder={placeholder}
        className={inputClassName}
      />
      <datalist id={listId}>
        {options.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
      {showHint ? (
        <p className="mt-1 text-xs text-gray-500">
          Categories are saved on the server. New names are added when you leave this field.
        </p>
      ) : null}
    </div>
  );
}
