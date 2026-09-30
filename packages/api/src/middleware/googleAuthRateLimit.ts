import type { RequestHandler } from 'express';
import mongoose, { Schema } from 'mongoose';

import { hashJoinToken } from '@/utils/googleWorkspace';

const windowMs = 15 * 60 * 1000;
const schema = new Schema({
  _id: String,
  count: { type: Number, required: true },
  expiresAt: { type: Date, required: true, expires: 0 },
});
const Bucket = mongoose.model('GoogleAuthRateLimit', schema);

// A shared Mongo counter keeps the limit consistent across app replicas.
export const googleAuthRateLimit: RequestHandler = async (req, res, next) => {
  try {
    const window = Math.floor(Date.now() / windowMs);
    const bucket = await Bucket.findOneAndUpdate(
      { _id: `${hashJoinToken(req.ip || 'unknown')}:${window}` },
      {
        $inc: { count: 1 },
        $setOnInsert: { expiresAt: new Date((window + 1) * windowMs) },
      },
      { upsert: true, new: true },
    );
    if (bucket && bucket.count > 60)
      return res
        .status(429)
        .send('Too many sign-in attempts. Please try again later.');
    next();
  } catch (error) {
    next(error);
  }
};
