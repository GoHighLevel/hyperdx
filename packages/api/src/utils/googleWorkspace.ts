import crypto from 'crypto';
import { z } from 'zod';

import * as config from '@/config';

const identitySchema = z.object({
  sub: z.string().min(1).max(255),
  email: z
    .string()
    .email()
    .transform(email => email.toLowerCase()),
  email_verified: z.literal(true),
  hd: z.string(),
});

export function parseWorkspaceIdentity(profile: unknown, domain: string) {
  const identity = identitySchema.parse(profile);
  if (
    !domain ||
    identity.hd !== domain ||
    identity.email.split('@')[1] !== domain
  )
    throw new Error('Workspace domain is not allowed');
  return identity;
}

export const hashJoinToken = (token: string) =>
  crypto.createHash('sha256').update(token).digest('hex');

export function googleWorkspaceConfigured() {
  return Boolean(
    config.GOOGLE_CLIENT_ID &&
      config.GOOGLE_CLIENT_SECRET &&
      config.GOOGLE_REDIRECT_URI &&
      config.GOOGLE_WORKSPACE_DOMAIN,
  );
}

export async function exchangeGoogleCode(code: string, verifier: string) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.GOOGLE_CLIENT_ID,
      client_secret: config.GOOGLE_CLIENT_SECRET,
      redirect_uri: config.GOOGLE_REDIRECT_URI,
      grant_type: 'authorization_code',
      code_verifier: verifier,
    }),
    signal: AbortSignal.timeout(10_000),
    redirect: 'error',
  });
  if (!response.ok) throw new Error('Google code exchange failed');
  const tokens = z
    .object({ access_token: z.string().min(1) })
    .parse(await response.json());
  // The access token comes only from our server's code exchange, never the browser.
  // Google returns the authoritative identity over HTTPS; no unverified JWT parsing.
  const userInfo = await fetch(
    'https://openidconnect.googleapis.com/v1/userinfo',
    {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
      signal: AbortSignal.timeout(10_000),
      redirect: 'error',
    },
  );
  if (!userInfo.ok) throw new Error('Google identity lookup failed');
  return parseWorkspaceIdentity(
    await userInfo.json(),
    config.GOOGLE_WORKSPACE_DOMAIN,
  );
}
