import mongoose, { Types } from 'mongoose';
import request from 'supertest';

import app from '@/api-app';
import * as config from '@/config';
import { MONGO_URI } from '@/config';
import Team from '@/models/team';
import TeamJoinLink from '@/models/teamJoinLink';
import User from '@/models/user';
import { hashJoinToken } from '@/utils/googleWorkspace';

jest.mock('@/config', () => ({
  ...jest.requireActual('@/config'),
  __esModule: true,
  GOOGLE_CLIENT_ID: 'local-test-client',
  GOOGLE_CLIENT_SECRET: 'local-test-secret',
  GOOGLE_REDIRECT_URI: 'http://localhost:3000/api/auth/google/callback',
  GOOGLE_WORKSPACE_DOMAIN: 'gohighlevel.com',
  GOOGLE_WORKSPACE_TEAM_ID: '',
}));

describe('Google Workspace joining over HTTP', () => {
  let teamId: Types.ObjectId;
  let adminId: Types.ObjectId;
  let token: string;
  let admin: ReturnType<typeof request.agent>;
  let browser: ReturnType<typeof request.agent>;
  const profile = () => ({
    sub: `${teamId}-google-user`,
    email: `${teamId}@gohighlevel.com`,
    email_verified: true,
    hd: 'gohighlevel.com',
  });
  const google = (identity: unknown = profile()) => {
    jest
      .mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'test-access-token' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => identity,
      } as Response);
  };
  const start = async (joinToken: string | undefined = token) => {
    const response = await browser
      .post('/auth/google/start')
      .send(joinToken ? { joinToken } : {})
      .expect(303);
    return new URL(response.headers.location).searchParams.get('state');
  };
  const callback = (state: string | null) =>
    browser.get('/auth/google/callback').query({ state, code: 'test-code' });

  beforeAll(async () => {
    if (
      !MONGO_URI ||
      new URL(MONGO_URI).pathname !== '/hyperdx_membership_test'
    )
      throw new Error('Use isolated membership test database');
    await mongoose.connect(MONGO_URI);
    await Promise.all([User.init(), TeamJoinLink.init()]);
  });
  beforeEach(async () => {
    jest.mocked(fetch).mockReset();
    teamId = new Types.ObjectId();
    jest.replaceProperty(config, 'GOOGLE_WORKSPACE_TEAM_ID', String(teamId));
    const owner = await User.create({
      email: `${teamId}-owner@gohighlevel.com`,
      team: teamId,
    });
    adminId = owner._id;
    await (owner as any).setPassword('TestPassword!938');
    await owner.save();
    await Team.create({
      _id: teamId,
      name: 'Google auth test',
      adminUserIds: [adminId],
    });
    admin = request.agent(app);
    browser = request.agent(app);
    await admin
      .post('/login/password')
      .send({ email: owner.email, password: 'TestPassword!938' })
      .expect(303);
    const link = await admin.post('/team/join-link').expect(200);
    token = new URLSearchParams(
      new URL(link.body.url, 'http://localhost').hash.slice(1),
    ).get('token')!;
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    await User.deleteMany({ team: teamId });
    await TeamJoinLink.deleteOne({ teamId });
    await Team.deleteOne({ _id: teamId });
  });
  afterAll(async () => {
    await mongoose.disconnect();
  });

  it('stores only a link hash and starts OAuth with state and PKCE', async () => {
    const link = await TeamJoinLink.findOne({ teamId });
    expect(link?.tokenHash).toBe(hashJoinToken(token));
    expect(JSON.stringify(link)).not.toContain(token);
    const started = await browser
      .post('/auth/google/start')
      .send({ joinToken: token })
      .expect(303);
    const url = new URL(started.headers.location);
    expect(url.origin).toBe('https://accounts.google.com');
    expect(url.searchParams.get('state')).toHaveLength(64);
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('hd')).toBe('gohighlevel.com');
  });

  it('joins as a developer and uses Google for later login without a link', async () => {
    const state = await start();
    google();
    expect((await callback(state)).headers.location).not.toContain('err=');
    expect((await browser.get('/me').expect(200)).body.role).toBe('developer');
    const user = await User.findOne({ email: profile().email });
    expect(user?.googleSubject).toBe(profile().sub);
    expect(user?.get('hasPasswordAuth')).toBe(false);
    await browser.post('/team/join-link').expect(403);
    await browser
      .patch('/team/members/role')
      .send({ userIds: [user?._id], role: 'admin' })
      .expect(403);
    await admin.delete('/team/join-link').expect(200);
    browser = request.agent(app);
    const loginState = await start('');
    google();
    expect((await callback(loginState)).headers.location).not.toContain('err=');
    await browser.get('/me').expect(200);
  });

  it.each([
    { hd: 'other-company.com' },
    { hd: undefined },
    { email_verified: false },
    { email: 'user@gohighlevel.com.attacker.test' },
  ])(
    'denies identities outside the verified company boundary: %j',
    async changes => {
      const state = await start('');
      google({ ...profile(), ...changes });
      expect((await callback(state)).headers.location).toContain(
        'err=googleAuth',
      );
      await browser.get('/me').expect(401);
      expect(await User.countDocuments({ team: teamId })).toBe(1);
    },
  );

  it('rejects missing/mismatched state and a callback in another browser', async () => {
    const state = await start();
    expect((await callback('wrong')).headers.location).toContain(
      'err=googleAuth',
    );
    const response = await request(app)
      .get('/auth/google/callback')
      .query({ state, code: 'test-code' });
    expect(response.headers.location).toContain('err=googleAuth');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('consumes state once, even after Google rejects the code', async () => {
    const state = await start();
    jest.mocked(fetch).mockResolvedValueOnce({ ok: false } as Response);
    expect((await callback(state)).headers.location).toContain(
      'err=googleAuth',
    );
    expect((await callback(state)).headers.location).toContain(
      'err=googleAuth',
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('rejects expired state before contacting Google', async () => {
    const state = await start();
    const later = Date.now() + 11 * 60 * 1000;
    jest.spyOn(Date, 'now').mockReturnValue(later);
    expect((await callback(state)).headers.location).toContain(
      'err=googleAuth',
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it('does not link an email owned by another team', async () => {
    const otherTeam = new Types.ObjectId();
    const other = await User.create({
      email: profile().email,
      team: otherTeam,
    });
    try {
      const state = await start('');
      google();
      expect((await callback(state)).headers.location).toContain(
        'err=googleAuth',
      );
      expect((await User.findById(other._id))?.googleSubject).toBeUndefined();
    } finally {
      await User.deleteOne({ _id: other._id, team: otherTeam });
    }
  });

  it.each(['revoke', 'rotate'])(
    'rejects an in-progress join after link %s',
    async action => {
      const state = await start();
      if (action === 'revoke')
        await admin.delete('/team/join-link').expect(200);
      else await admin.post('/team/join-link').expect(200);
      google();
      expect((await callback(state)).headers.location).toContain(
        'err=googleJoinLink',
      );
      expect(await User.countDocuments({ team: teamId })).toBe(1);
    },
  );

  it('joins the configured team as a developer directly from Google login', async () => {
    const state = await start('');
    google();
    expect((await callback(state)).headers.location).not.toContain('err=');
    const me = (await browser.get('/me').expect(200)).body;
    expect(me.role).toBe('developer');
    const user = await User.findOne({ email: profile().email });
    expect(user?.team.equals(teamId)).toBe(true);
    expect(user?.googleSubject).toBe(profile().sub);
    expect(user?.get('hasPasswordAuth')).toBe(false);
    expect(await User.countDocuments({ team: teamId })).toBe(2);
    await browser.post('/team/join-link').expect(403);
    await browser
      .patch('/team/members/role')
      .send({ userIds: [user!._id], role: 'admin' })
      .expect(403);

    browser = request.agent(app);
    const nextState = await start('');
    google();
    expect((await callback(nextState)).headers.location).not.toContain('err=');
    expect((await browser.get('/me').expect(200)).body.role).toBe('developer');
    expect(await User.countDocuments({ team: teamId })).toBe(2);
  });

  it.each(['', new Types.ObjectId().toString(), 'not-an-id'])(
    'does not guess or create a team when the configured team is invalid: %s',
    async target => {
      jest.replaceProperty(config, 'GOOGLE_WORKSPACE_TEAM_ID', target);
      const state = await start('');
      google();
      expect((await callback(state)).headers.location).toContain(
        'err=googleTeamUnavailable',
      );
      expect(await User.countDocuments({ team: teamId })).toBe(1);
      await browser.get('/me').expect(401);
    },
  );

  it('never promotes a new Google user through the legacy admin allowlist', async () => {
    const owner = await User.findById(adminId);
    jest.replaceProperty(config, 'HYPERDX_ADMIN_EMAILS', [
      owner!.email,
      profile().email,
    ]);
    await Team.updateOne({ _id: teamId }, { $unset: { adminUserIds: '' } });
    const state = await start('');
    google();
    expect((await callback(state)).headers.location).not.toContain('err=');
    expect((await browser.get('/me').expect(200)).body.role).toBe('developer');
    expect((await Team.findById(teamId))?.adminUserIds?.map(String)).toEqual([
      String(adminId),
    ]);
  });

  it('does not accept a requested role or team from the sign-in form', async () => {
    await browser
      .post('/auth/google/start')
      .send({ role: 'admin', teamId: String(teamId) })
      .expect(400);
  });

  it('links an existing password admin without overwriting their role/password', async () => {
    const owner = await User.findById(adminId);
    const state = await start('');
    google({ ...profile(), email: owner!.email });
    expect((await callback(state)).headers.location).not.toContain('err=');
    expect((await browser.get('/me').expect(200)).body.role).toBe('admin');
    await request(app)
      .post('/login/password')
      .send({ email: owner!.email, password: 'TestPassword!938' })
      .expect(303);
    expect(await User.countDocuments({ team: teamId })).toBe(1);
  });
});
