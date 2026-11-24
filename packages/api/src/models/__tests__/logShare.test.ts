import mongoose from 'mongoose';

import LogShare from '@/models/logShare';

it('requires team, source, target, hashed token and explicit expiry', () => {
  const invalid = new LogShare();
  expect(Object.keys(invalid.validateSync()?.errors ?? {})).toEqual(
    expect.arrayContaining([
      'team',
      'source',
      'target',
      'tokenHash',
      'expiresAt',
    ]),
  );
  const valid = new LogShare({
    team: new mongoose.Types.ObjectId(),
    source: 'source',
    target: '/search',
    tokenHash: 'a'.repeat(64),
    expiresAt: new Date(100),
  });
  expect(valid.validateSync()).toBeUndefined();
});

it('expires documents and uniquely indexes only the token hash', () => {
  expect(LogShare.schema.indexes()).toEqual(
    expect.arrayContaining([
      [
        expect.objectContaining({ expiresAt: 1 }),
        expect.objectContaining({ expireAfterSeconds: 0 }),
      ],
      [
        expect.objectContaining({ tokenHash: 1 }),
        expect.objectContaining({ unique: true }),
      ],
    ]),
  );
});
