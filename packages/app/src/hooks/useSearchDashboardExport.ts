import { convertToDashboardTemplate } from '@hyperdx/common-utils/dist/core/utils';
import {
  type SearchView,
  SearchViewSchema,
} from '@hyperdx/common-utils/dist/types';
import { notifications } from '@mantine/notifications';

import type { Dashboard } from '@/dashboard';
import { useUpdateDashboard } from '@/dashboard';
import { usePinnedFiltersApi } from '@/pinnedFilters';
import { useSearchView } from '@/SearchViewContext';
import { useSources } from '@/source';
import { useDeveloperUI } from '@/useDeveloperUI';
import { usePersonalPinnedFilters } from '@/usePersonalPinnedFilters';
import { useUserPreferences } from '@/useUserPreferences';
import { downloadObjectAsJson } from '@/utils/downloadObjectAsJson';

export function useSearchDashboardExport({
  dashboard,
  name,
  tags,
  search,
  time,
  analysisMode,
  patternColumn,
  denoise,
}: {
  dashboard?: Dashboard;
  name: string;
  tags: string[];
  search: SearchView['search'];
  time: SearchView['time'];
  analysisMode: SearchView['analysisMode'];
  patternColumn: string | null;
  denoise: boolean;
}) {
  const view = useSearchView();
  const { data: sources } = useSources();
  const { data: shared } = usePinnedFiltersApi(search.source);
  const personal = usePersonalPinnedFilters(search.source);
  const { userPreferences } = useUserPreferences();
  const layout = useDeveloperUI();
  const update = useUpdateDashboard();
  const capture = () => {
    if (!sources || !shared || !personal.isLoaded) {
      throw new Error(
        'Filters are still loading. Try exporting again in a moment.',
      );
    }
    return SearchViewSchema.parse({
      version: 1,
      search,
      time,
      analysisMode,
      patternColumn,
      denoise,
      layout,
      preferences: view?.preferences ?? {},
      userPreferences: {
        ...userPreferences,
        logFontSize: userPreferences.logFontSize ?? 10,
      },
      sharedPins: shared.team
        ? { fields: shared.team.fields, filters: shared.team.filters }
        : { fields: [], filters: {} },
      personalPins: {
        fields: personal.fields,
        filters: personal.filters,
        dismissedFields: personal.dismissedFields,
      },
    });
  };
  const reportError = (error: unknown) =>
    notifications.show({
      color: 'red',
      message:
        error instanceof Error
          ? error.message
          : 'Could not save the search view.',
    });
  return {
    exportView: () => {
      try {
        downloadObjectAsJson(
          convertToDashboardTemplate(
            {
              id: dashboard?.id ?? '',
              name,
              tags,
              tiles: [],
              searchView: capture(),
            },
            sources ?? [],
          ),
          name,
        );
      } catch (error) {
        reportError(error);
      }
    },
    saveView: async () => {
      if (!dashboard) return;
      try {
        await update.mutateAsync({
          id: dashboard.id,
          searchView: capture(),
        });
        notifications.show({ color: 'green', message: 'Dashboard updated.' });
      } catch (error) {
        reportError(error);
      }
    },
  };
}
