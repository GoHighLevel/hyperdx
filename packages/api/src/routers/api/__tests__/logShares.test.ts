import express from 'express';
import mongoose from 'mongoose';
import request from 'supertest';

import { getSource } from '@/controllers/sources';
import LogShare from '@/models/logShare';
import router from '@/routers/api/logShares';

const teamId = new mongoose.Types.ObjectId();
const userId = new mongoose.Types.ObjectId();
jest.mock('@/middleware/auth', () => ({
  getNonNullUserWithTeam: () => ({ teamId, userId }),
}));
jest.mock('@/config', () => ({ FRONTEND_URL: 'https://logs.example' }));
jest.mock('@/controllers/sources', () => ({ getSource: jest.fn() }));
jest.mock('@/models/logShare', () => ({
  __esModule: true,
  default: { create: jest.fn(), findOne: jest.fn() },
}));
jest.mock('@/models/dashboard', () => ({
  __esModule: true,
  default: { exists: jest.fn() },
}));
const source = '6aa77741acd7321c4deda7ba';
const target = `/search?source=${source}&from=1&to=2&isLive=false&view=developer`;
const app = express().use(express.json()).use(router);

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getSource).mockResolvedValue({ kind: 'log' } as never);
});

it('creates a team-scoped expiring share without storing its token', async () => {
  jest.mocked(LogShare.create).mockResolvedValueOnce({} as never);
  const res = await request(app)
    .post('/')
    .set('Origin', 'https://logs.example')
    .set('X-HyperDX-Share', '1')
    .send({ target });
  expect(res.status).toBe(201);
  expect(res.body.id).toMatch(/^[A-Za-z0-9_-]{24}$/);
  expect(LogShare.create).toHaveBeenCalledWith(
    expect.objectContaining({
      team: teamId,
      source,
      target,
      tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      expiresAt: expect.any(Date),
    }),
  );
  expect(
    JSON.stringify(jest.mocked(LogShare.create).mock.calls[0]),
  ).not.toContain(res.body.id);
});

it('rejects cross-site creation and inaccessible sources', async () => {
  expect(
    (
      await request(app)
        .post('/')
        .set('Origin', 'https://evil.example')
        .set('X-HyperDX-Share', '1')
        .send({ target })
    ).status,
  ).toBe(403);
  jest.mocked(getSource).mockResolvedValue(null);
  expect(
    (
      await request(app)
        .post('/')
        .set('Origin', 'https://logs.example')
        .set('X-HyperDX-Share', '1')
        .send({ target })
    ).status,
  ).toBe(404);
  expect(LogShare.create).not.toHaveBeenCalled();
});

it('resolves only an unexpired share in the authenticated team and rechecks source access', async () => {
  jest.mocked(LogShare.findOne).mockResolvedValueOnce({ target, source });
  const res = await request(app).get('/abcdefghijklmnopqrstuvwx');
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ target });
  expect(LogShare.findOne).toHaveBeenCalledWith(
    expect.objectContaining({
      team: teamId,
      expiresAt: expect.objectContaining({ $gt: expect.any(Date) }),
    }),
  );
  jest.mocked(LogShare.findOne).mockResolvedValueOnce(null);
  expect((await request(app).get('/abcdefghijklmnopqrstuvwx')).status).toBe(
    404,
  );
});

it('rejects an existing share after its source access is revoked', async () => {
  jest.mocked(LogShare.findOne).mockResolvedValueOnce({ target, source });
  jest.mocked(getSource).mockResolvedValueOnce(null);
  const res = await request(app).get('/abcdefghijklmnopqrstuvwx');
  expect(res.status).toBe(404);
  expect(res.body).not.toHaveProperty('target');
});
