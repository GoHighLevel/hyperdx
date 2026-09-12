import type { PinnedFiltersValue } from '@hyperdx/common-utils/dist/types';
import mongoose, { Schema } from 'mongoose';

import type { ObjectId } from '.';

interface IPersonalPinnedFilter {
  team: ObjectId;
  user: ObjectId;
  source: ObjectId;
  fields: string[];
  filters: PinnedFiltersValue;
}

// Separate from team pins so upgrading does not change their unique index.
const schema = new Schema<IPersonalPinnedFilter>(
  {
    team: { type: Schema.Types.ObjectId, ref: 'Team', required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    source: { type: Schema.Types.ObjectId, ref: 'Source', required: true },
    fields: { type: [String], default: [] },
    filters: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

schema.index({ team: 1, user: 1, source: 1 }, { unique: true });

export default mongoose.model<IPersonalPinnedFilter>(
  'PersonalPinnedFilter',
  schema,
);
