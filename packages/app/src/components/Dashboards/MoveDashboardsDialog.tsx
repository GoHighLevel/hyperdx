import { useState } from 'react';
import { Button, Group, Modal, Stack, Text, TextInput } from '@mantine/core';

import { Dashboard, useUpdateDashboard } from '@/dashboard';
import { useSaveDashboardFolder } from '@/dashboardFolders';
import { usePermissions } from '@/usePermissions';

import DashboardFolderSelect from './DashboardFolderSelect';

export default function MoveDashboardsDialog({
  dashboards,
  onClose,
  onMoved,
}: {
  dashboards: Dashboard[];
  onClose: () => void;
  onMoved?: (ids: string[], folderId: string | null) => void;
}) {
  const { canManageShared } = usePermissions();
  const update = useUpdateDashboard();
  const createFolder = useSaveDashboardFolder();
  const [folderId, setFolderId] = useState<string | null>();
  const [remaining, setRemaining] = useState(dashboards);
  const [moving, setMoving] = useState(false);
  const [completed, setCompleted] = useState(0);
  const [failed, setFailed] = useState<Dashboard[]>([]);
  const [creating, setCreating] = useState(false);
  const [folderName, setFolderName] = useState('');
  const busy = moving || createFolder.isPending;

  const move = async () => {
    if (busy || folderId === undefined || (!canManageShared && !folderId))
      return;
    setMoving(true);
    setFailed([]);
    setCompleted(0);
    const moved: string[] = [];
    const failures: Dashboard[] = [];
    // Sequential requests bound load and allow precise partial-failure reporting.
    // PATCH changes only the folder; dashboards and their links keep their IDs.
    for (const dashboard of remaining) {
      try {
        await update.mutateAsync({ id: dashboard.id, folderId });
        moved.push(dashboard.id);
      } catch {
        failures.push(dashboard);
      }
      setCompleted(count => count + 1);
    }
    setMoving(false);
    setFailed(failures);
    setRemaining(failures);
    if (moved.length) onMoved?.(moved, folderId);
    if (!failures.length) onClose();
  };

  return (
    <Modal
      opened
      title={
        dashboards.length === 1
          ? 'Move dashboard'
          : `Move ${dashboards.length} dashboards`
      }
      onClose={() => {
        if (!busy) onClose();
      }}
      withCloseButton={!busy}
      closeOnClickOutside={!busy}
      closeOnEscape={!busy}
    >
      <Stack>
        <Text size="sm">
          {dashboards.length === 1
            ? dashboards[0].name
            : `${dashboards.length} selected dashboards`}
        </Text>
        <Text size="xs" c="dimmed">
          Dashboard links and contents stay unchanged.
        </Text>
        <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0 }}>
          <DashboardFolderSelect value={folderId} onChange={setFolderId} />
        </fieldset>
        {creating ? (
          <Stack gap="xs">
            <TextInput
              label="New folder name"
              value={folderName}
              maxLength={100}
              disabled={busy}
              onChange={e => setFolderName(e.currentTarget.value)}
              data-autofocus
            />
            <Text size="xs" c="dimmed">
              {canManageShared
                ? 'This folder will be editable by admins only.'
                : 'All developers and admins can edit this folder.'}
            </Text>
            {createFolder.isError && (
              <Text role="alert" c="red" size="sm">
                Could not create folder. Use a unique name and try again.
              </Text>
            )}
            <Group>
              <Button
                variant="secondary"
                size="xs"
                disabled={busy || !folderName.trim()}
                onClick={() =>
                  createFolder.mutate(
                    { name: folderName.trim() },
                    {
                      onSuccess: folder => {
                        setFolderId(folder.id);
                        setCreating(false);
                        setFolderName('');
                      },
                    },
                  )
                }
              >
                Create folder
              </Button>
              <Button
                variant="subtle"
                size="xs"
                disabled={busy}
                onClick={() => setCreating(false)}
              >
                Cancel new folder
              </Button>
            </Group>
          </Stack>
        ) : (
          <Button
            variant="subtle"
            size="xs"
            disabled={busy}
            onClick={() => {
              createFolder.reset();
              setCreating(true);
            }}
          >
            New folder
          </Button>
        )}
        {moving && (
          <Text role="status" size="sm">
            Moving dashboards: {completed} of {remaining.length} processed…
          </Text>
        )}
        {failed.length > 0 && (
          <Text role="alert" c="red" size="sm">
            {dashboards.length - failed.length} moved. Could not move{' '}
            {failed.map(d => d.name).join(', ')}. Check permissions and retry;
            only failed dashboards will be retried.
          </Text>
        )}
        <Group justify="flex-end">
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={moving}
            disabled={
              busy ||
              creating ||
              folderId === undefined ||
              (!canManageShared && !folderId)
            }
            onClick={() => void move()}
          >
            {failed.length
              ? 'Retry failed moves'
              : remaining.length === 1
                ? 'Move dashboard'
                : `Move ${remaining.length} dashboards`}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
