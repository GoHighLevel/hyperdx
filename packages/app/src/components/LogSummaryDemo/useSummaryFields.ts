import {
  SetStateAction,
  useCallback,
  useMemo,
  useSyncExternalStore,
} from 'react';
import { DEFAULT_DEVELOPER_UI } from '@hyperdx/common-utils/dist/types';

import api from '@/api';
import { filterKeyPath } from '@/components/DBSearchPageFilters/utils';

import { SummaryField } from './LogSummaryRow';
import { summaryFieldForPath } from './resolveFields';
const storageKey = 'log-summary-fields-v1';
const isFields = (value: unknown): value is SummaryField[] =>
  Array.isArray(value) &&
  value.every(
    field =>
      typeof field?.id === 'string' &&
      typeof field.label === 'string' &&
      Array.isArray(field.paths) &&
      field.paths.every((path: unknown) => typeof path === 'string'),
  );
const parsePreferences = (snapshot: string): Record<string, unknown> => {
  try {
    const parsed = JSON.parse(snapshot);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
};
const read = () => {
  try {
    return localStorage.getItem(storageKey) ?? '{}';
  } catch {
    return '{}';
  }
};
const subscribe = (callback: () => void) => {
  window.addEventListener(storageKey, callback);
  window.addEventListener('storage', callback);
  window.addEventListener('popstate', callback);
  return () => {
    window.removeEventListener(storageKey, callback);
    window.removeEventListener('storage', callback);
    window.removeEventListener('popstate', callback);
  };
};

export function parseSharedSummaryFields(
  search: string,
  sourceId?: string,
): SummaryField[] | undefined {
  const params = new URLSearchParams(search);
  const value = params.get('summaryFields');
  if (
    !value ||
    value.length > 32_000 ||
    !sourceId ||
    params.get('source') !== sourceId
  )
    return undefined;
  try {
    const parsed: unknown = JSON.parse(value);
    return isFields(parsed) &&
      parsed.length <= 50 &&
      parsed.every(
        field =>
          field.id.length <= 1024 &&
          field.label.length <= 1024 &&
          field.paths.length <= 20 &&
          field.paths.every(path => path.length <= 1024),
      )
      ? parsed
      : undefined;
  } catch {
    return undefined;
  }
}

const readSharedSearch = () =>
  typeof window === 'undefined' ? '' : window.location.search;

export function useSummaryFields(sourceId?: string) {
  const { data: me } = api.useMe();
  const defaultPaths =
    me?.team?.developerUI?.defaultSummaryFields ??
    DEFAULT_DEVELOPER_UI.defaultSummaryFields;
  const defaults = useMemo(
    () => [
      ...new Map(
        defaultPaths.map(path => {
          const field = summaryFieldForPath(path);
          return [field.id, field] as const;
        }),
      ).values(),
    ],
    [defaultPaths],
  );
  const key = `${me?.email ?? 'anonymous'}:${sourceId ?? 'none'}`;
  const stored = useSyncExternalStore(subscribe, read, () => '{}');
  const sharedSearch = useSyncExternalStore(
    subscribe,
    readSharedSearch,
    () => '',
  );
  const sharedFields = useMemo(
    () => parseSharedSummaryFields(sharedSearch, sourceId),
    [sharedSearch, sourceId],
  );
  const clearSharedFields = useCallback(() => {
    if (!sharedFields) return;
    const url = new URL(window.location.href);
    url.searchParams.delete('summaryFields');
    window.history.replaceState(window.history.state, '', url);
  }, [sharedFields]);
  const preferences = useMemo(() => parsePreferences(stored), [stored]);
  const fields = useMemo<SummaryField[]>(() => {
    const parsed = preferences[key];
    return sharedFields ?? (isFields(parsed) ? parsed : defaults);
  }, [preferences, key, defaults, sharedFields]);
  const availableFields = useMemo(() => {
    const parsed = preferences[`${key}:available`];
    return isFields(parsed) ? parsed : fields;
  }, [preferences, key, fields]);
  const setFields = useCallback(
    (next: SetStateAction<SummaryField[]>) => {
      const previous = parsePreferences(read());
      const selected = previous[key];
      const current =
        sharedFields ?? (isFields(selected) ? selected : defaults);
      const updated = typeof next === 'function' ? next(current) : next;
      if (updated === current) return;
      clearSharedFields();
      const available = previous[`${key}:available`];
      const remembered = new Map(
        [...(isFields(available) ? available : []), ...current, ...updated].map(
          field => [field.id, field],
        ),
      );
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          ...previous,
          [key]: updated,
          [`${key}:available`]: [...remembered.values()],
        }),
      );
      window.dispatchEvent(new Event(storageKey));
    },
    [key, defaults, sharedFields, clearSharedFields],
  );
  const removeField = useCallback(
    (field: SummaryField) => {
      const previous = parsePreferences(read());
      const selected = previous[key];
      const current =
        sharedFields ?? (isFields(selected) ? selected : defaults);
      clearSharedFields();
      const available = previous[`${key}:available`];
      const catalog = isFields(available) ? available : current;
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          ...previous,
          [key]: current.filter(value => value.id !== field.id),
          [`${key}:available`]: catalog.filter(value => value.id !== field.id),
        }),
      );
      window.dispatchEvent(new Event(storageKey));
    },
    [key, defaults, sharedFields, clearSharedFields],
  );
  const resetFields = useCallback(() => {
    clearSharedFields();
    const previous = parsePreferences(read());
    delete previous[key];
    delete previous[`${key}:available`];
    localStorage.setItem(storageKey, JSON.stringify(previous));
    window.dispatchEvent(new Event(storageKey));
  }, [key, clearSharedFields]);
  const ensureField = useCallback(
    (expression: string) => {
      const path = filterKeyPath(expression).join('.');
      if (!path) return;
      const field = summaryFieldForPath(path);
      setFields(current =>
        current.some(item => item.id === field.id)
          ? current
          : [...current, field],
      );
    },
    [setFields],
  );
  return [
    fields,
    setFields,
    availableFields,
    removeField,
    resetFields,
    ensureField,
  ] as const;
}
