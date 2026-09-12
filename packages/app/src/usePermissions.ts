import api from './api';
import { IS_LOCAL_MODE } from './config';

export function usePermissions() {
  const { data: me } = api.useMe();
  return { canManageShared: IS_LOCAL_MODE || me?.role === 'admin' };
}
