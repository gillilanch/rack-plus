import { memo, useCallback, useEffect, useId, useState } from 'react';
import { FOX_EQUIPMENT_CHANGED_EVENT } from '../utils/customDevices';
import {
  ensureDeviceCategoryInDb,
  getMergedDeviceCategoryNames,
  prefetchDeviceCategories,
} from '../utils/deviceCategoryCache';
import { FOX_SERVER_CATALOG_CHANGED_EVENT, prefetchServerCatalogDevices } from '../utils/serverCatalogCache';

type RackCategoryFieldProps = {
  id?: string;
  label?: string;
  value: string;
  onChange: (next: string) => void;
  className?: string;
  inputClassName?: string;
  labelClassName?: string;
  hintClassName?: string;
  placeholder?: string;
  /** When false, hides the server-sync hint under the input. */
  showHint?: boolean;
};

/**
 * Text field with `<datalist>` autocomplete: merged categories from the AVCAD catalog, Postgres
 * device-categories, built-in + custom devices. Users can type any value; new names save on blur.
 */
function RackCategoryFieldInner({
  id,
  label = 'Category',
  value,
  onChange,
  className,
  inputClassName = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500',
  labelClassName = 'mb-1 block text-xs font-medium text-gray-600',
  hintClassName = 'mt-1 text-xs text-gray-500',
  placeholder = 'Type or pick a category',
  showHint = true,
}: RackCategoryFieldProps) {
  const listId = useId();
  const [options, setOptions] = useState<string[]>([]);

  const refresh = useCallback(() => {
    void Promise.all([prefetchServerCatalogDevices(), prefetchDeviceCategories()]).finally(() => {
      setOptions(getMergedDeviceCategoryNames());
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const bump = () => setOptions(getMergedDeviceCategoryNames());
    window.addEventListener(FOX_SERVER_CATALOG_CHANGED_EVENT, bump);
    window.addEventListener(FOX_EQUIPMENT_CHANGED_EVENT, bump);
    return () => {
      window.removeEventListener(FOX_SERVER_CATALOG_CHANGED_EVENT, bump);
      window.removeEventListener(FOX_EQUIPMENT_CHANGED_EVENT, bump);
    };
  }, []);

  const persistNewCategory = useCallback(
    (raw: string) => {
      const t = raw.trim();
      if (!t) return;
      const lower = new Set(options.map((o) => o.toLowerCase()));
      if (!lower.has(t.toLowerCase())) {
        void ensureDeviceCategoryInDb(t).then(() => refresh());
      }
    },
    [options, refresh],
  );

  const handleBlur = () => {
    persistNewCategory(value);
  };

  return (
    <div className={className}>
      {label ? (
        <label htmlFor={id} className={labelClassName}>
          {label}
        </label>
      ) : null}
      <input
        id={id}
        list={listId}
        type="text"
        autoComplete="off"
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
        <p className={hintClassName}>
          Autocomplete lists AVCAD sheet categories and saved names; you can type anything new. Saved when you leave the
          field.
        </p>
      ) : null}
    </div>
  );
}

export const RackCategoryField = memo(RackCategoryFieldInner);
