import crypto from 'crypto';
import express from 'express';

import * as config from '@/config';
import { getNonNullUserWithTeam } from '@/middleware/auth';
import { requireAdmin } from '@/middleware/permissions';
import TeamJoinLink from '@/models/teamJoinLink';
import {
  googleWorkspaceConfigured,
  hashJoinToken,
} from '@/utils/googleWorkspace';
import { getCounter } from '@/utils/instrumentation';

const router = express.Router();
const changes = getCounter('hyperdx.authorization.join_link_changes', {
  description: 'Team joining link changes.',
});

router.get('/join-link', requireAdmin, async (req, res, next) => {
  try {
    const { teamId } = getNonNullUserWithTeam(req);
    const link = await TeamJoinLink.findOne({ teamId });
    res.set('Cache-Control', 'no-store').json({
      configured: googleWorkspaceConfigured(),
      domain: config.GOOGLE_WORKSPACE_DOMAIN,
      active: Boolean(link),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/join-link', requireAdmin, async (req, res, next) => {
  try {
    if (!googleWorkspaceConfigured())
      return res.status(409).json({
        message:
          'Configure Google Workspace sign-in before creating a joining link.',
      });
    const { teamId } = getNonNullUserWithTeam(req);
    const token = crypto.randomBytes(32).toString('hex');
    await TeamJoinLink.findOneAndUpdate(
      { teamId },
      { $set: { tokenHash: hashJoinToken(token) } },
      { upsert: true },
    );
    changes.add(1, { action: 'rotate' });
    // The fragment never reaches web-server request logs or Referer headers.
    res
      .set('Cache-Control', 'no-store')
      .json({ url: `${config.FRONTEND_URL}/join-company#token=${token}` });
  } catch (error) {
    next(error);
  }
});

router.delete('/join-link', requireAdmin, async (req, res, next) => {
  try {
    const { teamId } = getNonNullUserWithTeam(req);
    await TeamJoinLink.deleteOne({ teamId });
    changes.add(1, { action: 'revoke' });
    res.json({ active: false });
  } catch (error) {
    next(error);
  }
});

export default router;
