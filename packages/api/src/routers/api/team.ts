import type {
  RotateApiKeyApiResponse,
  TeamApiResponse,
  TeamInvitationsApiResponse,
  TeamMembersApiResponse,
  TeamTagsApiResponse,
  UpdateClickHouseSettingsApiResponse,
} from '@hyperdx/common-utils/dist/types';
import {
  DeveloperUISchema,
  TeamClickHouseSettingsUpdateSchema,
  UserRoleSchema,
} from '@hyperdx/common-utils/dist/types';
import crypto from 'crypto';
import express from 'express';
import pick from 'lodash/pick';
import { z } from 'zod';
import { processRequest, validateRequest } from 'zod-express-middleware';

import {
  getTags,
  getTeam,
  getTeamInviteUrl,
  rotateTeamApiKey,
  setTeamName,
  updateTeamClickhouseSettings,
} from '@/controllers/team';
import { getTeamAdminIds } from '@/controllers/teamRoles';
import {
  deleteTeamMember,
  findUserByEmail,
  findUsersByTeam,
} from '@/controllers/user';
import { getNonNullUserWithTeam } from '@/middleware/auth';
import { getUserRole, requireAdmin } from '@/middleware/permissions';
import Team from '@/models/team';
import TeamInvite from '@/models/teamInvite';
import User from '@/models/user';
import { getCounter, setBusinessContext } from '@/utils/instrumentation';
import { sendJson } from '@/utils/serialization';
import { objectIdSchema } from '@/utils/zod';

const router = express.Router();
const roleChanges = getCounter('hyperdx.authorization.role_changes', {
  description: 'Successful team member role changes.',
});

type TeamApiExpRes = express.Response<TeamApiResponse>;
router.get('/', async (req, res: TeamApiExpRes, next) => {
  try {
    const teamId = req.user?.team;
    const userId = req.user?._id;

    if (teamId == null) {
      throw new Error(`User ${req.user?._id} not associated with a team`);
    }
    if (userId == null) {
      throw new Error(`User has no id`);
    }

    const fields = [
      '_id',
      'allowedAuthMethods',
      'apiKey',
      'name',
      'createdAt',
      'isMetricsSeriesTableEnabled',
      'developerUI',
    ] as const;
    const team = await getTeam(teamId, fields);
    if (team == null) {
      throw new Error(`Team ${teamId} not found for user ${userId}`);
    }

    if ((await getUserRole(req.user)) !== 'admin') team.apiKey = '';
    sendJson(res, team);
  } catch (e) {
    next(e);
  }
});

router.patch(
  '/developer-ui',
  requireAdmin,
  processRequest({ body: DeveloperUISchema }),
  async (req, res, next) => {
    try {
      const { teamId, userId } = getNonNullUserWithTeam(req);
      setBusinessContext({
        teamId: teamId.toString(),
        userId: userId.toString(),
      });
      const team = await Team.findOneAndUpdate(
        { _id: teamId },
        { $set: { developerUI: req.body } },
        { new: true, runValidators: true },
      );
      if (!team) return res.status(404).json({ message: 'Team not found' });
      getCounter('hyperdx.team.developer_ui_updates', {
        description: 'Successful developer UI configuration updates.',
      }).add(1);
      return res.json(team.developerUI);
    } catch (error) {
      next(error);
    }
  },
);

type RotateApiKeyExpRes = express.Response<RotateApiKeyApiResponse>;
router.patch('/apiKey', async (req, res: RotateApiKeyExpRes, next) => {
  try {
    const teamId = req.user?.team;
    if (teamId == null) {
      throw new Error(`User ${req.user?._id} not associated with a team`);
    }
    const team = await rotateTeamApiKey(teamId);
    if (team?.apiKey == null) {
      throw new Error(`Failed to rotate API key for team ${teamId}`);
    }
    res.json({ newApiKey: team.apiKey });
  } catch (e) {
    next(e);
  }
});

