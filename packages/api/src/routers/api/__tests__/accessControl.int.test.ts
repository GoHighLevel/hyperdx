import http from 'http';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';

import app from '@/api-app';
import { MONGO_URI } from '@/config';
import { getTeamAdminIds } from '@/controllers/teamRoles';
import Connection from '@/models/connection';
import PersonalPinnedFilter from '@/models/personalPinnedFilter';
import { Source } from '@/models/source';
import Team from '@/models/team';
import User from '@/models/user';

jest.mock('@/config', () => ({
  ...jest.requireActual('@/config'),
  HYPERDX_ADMIN_EMAILS: ['admin@example.com'],
}));
jest.unmock('http-proxy-middleware');

describe('access control and personal filters over authenticated HTTP', () => {
  const admin = request.agent(app);
  const alice = request.agent(app);
  const bob = request.agent(app);
  const password = 'TestPassword!938';
  let source: string;
  let team: string;
  let aliceKey: string;

  beforeAll(async () => {
    // Only run against an explicitly named, isolated test database.
    if (
      !MONGO_URI ||
      !/^\/hyperdx(?:_rbac_test|-test)$/.test(new URL(MONGO_URI).pathname)
    )
      throw new Error('Use hyperdx_rbac_test database');
    await mongoose.connect(MONGO_URI);
    await Promise.all([Team.init(), User.init(), PersonalPinnedFilter.init()]);
    await mongoose.connection.dropDatabase();
    await Promise.all([
      Team.createIndexes(),
      User.createIndexes(),
      PersonalPinnedFilter.createIndexes(),
    ]);
    await admin
      .post('/register/password')
      .send({ email: 'admin@example.com', password, confirmPassword: password })
      .expect(200);
    const me = await admin.get('/me').expect(200);
    team = me.body.team.id;
    source = (
      await Source.create({
        team,
        kind: 'log',
        name: 'Logs',
        connection: new Types.ObjectId().toString(),
        from: { databaseName: 'default', tableName: 'logs' },
        timestampValueExpression: 'timestamp',
        defaultTableSelectExpression: 'body',
      })
    ).id;
    for (const [agent, email] of [
      [alice, 'alice@example.com'],
      [bob, 'bob@example.com'],
    ] as const) {
      const invite = await admin
        .post('/team/invitation')
        .send({ email })
        .expect(200);
      const token = new URL(
        invite.body.url,
        'http://localhost',
      ).searchParams.get('token');
      await agent.post(`/team/setup/${token}`).send({ password }).expect(303);
    }
    aliceKey = (await alice.get('/me').expect(200)).body.accessKey;
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  it('reports roles and withholds the ingestion key from developers', async () => {
    expect((await admin.get('/me')).body.role).toBe('admin');
    const me = (await alice.get('/me')).body;
    expect(me.role).toBe('developer');
    expect(me.team.apiKey).toBe('');
    expect((await alice.get('/team')).body.apiKey).toBe('');
    await alice.get('/team/invitations').expect(403);
    await alice.get('/sources').expect(200);
    await alice.get('/dashboards').expect(200);
  });

  it.each([
    '/sources',
    '/connections',
    '/dashboards',
    '/saved-search',
    '/alerts',
    '/webhooks',
    '/team/invitation',
  ])('blocks developer writes to %s', async path => {
    await alice.post(path).send({}).expect(403);
  });

  it('enforces the same permissions for API keys', async () => {
    await request(app)
      .post('/api/v2/dashboards')
      .set('Authorization', `Bearer ${aliceKey}`)
      .send({})
      .expect(403);
    await request(app)
      .get('/api/v2/sources')
      .set('Authorization', `Bearer ${aliceKey}`)
      .expect(200);
    await alice.patch('/me/accessKey').expect(200);
  });

  it('overrides developer attempts to disable ClickHouse read-only mode', async () => {
    let forwardedUrl = '';
    const upstream = http.createServer((req, res) => {
      forwardedUrl = req.url ?? '';
      req.resume();
      req.on('end', () => res.end('{}'));
    });
    await new Promise<void>(resolve =>
      upstream.listen(0, '127.0.0.1', resolve),
    );
    try {
      const address = upstream.address();
      if (!address || typeof address === 'string')
        throw new Error('Missing upstream address');
      const connection = await Connection.create({
        team,
        name: 'Test',
        host: `http://127.0.0.1:${address.port}`,
        username: 'default',
        password: '',
      });
      await alice
        .post('/clickhouse-proxy?readonly=0&readonly=0')
        .set('x-hyperdx-connection-id', connection.id)
        .set('Content-Type', 'text/plain')
        .send('SELECT 1')
        .expect(200);
      expect(
        new URL(forwardedUrl, 'http://localhost').searchParams.getAll(
          'readonly',
        ),
      ).toEqual(['2']);
    } finally {
      await new Promise<void>((resolve, reject) =>
        upstream.close(error => (error ? reject(error) : resolve())),
      );
    }
  });

  it('lets admins change shared pins, while developers can only read them', async () => {
    const shared = { source, fields: ['log_level'], filters: {} };
    await admin.put('/pinned-filters').send(shared).expect(200);
    await alice.put('/pinned-filters').send(shared).expect(403);
    expect(
      (await alice.get(`/pinned-filters?source=${source}`)).body.team.fields,
    ).toEqual(['log_level']);
  });

  it('persists private preferences across sessions without changing another user or shared pins', async () => {
    await alice
      .put('/personal-pinned-filters')
      .send({ source, fields: ['label_team'], filters: {} })
      .expect(200);
    expect(
      (await bob.get(`/personal-pinned-filters?source=${source}`)).body.fields,
    ).toEqual([]);
    const anotherSession = request.agent(app);
    await anotherSession
      .post('/login/password')
      .send({ email: 'alice@example.com', password })
      .expect(303);
    expect(
      (await anotherSession.get(`/personal-pinned-filters?source=${source}`))
        .body.fields,
    ).toEqual(['label_team']);
    expect(
      (await alice.get(`/pinned-filters?source=${source}`)).body.team.fields,
    ).toEqual(['log_level']);
  });

  it('rejects ownership injection and foreign sources', async () => {
    await alice
      .put('/personal-pinned-filters')
      .send({
        source,
        fields: [],
        filters: {},
        user: new Types.ObjectId().toString(),
      })
      .expect(400);
    const foreign = await Source.create({
      team: new Types.ObjectId(),
      name: 'Foreign',
      kind: 'log',
      connection: new Types.ObjectId().toString(),
    });
    await alice
      .get(`/personal-pinned-filters?source=${foreign.id}`)
      .expect(404);
    await alice
      .put('/personal-pinned-filters')
      .send({ source: foreign.id, fields: [], filters: {} })
      .expect(404);
    await request(app)
      .get(`/personal-pinned-filters?source=${source}`)
      .expect(401);
  });

  it('persists roles, revokes existing sessions and keys, and protects the last admin', async () => {
    const adminId = (await admin.get('/me')).body.id;
    const aliceId = (await alice.get('/me')).body.id;
    const currentAliceKey = (await alice.get('/me')).body.accessKey;
    await alice
      .patch(`/team/member/${aliceId}/role`)
      .send({ role: 'admin' })
      .expect(403);
    await admin
      .patch(`/team/member/${new Types.ObjectId()}/role`)
      .send({ role: 'admin' })
      .expect(404);
    await admin
      .patch(`/team/member/${aliceId}/role`)
      .send({ role: 'owner' })
      .expect(400);
    await admin
      .patch(`/team/member/${adminId}/role`)
      .send({ role: 'developer' })
      .expect(409);
    await admin.delete(`/team/member/${adminId}`).expect(409);
    await admin
      .patch(`/team/member/${aliceId}/role`)
      .send({ role: 'admin' })
      .expect(200);
    expect((await alice.get('/me')).body.role).toBe('admin');
    expect(
      (await admin.get('/team/members')).body.data.find(
        (member: { _id: string }) => member._id === aliceId,
      ).role,
    ).toBe('admin');
    await admin
      .patch(`/team/member/${aliceId}/role`)
      .send({ role: 'developer' })
      .expect(200);
    expect((await alice.get('/me')).body.role).toBe('developer');
    await alice
      .post('/team/invitation')
      .send({ email: 'no@example.com' })
      .expect(403);
    await request(app)
      .post('/api/v2/dashboards')
      .set('Authorization', `Bearer ${currentAliceKey}`)
      .send({})
      .expect(403);
  });

  it('keeps an admin when two admins concurrently demote one another', async () => {
    const adminId = (await admin.get('/me')).body.id;
    const aliceId = (await alice.get('/me')).body.id;
    await admin
      .patch(`/team/member/${aliceId}/role`)
      .send({ role: 'admin' })
      .expect(200);
    const results = await Promise.all([
      admin.patch(`/team/member/${aliceId}/role`).send({ role: 'developer' }),
      alice.patch(`/team/member/${adminId}/role`).send({ role: 'developer' }),
    ]);
    expect(results.filter(response => response.status === 200)).toHaveLength(1);
    expect((await getTeamAdminIds(new Types.ObjectId(team))).length).toBe(1);
    await Team.updateOne(
      { _id: team },
      { $set: { adminUserIds: [new Types.ObjectId(adminId)] } },
    );
  });

  it('imports legacy admins once without undoing subsequent database changes', async () => {
    const adminId = (await admin.get('/me')).body.id;
    await Team.updateOne({ _id: team }, { $unset: { adminUserIds: '' } });
    expect(
      (await getTeamAdminIds(new Types.ObjectId(team))).map(String),
    ).toContain(adminId);
    const bobId = (await bob.get('/me')).body.id;
    await Team.updateOne(
      { _id: team },
      { $set: { adminUserIds: [new Types.ObjectId(bobId)] } },
    );
    expect(
      (await getTeamAdminIds(new Types.ObjectId(team))).map(String),
    ).toEqual([bobId]);
    await Team.updateOne(
      { _id: team },
      { $set: { adminUserIds: [new Types.ObjectId(adminId)] } },
    );
  });

  it('atomically creates only one first admin during concurrent initial setup', async () => {
    await User.deleteMany({});
    await Team.deleteMany({});
    const registrations = await Promise.all(
      ['first@example.com', 'second@example.com'].map(email =>
        request
          .agent(app)
          .post('/register/password')
          .send({ email, password, confirmPassword: password }),
      ),
    );
    expect(registrations.map(response => response.status).sort()).toEqual([
      200, 409,
    ]);
    expect(await Team.countDocuments()).toBe(1);
    expect(await User.countDocuments()).toBe(1);
    const firstTeam = await Team.findOne().orFail();
    expect(firstTeam.adminUserIds).toHaveLength(1);
    expect(
      await User.exists({
        _id: firstTeam.adminUserIds![0],
        team: firstTeam._id,
      }),
    ).toBeTruthy();
  });
});
