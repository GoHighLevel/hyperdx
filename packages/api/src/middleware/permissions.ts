import type { UserRole } from '@hyperdx/common-utils/dist/types';
import type { RequestHandler } from 'express';

import { IS_LOCAL_APP_MODE } from '@/config';
import { getTeamAdminIds } from '@/controllers/teamRoles';
import type { IUser } from '@/models/user';
import { getCounter } from '@/utils/instrumentation';

const deniedRequests = getCounter('hyperdx.authorization.denied', {
  description: 'Requests denied by shared configuration permissions.',
});

export async function getUserRole(
  user: Pick<IUser, '_id' | 'team'> | undefined,
): Promise<UserRole> {
  if (!user?._id || !user.team) return 'developer';
  const admins = await getTeamAdminIds(user.team);
  return admins.some(id => id.equals(user._id)) ? 'admin' : 'developer';
}

export const requireAdmin: RequestHandler = async (req, res, next) => {
  try {
    if (IS_LOCAL_APP_MODE || (await getUserRole(req.user)) === 'admin')
      return next();
    deniedRequests.add(1);
    return res.status(req.user?.email ? 403 : 401).json({
      message: 'Admin access is required to manage shared configuration.',
    });
  } catch (error) {
    next(error);
  }
};

export const requireAdminForWrites: RequestHandler = (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  return requireAdmin(req, res, next);
};
