import express from 'express';
import { Types } from 'mongoose';
import request from 'supertest';

import { getTeamAdminIds } from '@/controllers/teamRoles';
import {
  getUserRole,
  requireAdmin,
  requireAdminForWrites,
} from '@/middleware/permissions';

jest.mock('@/config', () => ({
  HYPERDX_ADMIN_EMAILS: ['sre@example.com'],
  IS_LOCAL_APP_MODE: false,
}));
jest.mock('@/controllers/teamRoles');
const adminId = new Types.ObjectId();
const developerId = new Types.ObjectId();
const teamId = new Types.ObjectId();
beforeEach(() => jest.mocked(getTeamAdminIds).mockResolvedValue([adminId]));

describe('shared configuration permissions', () => {
  it('uses MongoDB membership and defaults missing identities to developer', async () => {
    expect(await getUserRole(undefined)).toBe('developer');
    expect(await getUserRole({ _id: developerId, team: teamId })).toBe(
      'developer',
    );
    expect(await getUserRole({ _id: adminId, team: teamId })).toBe('admin');
  });

  const app = express();
  app.use((req, _res, next) => {
    Object.assign(req, {
      user: {
        email: req.get('test-user'),
        team: teamId,
        _id: req.get('test-user') === 'sre@example.com' ? adminId : developerId,
      },
    });
    next();
  });
  app.use('/shared', requireAdminForWrites, (_req, res) => res.sendStatus(200));
  app.use('/admin', requireAdmin, (_req, res) => res.sendStatus(200));

  it.each(['post', 'put', 'patch', 'delete'] as const)(
    'rejects developer %s requests even when they bypass the UI',
    async method => {
      await request(app)
        [method]('/shared')
        .set('test-user', 'dev@example.com')
        .expect(403);
      await request(app)
        [method]('/shared')
        .set('test-user', 'sre@example.com')
        .expect(200);
    },
  );

  it('allows reads but protects administrative secrets', async () => {
    await request(app)
      .get('/shared')
      .set('test-user', 'dev@example.com')
      .expect(200);
    await request(app)
      .get('/admin')
      .set('test-user', 'dev@example.com')
      .expect(403);
    await request(app)
      .get('/admin')
      .set('test-user', 'sre@example.com')
      .expect(200);
    await request(app).post('/shared').expect(401);
  });
});
