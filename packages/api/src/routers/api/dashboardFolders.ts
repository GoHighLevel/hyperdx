import {
  canWriteDashboardFolder,
  DashboardFolderNameSchema,
} from '@hyperdx/common-utils/dist/dashboardFolders';
import express from 'express';
import { z } from 'zod';
import { validateRequest } from 'zod-express-middleware';

import { IS_LOCAL_APP_MODE } from '@/config';
import { getNonNullUserWithTeam } from '@/middleware/auth';
import { getUserRole } from '@/middleware/permissions';
import DashboardFolder from '@/models/dashboardFolder';
import { objectIdSchema } from '@/utils/zod';

const router = express.Router();
const nameBody = z.object({ name: DashboardFolderNameSchema });

function isDuplicateName(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 11000
  );
}

router.get('/', async (req, res, next) => {
  try {
    const { teamId } = getNonNullUserWithTeam(req);
    res.json(
      await DashboardFolder.find({ team: teamId }).sort({ normalizedName: 1 }),
    );
  } catch (error) {
    next(error);
  }
});

router.post(
  '/',
  validateRequest({ body: nameBody }),
  async (req, res, next) => {
    try {
      const { teamId, userId } = getNonNullUserWithTeam(req);
      const { name } = nameBody.parse(req.body);
      const normalizedName = name.toLowerCase();
      if (await DashboardFolder.exists({ team: teamId, normalizedName })) {
        return res
          .status(409)
          .json({ message: 'A folder with this name already exists.' });
      }
      // Access is assigned by the server and cannot be changed by renaming.
      const access =
        IS_LOCAL_APP_MODE || (await getUserRole(req.user)) === 'admin'
          ? 'admin'
          : 'team';
      const folder = await DashboardFolder.create({
        name,
        normalizedName,
        team: teamId,
        createdBy: userId,
        access,
      });
      res.status(201).json(folder);
    } catch (error) {
      if (isDuplicateName(error))
        return res
          .status(409)
          .json({ message: 'A folder with this name already exists.' });
      next(error);
    }
  },
);

router.patch(
  '/:id',
  validateRequest({ params: z.object({ id: objectIdSchema }), body: nameBody }),
  async (req, res, next) => {
    try {
      const { teamId } = getNonNullUserWithTeam(req);
      const folder = await DashboardFolder.findOne({
        _id: req.params.id,
        team: teamId,
      });
      if (!folder) return res.sendStatus(404);
      const isAdmin =
        IS_LOCAL_APP_MODE || (await getUserRole(req.user)) === 'admin';
      if (!canWriteDashboardFolder(isAdmin, folder))
        return res
          .status(403)
          .json({ message: 'Only admins can rename this folder.' });
      const { name } = nameBody.parse(req.body);
      folder.name = name;
      folder.normalizedName = name.toLowerCase();
      res.json(await folder.save());
    } catch (error) {
      if (isDuplicateName(error))
        return res
          .status(409)
          .json({ message: 'A folder with this name already exists.' });
      next(error);
    }
  },
);

export default router;
