import {
  SetStateAction,
  useCallback,
  useMemo,
  useSyncExternalStore,
} from 'react';
import { DEFAULT_DEVELOPER_UI } from '@hyperdx/common-utils/dist/types';

import api from '@/api';

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
  return () => {
    window.removeEventListener(storageKey, callback);
    window.removeEventListener('storage', callback);
  };
};

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
  const preferences = useMemo(() => parsePreferences(stored), [stored]);
  const fields = useMemo<SummaryField[]>(() => {
    const parsed = preferences[key];
    return isFields(parsed) ? parsed : defaults;
  }, [preferences, key, defaults]);
  const availableFields = useMemo(() => {
    const parsed = preferences[`${key}:available`];
    return isFields(parsed) ? parsed : fields;
  }, [preferences, key, fields]);
  const setFields = useCallback(
    (next: SetStateAction<SummaryField[]>) => {
      const previous = parsePreferences(read());
      const selected = previous[key];
      const current = isFields(selected) ? selected : defaults;
      const updated = typeof next === 'function' ? next(current) : next;
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
    [key, defaults],
  );
  const removeField = useCallback(
    (field: SummaryField) => {
      const previous = parsePreferences(read());
      const selected = previous[key];
      const current = isFields(selected) ? selected : defaults;
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
    [key, defaults],
  );
  const resetFields = useCallback(() => {
    const previous = parsePreferences(read());
    delete previous[key];
    delete previous[`${key}:available`];
    localStorage.setItem(storageKey, JSON.stringify(previous));
    window.dispatchEvent(new Event(storageKey));
  }, [key]);
  return [
    fields,
    setFields,
    availableFields,
    removeField,
    resetFields,
  ] as const;
}
