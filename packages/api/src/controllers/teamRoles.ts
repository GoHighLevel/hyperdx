import { HYPERDX_ADMIN_EMAILS } from '@/config';
import type { ObjectId } from '@/models';
import Team from '@/models/team';
import User from '@/models/user';

/** Import the legacy allowlist once; later role changes are owned by MongoDB. */
export async function getTeamAdminIds(teamId: ObjectId): Promise<ObjectId[]> {
  let team = await Team.findById(teamId).select('adminUserIds');
  if (!team) return [];
  if (team.adminUserIds == null) {
    const users = await User.find({
      team: teamId,
      email: { $in: HYPERDX_ADMIN_EMAILS },
    }).select('_id');
    await Team.updateOne(
      { _id: teamId, adminUserIds: { $exists: false } },
      { $set: { adminUserIds: users.map(user => user._id) } },
    );
    team = await Team.findById(teamId).select('adminUserIds');
  }
  return team?.adminUserIds ?? [];
}
