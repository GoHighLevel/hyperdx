import { LogShareTargetSchema } from '@hyperdx/common-utils/dist/logShare';
import { createHash, randomBytes } from 'crypto';
import express from 'express';
import { z } from 'zod';
import { processRequest } from 'zod-express-middleware';

import * as config from '@/config';
import { getSource } from '@/controllers/sources';
import { getNonNullUserWithTeam } from '@/middleware/auth';
import Dashboard from '@/models/dashboard';
import LogShare from '@/models/logShare';
import rateLimiter from '@/utils/rateLimiter';

const router = express.Router();
const hash = (id: string) => createHash('sha256').update(id).digest('hex');
const keyGenerator = (req: express.Request) => {
  const { teamId, userId } = getNonNullUserWithTeam(req);
  return `${teamId}:${userId ?? req.ip}`;
};

async function canOpenTarget(
  teamId: ReturnType<typeof getNonNullUserWithTeam>['teamId'],
  target: string,
) {
  const url = new URL(target, 'https://hyperdx.invalid');
  const source = url.searchParams.get('source') ?? '';
  const sourceDoc = await getSource(teamId.toString(), source);
  if (!sourceDoc || sourceDoc.disabled || sourceDoc.kind !== 'log')
    return false;
  const dashboard = url.pathname.match(/^\/dashboards\/([a-f0-9]{24})$/)?.[1];
  return (
    !dashboard || !!(await Dashboard.exists({ _id: dashboard, team: teamId }))
  );
}

router.post(
  '/',
  rateLimiter({ windowMs: 60_000, max: 20, keyGenerator }),
  (req, res, next) => {
    // Custom header plus strict origin validation prevents cross-site creation.
    const allowedOrigin = new URL(
      config.FRONTEND_URL || `${req.protocol}://${req.get('host')}`,
    ).origin;
    if (
      req.get('X-HyperDX-Share') !== '1' ||
      req.get('Origin') !== allowedOrigin
    )
      return res.sendStatus(403);
    next();
  },
  processRequest({ body: z.object({ target: LogShareTargetSchema }).strict() }),
  async (req, res, next) => {
    try {
      const { teamId, userId } = getNonNullUserWithTeam(req);
      const { target } = req.body;
      if (!(await canOpenTarget(teamId, target))) return res.sendStatus(404);
      const id = randomBytes(18).toString('base64url');
      await LogShare.create({
        team: teamId,
        createdBy: userId,
        source: new URL(target, 'https://hyperdx.invalid').searchParams.get(
          'source',
        ),
        target,
        tokenHash: hash(id),
        expiresAt: new Date(Date.now() + 30 * 86400_000),
      });
      return res.status(201).json({ id });
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/:id',
  rateLimiter({ windowMs: 60_000, max: 120, keyGenerator }),
  processRequest({
    params: z.object({ id: z.string().regex(/^[A-Za-z0-9_-]{24}$/) }),
  }),
  async (req, res, next) => {
    try {
      const { teamId } = getNonNullUserWithTeam(req);
      const share = await LogShare.findOne({
        team: teamId,
        tokenHash: hash(req.params.id),
        expiresAt: { $gt: new Date() },
      });
      if (
        !share ||
        !LogShareTargetSchema.safeParse(share.target).success ||
        !(await canOpenTarget(teamId, share.target))
      )
        return res.sendStatus(404);
      res.setHeader('Cache-Control', 'no-store');
      return res.json({ target: share.target });
    } catch (error) {
      next(error);
    }
  },
);
export default router;
