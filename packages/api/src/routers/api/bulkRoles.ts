import { UserRoleSchema } from '@hyperdx/common-utils/dist/types';
import express from 'express';
import { z } from 'zod';
import { validateRequest } from 'zod-express-middleware';

import { getNonNullUserWithTeam } from '@/middleware/auth';
import { requireAdmin } from '@/middleware/permissions';
import Team from '@/models/team';
import User from '@/models/user';
import { getCounter, setBusinessContext } from '@/utils/instrumentation';
import { objectIdSchema } from '@/utils/zod';

const router = express.Router();
const roleChanges = getCounter('hyperdx.authorization.role_changes', {
  description: 'Successful team member role changes.',
});

router.patch(
  '/members/role',
  requireAdmin,
  validateRequest({
    body: z
      .object({
        userIds: z.array(objectIdSchema).min(1).max(500),
        role: UserRoleSchema,
      })
      .strict(),
  }),
  async (req, res, next) => {
    try {
      const { teamId, userId } = getNonNullUserWithTeam(req);
      const { role } = req.body;
      const userIds = [
        ...new Set(req.body.userIds.map(id => id.toLowerCase())),
      ];
      const members = await User.find({
        _id: { $in: userIds },
        team: teamId,
      }).select('_id');
      if (members.length !== userIds.length)
        return res.status(404).json({
          message:
            'One or more selected members no longer belong to this team. Refresh and try again.',
        });
      const ids = members.map(member => member._id);
      // Check the actor and remaining admins in the same document update.
      const updated = await Team.findOneAndUpdate(
        {
          _id: teamId,
          adminUserIds: userId,
          ...(role === 'developer'
            ? {
                $expr: {
                  $gt: [
                    { $size: { $setDifference: ['$adminUserIds', ids] } },
                    0,
                  ],
                },
              }
            : {}),
        },
        role === 'admin'
          ? { $addToSet: { adminUserIds: { $each: ids } } }
          : { $pull: { adminUserIds: { $in: ids } } },
        { new: true },
      );
      if (!updated)
        return res.status(409).json({
          message:
            'Keep at least one admin. Refresh the team members before trying again.',
        });
      setBusinessContext({
        teamId: String(teamId),
        userId: String(userId),
        'hyperdx.authorization.target_user_ids': userIds,
        'hyperdx.authorization.new_role': role,
      });
      roleChanges.add(ids.length, { role });
      return res.json({ role, updated: ids.length });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
