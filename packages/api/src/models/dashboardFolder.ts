import mongoose, { Schema } from 'mongoose';

import type { ObjectId } from '.';

export interface IDashboardFolder {
  name: string;
  normalizedName: string;
  access: 'admin' | 'team';
  team: ObjectId;
  createdBy: ObjectId;
}

export default mongoose.model<IDashboardFolder>(
  'DashboardFolder',
  new Schema<IDashboardFolder>(
    {
      name: { type: String, required: true },
      normalizedName: { type: String, required: true },
      access: {
        type: String,
        enum: ['admin', 'team'],
        required: true,
        immutable: true,
      },
      team: {
        type: Schema.Types.ObjectId,
        ref: 'Team',
        required: true,
        immutable: true,
      },
      createdBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        immutable: true,
      },
    },
    { timestamps: true, toJSON: { getters: true } },
  ).index({ team: 1, normalizedName: 1 }, { unique: true }),
);
