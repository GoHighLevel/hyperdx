import { useCallback, useMemo } from 'react';
import type { PinnedFiltersValue } from '@hyperdx/common-utils/dist/types';
import { notifications } from '@mantine/notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { matchesPersonalFilterField } from './components/DBSearchPageFilters/personalFilterDefaults';
import api, { hdxServer } from './api';
import { IS_LOCAL_MODE } from './config';
import { useSearchView } from './SearchViewContext';

type PersonalPins = {
  fields: string[];
  filters: PinnedFiltersValue;
  dismissedFields?: string[];
};
const EMPTY_PINS: PersonalPins = { fields: [], filters: {} };

export function usePersonalPinnedFilters(sourceId: string | null) {
  const view = useSearchView();
  const scopedView = view?.sourceId === sourceId ? view : null;
  const updateScopedPins = scopedView?.setPersonalPins;
  const { data: me } = api.useMe();
  const userId = IS_LOCAL_MODE ? 'local' : me?.id;
  const queryClient = useQueryClient();
  const queryKey = useMemo(
    () => ['personal-pinned-filters', userId, sourceId],
    [userId, sourceId],
  );
  const storageKey = `hdx-personal-pins:${sourceId}`;
  const { data: fetchedData } = useQuery<PersonalPins>({
    queryKey,
    enabled: !!sourceId && !!userId && !scopedView,
    queryFn: async ({ signal }) => {
      if (IS_LOCAL_MODE) {
        return (
          JSON.parse(localStorage.getItem(storageKey) ?? 'null') ?? EMPTY_PINS
        );
      }
      return hdxServer(`personal-pinned-filters?source=${sourceId}`, {
        signal,
      }).json();
    },
  });
  const data = scopedView?.personalPins ?? fetchedData;
  const { mutate } = useMutation({
    mutationKey: queryKey,
    // Serialize snapshots from every hook instance for this account + source.
    scope: { id: JSON.stringify(queryKey) },
    mutationFn: async (pins: PersonalPins) => {
      if (IS_LOCAL_MODE) {
        localStorage.setItem(storageKey, JSON.stringify(pins));
        return;
      }
      await hdxServer('personal-pinned-filters', {
        method: 'PUT',
        json: { source: sourceId, ...pins },
      });
    },
    onError: () => {
      notifications.show({
        color: 'red',
        message: 'Could not save your personal filters. Please try again.',
      });
    },
    onSettled: (_data, error) => {
      if (!error && queryClient.isMutating({ mutationKey: queryKey }) === 1) {
        void queryClient.invalidateQueries({ queryKey });
      }
    },
  });

  const update = useCallback(
    (change: (pins: PersonalPins) => PersonalPins) => {
      if (updateScopedPins) {
        updateScopedPins(change);
        return;
      }
      if (!sourceId || !userId) return;
      const current = queryClient.getQueryData<PersonalPins>(queryKey);
      // Do not overwrite saved preferences before the first read completes.
      if (!current) return;
      const next = change(current);
      if (next === current) return;
      void queryClient.cancelQueries({ queryKey });
      queryClient.setQueryData(queryKey, next);
      mutate(next);
    },
    [sourceId, userId, queryClient, queryKey, mutate, updateScopedPins],
  );

  const rememberFields = useCallback(
    (fields: string[]) =>
      update(previous => {
        const missing = fields.filter(
          field =>
            !previous.fields.includes(field) &&
            !matchesPersonalFilterField(field, previous.dismissedFields ?? []),
        );
        if (!missing.length || previous.fields.length >= 100) return previous;
        return {
          ...previous,
          fields: [...new Set([...previous.fields, ...missing])].slice(0, 100),
        };
      }),
    [update],
  );

  const removeField = useCallback(
    (field: string) =>
      update(previous => ({
        ...previous,
        fields: previous.fields.filter(
          value => !matchesPersonalFilterField(value, [field]),
        ),
        filters: Object.fromEntries(
          Object.entries(previous.filters).filter(
            ([key]) => !matchesPersonalFilterField(key, [field]),
          ),
        ),
        dismissedFields: matchesPersonalFilterField(
          field,
          previous.dismissedFields ?? [],
        )
          ? previous.dismissedFields
          : [...(previous.dismissedFields ?? []), field],
      })),
    [update],
  );
  const restoreField = useCallback(
    (field: string) =>
      update(previous => {
        if (
          !matchesPersonalFilterField(field, previous.dismissedFields ?? [])
        ) {
          return previous;
        }
        return {
          ...previous,
          dismissedFields: previous.dismissedFields?.filter(
            value => !matchesPersonalFilterField(value, [field]),
          ),
        };
      }),
    [update],
  );
  const isFieldRemoved = useCallback(
    (field: string) =>
      matchesPersonalFilterField(field, data?.dismissedFields ?? []),
    [data?.dismissedFields],
  );

  return {
    removeField,
    restoreField,
    isFieldRemoved,
    isLoaded: data !== undefined,
    rememberFields,
    fields: data?.fields ?? EMPTY_PINS.fields,
    filters: data?.filters ?? EMPTY_PINS.filters,
    dismissedFields: data?.dismissedFields ?? [],
    setFields: (value: string[] | ((previous: string[]) => string[])) =>
      update(previous => ({
        ...previous,
        fields: typeof value === 'function' ? value(previous.fields) : value,
      })),
    setFilters: (
      value:
        | PinnedFiltersValue
        | ((previous: PinnedFiltersValue) => PinnedFiltersValue),
    ) =>
      update(previous => ({
        ...previous,
        filters: typeof value === 'function' ? value(previous.filters) : value,
      })),
  };
}
