import { HTTPError } from 'ky';
import {
  type TeamMember,
  UserRoleSchema,
} from '@hyperdx/common-utils/dist/types';
import { Badge, Select } from '@mantine/core';
import { notifications } from '@mantine/notifications';

import api from '@/api';
import { useConfirm } from '@/useConfirm';
import { usePermissions } from '@/usePermissions';

export default function MemberRoleSelect({
  member,
  adminCount,
}: {
  member: TeamMember;
  adminCount: number;
}) {
  const { canManageShared } = usePermissions();
  const mutation = api.useSetTeamMemberRole();
  const confirm = useConfirm();
  const role = member.role ?? 'developer';
  if (!canManageShared) return <Badge>{role}</Badge>;
  return (
    <Select
      aria-label={`Role for ${member.email}`}
      value={role}
      data={[
        { value: 'admin', label: 'Admin' },
        { value: 'developer', label: 'Developer' },
      ]}
      allowDeselect={false}
      disabled={mutation.isPending || (role === 'admin' && adminCount === 1)}
      w={145}
      onChange={async value => {
        const parsed = UserRoleSchema.safeParse(value);
        if (!parsed.success || parsed.data === role) return;
        if (
          !(await confirm(
            `Change ${member.email} to ${parsed.data}? ${
              parsed.data === 'admin'
                ? 'Admins can manage users and all shared configuration.'
                : 'Developers can read all logs but cannot change shared configuration.'
            }`,
            'Change role',
          ))
        )
          return;
        try {
          await mutation.mutateAsync({ userId: member._id, role: parsed.data });
          notifications.show({ message: `Updated role for ${member.email}.` });
        } catch (error) {
          const body =
            error instanceof HTTPError
              ? await error.response.json().catch(() => null)
              : null;
          notifications.show({
            color: 'red',
            message:
              body?.message ??
              'Could not update role. Please refresh and try again.',
          });
        }
      }}
    />
  );
}
