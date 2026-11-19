import { useState } from 'react';
import Router from 'next/router';
import { Button, Group, Modal, Stack, Text, TextInput } from '@mantine/core';

import { type Dashboard, useCreateDashboard } from '@/dashboard';
import { usePermissions } from '@/usePermissions';

import DashboardFolderSelect from './DashboardFolderSelect';

export default function DashboardCreateDialog({
  onClose,
  initialFolderId,
  initialDashboard,
}: {
  onClose: () => void;
  initialFolderId: string | null;
  initialDashboard?: Dashboard;
}) {
  const [name, setName] = useState(initialDashboard?.name ?? 'My dashboard');
  const [folderId, setFolderId] = useState(initialFolderId);
  const create = useCreateDashboard();
  const { canManageShared } = usePermissions();
  return (
    <Modal opened onClose={onClose} title="New dashboard">
      <form
        onSubmit={event => {
          event.preventDefault();
          if (!name.trim() || (!canManageShared && !folderId)) return;
          create.mutate(
            {
              tiles: [],
              tags: [],
              ...initialDashboard,
              name: name.trim(),
              folderId,
            },
            {
              onSuccess: dashboard => {
                onClose();
                void Router.push(`/dashboards/${dashboard.id}`);
              },
            },
          );
        }}
      >
        <Stack>
          <TextInput
            label="Name"
            value={name}
            onChange={e => setName(e.currentTarget.value)}
            required
            data-autofocus
          />
          <DashboardFolderSelect value={folderId} onChange={setFolderId} />
          {create.isError && (
            <Text c="red" role="alert">
              Could not create dashboard. Check the folder and try again.
            </Text>
          )}
          <Group justify="flex-end">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={create.isPending}
              disabled={!name.trim() || (!canManageShared && !folderId)}
            >
              Create dashboard
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
