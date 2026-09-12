import type { UserRole } from '@hyperdx/common-utils/dist/types';
import type { RequestHandler } from 'express';

import { HYPERDX_ADMIN_EMAILS, IS_LOCAL_APP_MODE } from '@/config';
import { getCounter } from '@/utils/instrumentation';

const deniedRequests = getCounter('hyperdx.authorization.denied', {
  description: 'Requests denied by shared configuration permissions.',
});

export function getUserRole(user: { email?: string } | undefined): UserRole {
  return user?.email && HYPERDX_ADMIN_EMAILS.includes(user.email.toLowerCase())
    ? 'admin'
    : 'developer';
}

export const requireAdmin: RequestHandler = (req, res, next) => {
  if (IS_LOCAL_APP_MODE || getUserRole(req.user) === 'admin') return next();
  deniedRequests.add(1);
  return res.status(req.user?.email ? 403 : 401).json({
    message: 'Admin access is required to manage shared configuration.',
  });
};

export const requireAdminForWrites: RequestHandler = (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  return requireAdmin(req, res, next);
};
