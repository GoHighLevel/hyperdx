import type { PinnedFiltersValue } from '@hyperdx/common-utils/dist/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { hdxServer } from './api';
import { IS_LOCAL_MODE } from './config';
import { localPinnedFilters } from './localStore';
import { useSearchView } from './SearchViewContext';

type PinnedFiltersApiResponse = {
  team: { id: string; fields: string[]; filters: PinnedFiltersValue } | null;
};

function pinnedFiltersQueryKey(sourceId: string | null) {
  return ['pinned-filters', sourceId];
}

async function fetchPinnedFilters(
  sourceId: string,
): Promise<PinnedFiltersApiResponse> {
  if (IS_LOCAL_MODE) {
    const stored = localPinnedFilters.getAll();
    const entry = stored.find(s => s.source === sourceId) ?? null;
    return {
      team: entry
        ? { id: entry.id, fields: entry.fields, filters: entry.filters }
        : null,
    };
  }
  return hdxServer(`pinned-filters?source=${sourceId}`).json();
}

export function usePinnedFiltersApi(sourceId: string | null) {
  const view = useSearchView();
  const scoped = view?.sourceId === sourceId;
  const query = useQuery({
    queryKey: pinnedFiltersQueryKey(sourceId),
    queryFn: () => fetchPinnedFilters(sourceId!),
    enabled: !!sourceId && !scoped,
  });
  return scoped && view?.sharedPins
    ? {
        ...query,
        data: { team: { id: 'dashboard', ...view.sharedPins } },
      }
    : query;
}

type UpdatePinnedFiltersInput = {
  source: string;
  fields: string[];
  filters: PinnedFiltersValue;
};

export function useUpdatePinnedFilters() {
  const view = useSearchView();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdatePinnedFiltersInput) => {
      if (view?.sourceId === data.source) {
        view.setSharedPins({ fields: data.fields, filters: data.filters });
        return Promise.resolve();
      }
      if (IS_LOCAL_MODE) {
        const stored = localPinnedFilters.getAll();
        const existing = stored.find(s => s.source === data.source);
        if (existing) {
          return Promise.resolve(
            localPinnedFilters.update(existing.id, {
              fields: data.fields,
              filters: data.filters,
            }),
          );
        }
        return Promise.resolve(localPinnedFilters.create(data));
      }

      return hdxServer('pinned-filters', {
        method: 'PUT',
        json: data,
      }).json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: pinnedFiltersQueryKey(variables.source),
      });
    },
  });
}
