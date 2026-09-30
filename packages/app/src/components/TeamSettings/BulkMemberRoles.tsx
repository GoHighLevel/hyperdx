import { useState } from 'react';
import type { TeamMember, UserRole } from '@hyperdx/common-utils/dist/types';
import {
  Alert,
  Button,
  Checkbox,
  Group,
  MultiSelect,
  Stack,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';

import api from '@/api';
import { useConfirm } from '@/useConfirm';

export default function BulkMemberRoles({
  members,
}: {
  members: TeamMember[];
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string>();
  const mutation = api.useSetTeamMemberRoles();
  const confirm = useConfirm();
  const ids = selected.filter(id => members.some(member => member._id === id));
  const changeRole = async (role: UserRole) => {
    const userIds = [...ids];
    if (
      !userIds.length ||
      !(await confirm(
        `Change ${userIds.length} selected members to ${role}? ${role === 'admin' ? 'Admins can manage users and all shared configuration.' : 'Developers can read all logs but cannot change shared configuration.'}`,
        'Change roles',
      ))
    )
      return;
    setError(undefined);
    try {
      const result = await mutation.mutateAsync({ userIds, role });
      setSelected([]);
      notifications.show({
        message: `Updated ${result.updated} members to ${role}.`,
      });
    } catch {
      setError(
        'Could not change roles. Keep at least one admin and refresh the member list before trying again.',
      );
    }
  };
  return (
    <Stack gap="xs" p="md">
      <MultiSelect
        label="Change roles in bulk"
        description="Select members, then choose their role."
        placeholder="Search by email"
        searchable
        clearable
        maxValues={500}
        data={members.map(member => ({
          value: member._id,
          label: member.email,
        }))}
        value={ids}
        onChange={setSelected}
        disabled={mutation.isPending}
      />
      <Group>
        <Checkbox
          label="Select all members"
          checked={members.length > 0 && ids.length === members.length}
          indeterminate={ids.length > 0 && ids.length < members.length}
          disabled={mutation.isPending || members.length > 500}
          onChange={event =>
            setSelected(
              event.currentTarget.checked
                ? members.map(member => member._id)
                : [],
            )
          }
        />
        <Button
          variant="secondary"
          disabled={!ids.length || mutation.isPending}
          onClick={() => changeRole('developer')}
        >
          Make developer
        </Button>
        <Button
          variant="secondary"
          disabled={!ids.length || mutation.isPending}
          onClick={() => changeRole('admin')}
        >
          Make admin
        </Button>
      </Group>
      {error && <Alert variant="danger">{error}</Alert>}
    </Stack>
  );
}
