import crypto from 'crypto';
import express from 'express';
import { z } from 'zod';
import { validateRequest } from 'zod-express-middleware';

import * as config from '@/config';
import { getTeamAdminIds } from '@/controllers/teamRoles';
import { redirectToDashboard } from '@/middleware/auth';
import { googleAuthRateLimit } from '@/middleware/googleAuthRateLimit';
import Team from '@/models/team';
import TeamJoinLink from '@/models/teamJoinLink';
import User from '@/models/user';
import {
  exchangeGoogleCode,
  googleWorkspaceConfigured,
  hashJoinToken,
} from '@/utils/googleWorkspace';
import { getCounter, setBusinessContext } from '@/utils/instrumentation';

declare module 'express-session' {
  interface SessionData {
    googleAuth?: {
      state: string;
      verifier: string;
      expiresAt: number;
      joinTokenHash?: string;
    };
  }
}

const router = express.Router();
const signIns = getCounter('hyperdx.authorization.google_sign_ins', {
  description: 'Google Workspace sign-in outcomes.',
});
const tokenSchema = z.string().regex(/^[a-f0-9]{64}$/);

router.get('/config', (_req, res) => {
  res.set('Cache-Control', 'no-store').json({
    configured: googleWorkspaceConfigured(),
    domain: config.GOOGLE_WORKSPACE_DOMAIN,
  });
});

router.post(
  '/start',
  googleAuthRateLimit,
  validateRequest({
    body: z.object({ joinToken: tokenSchema.optional() }).strict(),
  }),
  async (req, res, next) => {
    try {
      if (!googleWorkspaceConfigured())
        return res
          .status(503)
          .send('Google Workspace sign-in is not configured.');
      const joinTokenHash = req.body.joinToken
        ? hashJoinToken(req.body.joinToken)
        : undefined;
      if (
        joinTokenHash &&
        !(await TeamJoinLink.exists({ tokenHash: joinTokenHash }))
      )
        return res.redirect(
          303,
          `${config.FRONTEND_REDIRECT_BASE}/login?err=googleJoinLink`,
        );
      const state = crypto.randomBytes(32).toString('hex');
      const verifier = crypto.randomBytes(32).toString('base64url');
      req.session.googleAuth = {
        state,
        verifier,
        expiresAt: Date.now() + 10 * 60 * 1000,
        joinTokenHash,
      };
      await new Promise<void>((resolve, reject) =>
        req.session.save(error => (error ? reject(error) : resolve())),
      );
      const params = new URLSearchParams({
        client_id: config.GOOGLE_CLIENT_ID,
        redirect_uri: config.GOOGLE_REDIRECT_URI,
        response_type: 'code',
        scope: 'openid email',
        state,
        hd: config.GOOGLE_WORKSPACE_DOMAIN,
        prompt: 'select_account',
        code_challenge: crypto
          .createHash('sha256')
          .update(verifier)
          .digest('base64url'),
        code_challenge_method: 'S256',
      });
      res
        .set('Referrer-Policy', 'no-referrer')
        .redirect(
          303,
          `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
        );
    } catch (error) {
      next(error);
    }
  },
);

router.get('/callback', async (req, res, next) => {
  res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
  const attempt = req.session.googleAuth;
  const fail = (error = 'googleAuth') => {
    signIns.add(1, { outcome: 'denied' });
    return res.redirect(
      303,
      `${config.FRONTEND_REDIRECT_BASE}/login?err=${error}`,
    );
  };
  if (
    !googleWorkspaceConfigured() ||
    !attempt ||
    attempt.expiresAt < Date.now() ||
    typeof req.query.state !== 'string' ||
    req.query.state !== attempt.state
  )
    return fail();
  delete req.session.googleAuth;
  try {
    await new Promise<void>((resolve, reject) =>
      req.session.save(error => (error ? reject(error) : resolve())),
    );
    if (typeof req.query.code !== 'string' || req.query.code.length > 4096)
      return fail();
    const identity = await exchangeGoogleCode(req.query.code, attempt.verifier);
    const link = attempt.joinTokenHash
      ? await TeamJoinLink.findOne({ tokenHash: attempt.joinTokenHash })
      : null;
    if (attempt.joinTokenHash && !link) return fail('googleJoinLink');
    let user = await User.findOne({ googleSubject: identity.sub });
    if (user && link && !user.team.equals(link.teamId)) return fail();
    if (!user) {
      // Direct sign-in joins the operator-selected company team. A verified
      // Workspace identity also links existing password accounts in that team.
      const targetTeamId = link?.teamId ?? config.GOOGLE_WORKSPACE_TEAM_ID;
      if (!/^[a-f0-9]{24}$/i.test(String(targetTeamId)))
        return fail('googleTeamUnavailable');
      const targetTeam = await Team.findById(targetTeamId).select('_id');
      if (!targetTeam) return fail('googleTeamUnavailable');
      const existing = await User.findOne({ email: identity.email });
      if (existing) {
        user = await User.findOneAndUpdate(
          {
            _id: existing._id,
            team: targetTeam._id,
            $or: [
              { googleSubject: { $exists: false } },
              { googleSubject: identity.sub },
            ],
          },
          { $set: { googleSubject: identity.sub } },
          { new: true },
        );
        if (!user) return fail();
      } else {
        // Finish legacy admin migration before creating this user, so a stale
        // email allowlist cannot grant a new Workspace member admin access.
        await getTeamAdminIds(targetTeam._id);
        user = await User.create({
          email: identity.email,
          name: identity.email,
          team: targetTeam._id,
          googleSubject: identity.sub,
          passwordAuthDisabled: true,
        });
      }
    }
    if (!(await Team.exists({ _id: user.team }))) return fail();
    setBusinessContext({ teamId: String(user.team), userId: String(user._id) });
    req.login(user, error => {
      if (error) return next(error);
      signIns.add(1, { outcome: 'success' });
      redirectToDashboard(req, res);
    });
  } catch {
    // Never log OAuth codes, tokens, client secrets, or provider responses.
    return fail();
  }
});

export default router;
