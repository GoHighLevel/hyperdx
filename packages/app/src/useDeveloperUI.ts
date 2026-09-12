import {
  DEFAULT_DEVELOPER_UI,
  DeveloperUI,
} from '@hyperdx/common-utils/dist/types';

import api from './api';
import { usePermissions } from './usePermissions';

const ADMIN_UI: DeveloperUI = { ...DEFAULT_DEVELOPER_UI, analysisMode: true };

export function useDeveloperUI(): DeveloperUI {
  const { data: me } = api.useMe();
  const { canManageShared } = usePermissions();
  return canManageShared
    ? ADMIN_UI
    : { ...DEFAULT_DEVELOPER_UI, ...me?.team.developerUI };
}
