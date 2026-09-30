import { canWriteDashboardFolder } from '@hyperdx/common-utils/dist/dashboardFolders';

import type { ObjectId } from '@/models';
import DashboardFolder from '@/models/dashboardFolder';

export async function dashboardFolderWriteError(
  teamId: ObjectId,
  folderId: string | null | undefined,
  isAdmin: boolean,
) {
  if (!folderId)
    return isAdmin ? null : 'Choose a developer folder to save this dashboard.';
  const folder = await DashboardFolder.findOne({ _id: folderId, team: teamId });
  if (!folder) return 'Dashboard folder not found.';
  return canWriteDashboardFolder(isAdmin, folder)
    ? null
    : 'Only admins can change dashboards in this folder.';
}