router.patch(
  '/name',
  validateRequest({
    body: z.object({
      name: z.string().min(1).max(100),
    }),
  }),
  async (req, res, next) => {
    try {
      const teamId = req.user?.team;
      if (teamId == null) {
        throw new Error(`User ${req.user?._id} not associated with a team`);
      }
      const { name } = req.body;
      const team = await setTeamName(teamId, name);
      res.json({ name: team?.name });
    } catch (e) {
      next(e);
    }
  },
);

router.patch(
  '/clickhouse-settings',
  processRequest({
    body: TeamClickHouseSettingsUpdateSchema,
  }),
  async (
    req,
    res: express.Response<UpdateClickHouseSettingsApiResponse>,
    next,
  ) => {
    try {
      const teamId = req.user?.team;
      if (teamId == null) {
        throw new Error(`User ${req.user?._id} not associated with a team`);
      }

      if (Object.keys(req.body).length === 0) {
        return res.json({});
      }

      const team = await updateTeamClickhouseSettings(teamId, req.body);

      res.json(pick(team, Object.keys(req.body)));
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  '/invitation',
  validateRequest({
    body: z.object({
      email: z.string().email(),
      name: z.string().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const { email: toEmail, name } = req.body;
      const teamId = req.user?.team;
      const fromEmail = req.user?.email;

      if (teamId == null) {
        throw new Error(`User ${req.user?._id} not associated with a team`);
      }

      if (fromEmail == null) {
        throw new Error(`User ${req.user?._id} doesnt have email`);
      }

      const toUser = await findUserByEmail(toEmail);
      if (toUser) {
        return res.status(400).json({
          message:
            'User already exists. Please contact HyperDX team for support',
        });
      }

      // Normalize email to lowercase for consistency
      const normalizedEmail = toEmail.toLowerCase();

      // Check for existing invitation with normalized email
      let teamInvite = await TeamInvite.findOne({
        teamId,
        email: normalizedEmail,
      });

      if (!teamInvite) {
        teamInvite = await new TeamInvite({
          teamId,
          name,
          email: normalizedEmail,
          token: crypto.randomBytes(32).toString('hex'),
        }).save();
      }

      res.json({
        url: getTeamInviteUrl(teamInvite.token),
      });
    } catch (e) {
      next(e);
    }
  },
);

type TeamInviteExpressRes = express.Response<TeamInvitationsApiResponse>;
router.get(
  '/invitations',
  requireAdmin,
  async (req, res: TeamInviteExpressRes, next) => {
    try {
      const teamId = req.user?.team;
      if (teamId == null) {
        throw new Error(`User ${req.user?._id} not associated with a team`);
      }
      const teamInvites = await TeamInvite.find(
        { teamId },
        {
          createdAt: 1,
          email: 1,
          name: 1,
          token: 1,
        },
      );
      res.json({
        data: teamInvites.map(ti => ({
          _id: ti._id.toString(),
          createdAt: ti.createdAt.toISOString(),
          email: ti.email,
          name: ti.name,
          url: getTeamInviteUrl(ti.token),
        })),
      });
    } catch (e) {
      next(e);
    }
  },
);

router.delete(
  '/invitation/:id',
  validateRequest({
    params: z.object({
      id: objectIdSchema,
    }),
  }),
  async (req, res, next) => {
    try {
      const id = req.params.id;
      // Throws rather than reading `req.user?.team` directly. BSON drops an
      // undefined value from the filter entirely, so a teamless caller would
      // turn the scoped delete below back into the unscoped one this guard
      // exists to prevent — any authenticated user revoking any team's
      // pending invitation given its id.
      const { teamId } = getNonNullUserWithTeam(req);

      const deleted = await TeamInvite.findOneAndDelete({ _id: id, teamId });
      if (deleted == null) {
        return res.sendStatus(404);
      }

      return res.json({ message: 'TeamInvite deleted' });
    } catch (e) {
      next(e);
    }
  },
);

type TeamMembersExpRes = express.Response<TeamMembersApiResponse>;
router.get('/members', async (req, res: TeamMembersExpRes, next) => {
  try {
    const teamId = req.user?.team;
    const userId = req.user?._id;
    if (teamId == null) {
      throw new Error(`User ${req.user?._id} not associated with a team`);
    }
    if (userId == null) {
      throw new Error(`User has no id`);
    }
    const teamUsers = await findUsersByTeam(teamId);
    const admins = await getTeamAdminIds(teamId);
    res.json({
      data: teamUsers.map(user => ({
        ...pick(user.toJSON({ virtuals: true }), [
          '_id',
          'email',
          'name',
          'hasPasswordAuth',
        ]),
        isCurrentUser: user._id.equals(userId),
        role: admins.some(id => id.equals(user._id)) ? 'admin' : 'developer',
      })),
    });
  } catch (e) {
    next(e);
  }
});

router.patch(
  '/member/:id/role',
  requireAdmin,
  validateRequest({
    params: z.object({ id: objectIdSchema }),
    body: z.object({ role: UserRoleSchema }).strict(),
  }),
  async (req, res, next) => {
    try {
      const { teamId, userId } = getNonNullUserWithTeam(req);
      const member = await User.findOne({ _id: req.params.id, team: teamId });
      if (!member) return res.sendStatus(404);
      const { role } = req.body;
      // Authorization and the last-admin check are part of the same atomic
      // document update: two admins cannot concurrently demote each other.
      const updated = await Team.findOneAndUpdate(
        {
          _id: teamId,
          adminUserIds: userId,
          ...(role === 'developer'
            ? {
                $or: [
                  { adminUserIds: { $ne: member._id } },
                  { 'adminUserIds.1': { $exists: true } },
                ],
              }
            : {}),
        },
        role === 'admin'
          ? { $addToSet: { adminUserIds: member._id } }
          : { $pull: { adminUserIds: member._id } },
        { new: true },
      );
      if (!updated)
        return res.status(409).json({
          message:
            'Keep at least one admin. Refresh the team members before trying again.',
        });
      setBusinessContext({
        teamId: teamId.toString(),
        userId: userId.toString(),
        'hyperdx.authorization.target_user_id': member._id.toString(),
        'hyperdx.authorization.new_role': role,
      });
      roleChanges.add(1, { role });
      return res.json({ role });
    } catch (error) {
      next(error);
    }
  },
);

router.delete(
  '/member/:id',
  validateRequest({
    params: z.object({
      id: objectIdSchema,
    }),
  }),
  async (req, res, next) => {
    try {
      const userIdToDelete = req.params.id;
      const teamId = req.user?.team;
      if (teamId == null) {
        throw new Error(`User ${req.user?._id} not associated with a team`);
      }

      const userIdRequestingDelete = req.user?._id;
      if (!userIdRequestingDelete) {
        throw new Error(`Requesting user has no id`);
      }

      const admins = await getTeamAdminIds(teamId);
      if (admins.some(id => id.toString() === userIdToDelete)) {
        return res.status(409).json({
          message: 'Change this member to developer before removing them.',
        });
      }

      await deleteTeamMember(teamId, userIdToDelete, userIdRequestingDelete);

      res.json({ message: 'User deleted' });
    } catch (e) {
      next(e);
    }
  },
);

type TeamTagsExpRes = express.Response<TeamTagsApiResponse>;
router.get('/tags', async (req, res: TeamTagsExpRes, next) => {
  try {
    const teamId = req.user?.team;
    if (teamId == null) {
      throw new Error(`User ${req.user?._id} not associated with a team`);
    }
    const tags = await getTags(teamId);
    return res.json({ data: tags });
  } catch (e) {
    next(e);
  }
});

export default router;
