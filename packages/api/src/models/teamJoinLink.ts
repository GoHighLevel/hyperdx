import mongoose, { Schema } from 'mongoose';

const schema = new Schema(
  {
    teamId: {
      type: Schema.Types.ObjectId,
      ref: 'Team',
      required: true,
      unique: true,
    },
    tokenHash: { type: String, required: true, unique: true },
  },
  { timestamps: true },
);

export default mongoose.model('TeamJoinLink', schema);
