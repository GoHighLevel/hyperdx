import api from './api';
import { IS_LOCAL_MODE } from './config';
import { useDeveloperPreview } from './useDeveloperPreview';

export function usePermissions() {
  const { data: me } = api.useMe();
  const { isViewingAsDeveloper } = useDeveloperPreview();
  return {
    canManageShared:
      IS_LOCAL_MODE || (me?.role === 'admin' && !isViewingAsDeveloper),
  };
}
