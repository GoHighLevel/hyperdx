import { z } from 'zod';

export const DashboardFolderNameSchema = z.string().trim().min(1).max(100);
export const DashboardFolderIdSchema = z.string().regex(/^[a-f\d]{24}$/i);
export const DashboardFolderSchema = z.object({
  id: DashboardFolderIdSchema,
  name: DashboardFolderNameSchema,
  access: z.enum(['admin', 'team']),
});
export type DashboardFolder = z.infer<typeof DashboardFolderSchema>;

/** Missing/legacy folders stay protected. Visibility is always team-wide. */
export function canWriteDashboardFolder(
  isAdmin: boolean,
  folder?: Pick<DashboardFolder, 'access'> | null,
) {
  return isAdmin || folder?.access === 'team';
}
