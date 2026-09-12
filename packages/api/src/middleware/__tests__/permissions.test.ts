import express from 'express';
import request from 'supertest';

import {
  getUserRole,
  requireAdmin,
  requireAdminForWrites,
} from '@/middleware/permissions';

jest.mock('@/config', () => ({
  HYPERDX_ADMIN_EMAILS: ['sre@example.com'],
  IS_LOCAL_APP_MODE: false,
}));

describe('shared configuration permissions', () => {
  it('defaults missing and unlisted identities to developer', () => {
    expect(getUserRole(undefined)).toBe('developer');
    expect(getUserRole({ email: 'dev@example.com' })).toBe('developer');
    expect(getUserRole({ email: 'SRE@example.com' })).toBe('admin');
  });

  const app = express();
  app.use((req, _res, next) => {
    Object.assign(req, { user: { email: req.get('test-user') } });
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
