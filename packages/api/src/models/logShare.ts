import mongoose, { Schema } from 'mongoose';

type LogShareRecord = {
  team: mongoose.Types.ObjectId;
  createdBy?: mongoose.Types.ObjectId;
  source: string;
  target: string;
  tokenHash: string;
  expiresAt: Date;
};

const schema = new Schema<LogShareRecord>(
  {
    team: { type: Schema.Types.ObjectId, required: true, index: true },
    createdBy: Schema.Types.ObjectId,
    source: { type: String, required: true },
    target: { type: String, required: true, maxlength: 32_000 },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      match: /^[a-f0-9]{64}$/,
    },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model<LogShareRecord>('LogShare', schema);
