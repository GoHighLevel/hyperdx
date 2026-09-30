import {
  DEFAULT_DEVELOPER_UI,
  DeveloperUI,
} from '@hyperdx/common-utils/dist/types';

import api from './api';
import { useSearchView } from './SearchViewContext';
import { usePermissions } from './usePermissions';

const ADMIN_UI: DeveloperUI = { ...DEFAULT_DEVELOPER_UI, analysisMode: true };

export function useDeveloperUI(): DeveloperUI {
  const { data: me } = api.useMe();
  const { canManageShared } = usePermissions();
  const view = useSearchView();
  const allowed = canManageShared
    ? ADMIN_UI
    : { ...DEFAULT_DEVELOPER_UI, ...me?.team.developerUI };
  if (!view?.layout) return allowed;
  const layout = view.layout;
  return {
    ...layout,
    analysisMode: allowed.analysisMode && layout.analysisMode,
    histogram: allowed.histogram && layout.histogram,
    sharedFilters: allowed.sharedFilters && layout.sharedFilters,
    filters: allowed.filters && layout.filters,
    denoise: allowed.denoise && layout.denoise,
    hiddenPersonalFilterFields: [
      ...new Set([
        ...allowed.hiddenPersonalFilterFields,
        ...layout.hiddenPersonalFilterFields,
      ]),
    ],
  };
}
