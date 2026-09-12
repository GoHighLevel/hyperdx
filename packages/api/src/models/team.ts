import { type Team } from '@hyperdx/common-utils/dist/types';
import mongoose, { Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

type ObjectId = mongoose.Types.ObjectId;

export interface ITeam extends Team {
  _id: ObjectId;
  createdAt: Date;
  updatedAt: Date;
  adminUserIds?: ObjectId[];
  setupKey?: string;
}

export type TeamDocument = mongoose.HydratedDocument<ITeam>;

export default mongoose.model<ITeam>(
  'Team',
  new Schema<ITeam>(
    {
      name: String,
      // Keep membership in one document so demotions can atomically preserve
      // at least one admin, including on standalone MongoDB installations.
      adminUserIds: { type: [Schema.Types.ObjectId], default: undefined },
      setupKey: { type: String, unique: true, sparse: true },
      allowedAuthMethods: [String],
      hookId: {
        type: String,
        default: function genUUID() {
          return uuidv4();
        },
      },
      apiKey: {
        type: String,
        default: function genUUID() {
          return uuidv4();
        },
      },
      collectorAuthenticationEnforced: {
        type: Boolean,
        default: false,
      },
      isMetricsSeriesTableEnabled: {
        type: Boolean,
        default: false,
      },
      // TODO: maybe add these to a top level Mixed type
      // CH Client Settings
      metadataMaxRowsToRead: Number,
      searchRowLimit: Number,
      queryTimeout: Number,
      fieldMetadataDisabled: Boolean,
      parallelizeWhenPossible: Boolean,
      filterKeysFetchLimit: Number,
    },
    {
      timestamps: true,
      toJSON: { virtuals: true },
      toObject: { virtuals: true },
    },
  ),
);
