import mongoose, { Types } from 'mongoose';
import request from 'supertest';

import app from '@/api-app';
import { MONGO_URI } from '@/config';
import Team from '@/models/team';
import User from '@/models/user';

describe('bulk team roles', () => {
  let teamId: Types.ObjectId;
  let adminId: Types.ObjectId;
  let memberIds: Types.ObjectId[];
  let admin: ReturnType<typeof request.agent>;
  let developer: ReturnType<typeof request.agent>;
  const patch = (agent = admin) => agent.patch('/team/members/role');

  beforeAll(async () => {
    if (
      !MONGO_URI ||
      new URL(MONGO_URI).pathname !== '/hyperdx_membership_test'
    )
      throw new Error('Use isolated hyperdx_membership_test database');
    await mongoose.connect(MONGO_URI);
  });

  beforeEach(async () => {
    teamId = new Types.ObjectId();
    const owner = await User.create({
      email: `${teamId}-admin@example.com`,
      team: teamId,
    });
    const members = await User.create([
      { email: `${teamId}-alice@example.com`, team: teamId },
      { email: `${teamId}-bob@example.com`, team: teamId },
    ]);
    adminId = owner._id;
    admin = request.agent(app);
    developer = request.agent(app);
    for (const [user, agent] of [
      [owner, admin],
      [members[0], developer],
    ] as const) {
      // The plugin methods are not represented by this fork's Mongoose types.
      await (user as any).setPassword('TestPassword!938');
      await user.save();
      await agent
        .post('/login/password')
        .send({ email: user.email, password: 'TestPassword!938' })
        .expect(303);
    }
    memberIds = members.map(member => member._id);
    await Team.create({
      _id: teamId,
      name: 'Bulk role test',
      adminUserIds: [adminId],
    });
  });

  afterEach(async () => {
    await User.deleteMany({ team: teamId });
    await Team.deleteOne({ _id: teamId });
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  it('promotes and demotes the selected members together', async () => {
    await patch().send({ userIds: memberIds, role: 'admin' }).expect(200);
    expect((await Team.findById(teamId))?.adminUserIds).toHaveLength(3);
    await patch().send({ userIds: memberIds, role: 'developer' }).expect(200);
    expect((await Team.findById(teamId))?.adminUserIds?.map(String)).toEqual([
      String(adminId),
    ]);
  });

  it('rejects developer writes and invalid role/input', async () => {
    await patch(developer)
      .send({ userIds: memberIds, role: 'admin' })
      .expect(403);
    await patch().send({ userIds: [], role: 'admin' }).expect(400);
    await patch().send({ userIds: memberIds, role: 'owner' }).expect(400);
    await patch()
      .send({ userIds: memberIds, role: 'admin', teamId })
      .expect(400);
  });

  it('rejects the entire batch if any target is not a team member', async () => {
    await patch()
      .send({ userIds: [...memberIds, new Types.ObjectId()], role: 'admin' })
      .expect(404);
    expect((await Team.findById(teamId))?.adminUserIds).toHaveLength(1);
  });

  it('deduplicates selections and cannot demote every admin', async () => {
    await patch()
      .send({ userIds: [...memberIds, ...memberIds], role: 'admin' })
      .expect(200);
    await patch()
      .send({ userIds: [adminId, ...memberIds], role: 'developer' })
      .expect(409);
    expect((await Team.findById(teamId))?.adminUserIds).toHaveLength(3);
  });

  it('keeps an admin during competing bulk demotions', async () => {
    await patch().send({ userIds: memberIds, role: 'admin' }).expect(200);
    const results = await Promise.all([
      patch().send({ userIds: memberIds, role: 'developer' }),
      patch(developer).send({
        userIds: [adminId, memberIds[1]],
        role: 'developer',
      }),
    ]);
    expect(results.some(result => result.status === 200)).toBe(true);
    expect((await Team.findById(teamId))?.adminUserIds?.length).toBeGreaterThan(
      0,
    );
  });
});
