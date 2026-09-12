import { PinnedFiltersValueSchema } from '@hyperdx/common-utils/dist/types';
import express from 'express';
import { z } from 'zod';
import { processRequest } from 'zod-express-middleware';

import { getSource } from '@/controllers/sources';
import { getNonNullUserWithTeam } from '@/middleware/auth';
import PersonalPinnedFilter from '@/models/personalPinnedFilter';
import { objectIdSchema } from '@/utils/zod';

const router = express.Router();
const sourceSchema = z.object({ source: objectIdSchema });
const bodySchema = sourceSchema
  .extend({
    fields: z.array(z.string().min(1).max(1024)).max(100),
    filters: PinnedFiltersValueSchema,
  })
  .strict();

router.get(
  '/',
  processRequest({ query: sourceSchema }),
  async (req, res, next) => {
    try {
      const { teamId, userId } = getNonNullUserWithTeam(req);
      const { source } = req.query;
      if (!(await getSource(teamId.toString(), source)))
        return res.sendStatus(404);
      const doc = await PersonalPinnedFilter.findOne({
        team: teamId,
        user: userId,
        source,
      });
      return res.json({
        fields: doc?.fields ?? [],
        filters: doc?.filters ?? {},
      });
    } catch (error) {
      next(error);
    }
  },
);

router.put(
  '/',
  processRequest({ body: bodySchema }),
  async (req, res, next) => {
    try {
      const { teamId, userId } = getNonNullUserWithTeam(req);
      const { source, fields, filters } = req.body;
      if (!(await getSource(teamId.toString(), source)))
        return res.sendStatus(404);
      await PersonalPinnedFilter.findOneAndUpdate(
        { team: teamId, user: userId, source },
        { $set: { fields: [...new Set(fields)], filters } },
        { upsert: true, new: true, runValidators: true },
      );
      return res.json({ fields, filters });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
