import { useState } from 'react';
import {
  canWriteDashboardFolder,
  DashboardFolder,
} from '@hyperdx/common-utils/dist/dashboardFolders';
import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Modal,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import {
  IconFolder,
  IconFolderPlus,
  IconLock,
  IconPencil,
} from '@tabler/icons-react';

import type { Dashboard } from '@/dashboard';
import {
  useDashboardFolders,
  useSaveDashboardFolder,
} from '@/dashboardFolders';
import { usePermissions } from '@/usePermissions';

export default function DashboardFoldersBar({
  selected,
  onSelect,
  dashboards,
}: {
  selected: string | null;
  onSelect: (value: string | null) => void;
  dashboards: Dashboard[];
}) {
  const { data: folders = [], isError, isLoading } = useDashboardFolders();
  const { canManageShared } = usePermissions();
  const save = useSaveDashboardFolder();
  const [editing, setEditing] = useState<DashboardFolder | 'new' | null>(null);
  const [name, setName] = useState('');
  const beginEdit = (folder: DashboardFolder | 'new') => {
    save.reset();
    setName(folder === 'new' ? '' : folder.name);
    setEditing(folder);
  };
  return (
    <Stack gap="sm" mb="lg">
      <Group justify="space-between">
        <Group gap="xs">
          <Button
            variant={selected === null ? 'primary' : 'secondary'}
            onClick={() => onSelect(null)}
          >
            All dashboards
          </Button>
          <Button
            variant={selected === '_general' ? 'primary' : 'secondary'}
            onClick={() => onSelect('_general')}
          >
            General
          </Button>
        </Group>
        <Button
          variant="secondary"
          leftSection={<IconFolderPlus size={16} />}
          onClick={() => beginEdit('new')}
        >
          New folder
        </Button>
      </Group>
      <Text size="xs" c="dimmed">
        Everyone on your team can view these folders. Developer folders are
        editable by all developers and admins.
      </Text>
      {isError && (
        <Text role="alert" c="red">
          Could not load folders. Refresh to try again.
        </Text>
      )}
      {isLoading && (
        <Text size="sm" c="dimmed">
          Loading folders…
        </Text>
      )}
      {(['admin', 'team'] as const).map(access => {
        const items = folders.filter(folder => folder.access === access);
        if (!items.length) return null;
        return (
          <Stack key={access} gap="xs">
            <Text size="sm" fw={500}>
              {access === 'admin' ? 'Admin folders' : 'Developer folders'}
            </Text>
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
              {items.map(folder => (
                <Paper key={folder.id} withBorder p="xs">
                  <Group wrap="nowrap" gap="xs">
                    <Button
                      variant={selected === folder.id ? 'primary' : 'subtle'}
                      leftSection={
                        access === 'admin' ? (
                          <IconLock size={16} />
                        ) : (
                          <IconFolder size={16} />
                        )
                      }
                      onClick={() => onSelect(folder.id)}
                      aria-pressed={selected === folder.id}
                      style={{ flex: 1, minWidth: 0 }}
                      title={folder.name}
                    >
                      <Text truncate size="sm">
                        {folder.name}
                      </Text>
                    </Button>
                    <Badge
                      variant="light"
                      aria-label={`${dashboards.filter(d => d.folderId === folder.id).length} dashboards`}
                    >
                      {dashboards.filter(d => d.folderId === folder.id).length}
                    </Badge>
                    {canWriteDashboardFolder(canManageShared, folder) && (
                      <ActionIcon
                        variant="subtle"
                        aria-label={`Rename ${folder.name}`}
                        onClick={() => beginEdit(folder)}
                      >
                        <IconPencil size={14} />
                      </ActionIcon>
                    )}
                  </Group>
                </Paper>
              ))}
            </SimpleGrid>
          </Stack>
        );
      })}
      {selected === '_general' && (
        <Text size="sm" c="dimmed">
          General dashboards are managed by admins.
        </Text>
      )}
      <Modal
        opened={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'New folder' : 'Rename folder'}
      >
        <form
          onSubmit={event => {
            event.preventDefault();
            if (!editing || !name.trim()) return;
            save.mutate(
              {
                name: name.trim(),
                id: editing === 'new' ? undefined : editing.id,
              },
              {
                onSuccess: folder => {
                  setEditing(null);
                  onSelect(folder.id);
                },
              },
            );
          }}
        >
          <Stack>
            <TextInput
              label="Folder name"
              value={name}
              onChange={e => setName(e.currentTarget.value)}
              maxLength={100}
              required
              data-autofocus
            />
            <Text size="sm" c="dimmed">
              {editing === 'new'
                ? canManageShared
                  ? 'Only admins can edit this folder and its dashboards.'
                  : 'All developers and admins can edit this folder and its dashboards.'
                : 'Renaming does not change who can edit this folder.'}
            </Text>
            {save.isError && (
              <Text role="alert" c="red">
                Could not save folder. Use a unique name and check your
                permissions.
              </Text>
            )}
            <Group justify="flex-end">
              <Button variant="secondary" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={!name.trim()}
                loading={save.isPending}
              >
                Save folder
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}
