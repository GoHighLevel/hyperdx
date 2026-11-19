import { DashboardFolder } from '@hyperdx/common-utils/dist/dashboardFolders';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { hdxServer } from './api';
import { IS_LOCAL_MODE } from './config';
import type { Dashboard } from './dashboard';
import { createEntityStore } from './localStore';
import { useDeveloperPreview } from './useDeveloperPreview';
import { usePermissions } from './usePermissions';

const folders = createEntityStore<DashboardFolder>('hdx-dashboard-folders');

export function useDashboardFolders() {
  return useQuery({
    queryKey: ['dashboard-folders'],
    queryFn: () =>
      IS_LOCAL_MODE
        ? Promise.resolve(folders.getAll())
        : hdxServer('dashboard-folders').json<DashboardFolder[]>(),
  });
}

export function useSaveDashboardFolder() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name }: { id?: string; name: string }) => {
      if (IS_LOCAL_MODE) {
        return id
          ? folders.update(id, { name })
          : folders.create({ name, access: 'admin' });
      }
      return id
        ? hdxServer(`dashboard-folders/${id}`, {
            method: 'PATCH',
            json: { name },
          }).json<DashboardFolder>()
        : hdxServer('dashboard-folders', {
            method: 'POST',
            json: { name },
          }).json<DashboardFolder>();
    },
    onSuccess: () =>
      client.invalidateQueries({ queryKey: ['dashboard-folders'] }),
  });
}

export function useCanEditDashboard(
  dashboard?: Dashboard,
  isLocalDashboard = false,
) {
  const { canManageShared } = usePermissions();
  const { isViewingAsDeveloper } = useDeveloperPreview();
  return (
    canManageShared ||
    isLocalDashboard ||
    (!isViewingAsDeveloper && dashboard?.canEdit === true)
  );
}
