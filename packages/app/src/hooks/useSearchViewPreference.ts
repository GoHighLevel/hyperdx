import { SetStateAction, useCallback, useEffect, useState } from 'react';
import type { SearchView } from '@hyperdx/common-utils/dist/types';

import { useSearchView } from '@/SearchViewContext';
import { useLocalStorage } from '@/utils';

type Preference = SearchView['preferences'][string];

// Search dashboards carry their own layout; ordinary searches retain their
// existing browser preferences. Both paths report the current layout for export.
export function useSearchViewPreference<T extends Preference>(
  key: string,
  initial: T,
  persist = true,
  snapshotKey = key,
): [T, (value: SetStateAction<T>) => void] {
  const context = useSearchView();
  const [stored, setStored] = useLocalStorage<T>(key, initial);
  const [transient, setTransient] = useState<T | undefined>(undefined);
  const fallback = persist ? stored : (transient ?? initial);
  const value = context?.sourceId
    ? ((context.preferences[snapshotKey] as T | undefined) ?? initial)
    : fallback;
  const setPreferences = context?.setPreferences;
  const sourceId = context?.sourceId;
  useEffect(() => {
    setPreferences?.(previous =>
      Object.is(previous[snapshotKey], value)
        ? previous
        : { ...previous, [snapshotKey]: value },
    );
  }, [snapshotKey, value, setPreferences]);
  const setValue = useCallback(
    (next: SetStateAction<T>) => {
      if (sourceId && setPreferences) {
        setPreferences(previous => ({
          ...previous,
          [snapshotKey]:
            typeof next === 'function'
              ? next((previous[snapshotKey] as T | undefined) ?? initial)
              : next,
        }));
      } else {
        if (persist) setStored(next);
        else
          setTransient(previous =>
            typeof next === 'function' ? next(previous ?? initial) : next,
          );
      }
    },
    [sourceId, setPreferences, snapshotKey, initial, persist, setStored],
  );
  return [value, setValue];
}
