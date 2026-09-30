import { canWriteDashboardFolder } from '@hyperdx/common-utils/dist/dashboardFolders';
import { Select, Stack, Text } from '@mantine/core';

import { useDashboardFolders } from '@/dashboardFolders';
import { usePermissions } from '@/usePermissions';

export default function DashboardFolderSelect({
  value,
  onChange,
}: {
  value: string | null | undefined;
  onChange: (value: string | null) => void;
}) {
  const { data: folders, isLoading, isError } = useDashboardFolders();
  const { canManageShared } = usePermissions();
  const writable =
    folders?.filter(folder =>
      canWriteDashboardFolder(canManageShared, folder),
    ) ?? [];
  return (
    <Stack gap={4}>
      <Select
        label="Folder"
        placeholder={
          canManageShared ? 'Choose a folder' : 'Choose a developer folder'
        }
        data={[
          ...(canManageShared
            ? [{ value: '_general', label: 'General (admins only)' }]
            : []),
          ...writable.map(folder => ({
            value: folder.id,
            label: folder.name,
          })),
        ]}
        value={canManageShared && value === null ? '_general' : (value ?? null)}
        onChange={value => onChange(value === '_general' ? null : value)}
        allowDeselect={false}
        searchable
        disabled={isLoading || isError}
        required={!canManageShared}
        error={
          isError
            ? 'Could not load folders. Try reopening this dialog.'
            : undefined
        }
      />
      <Text size="xs" c="dimmed">
        Visible to everyone on your team.
      </Text>
      {!canManageShared && !isLoading && !isError && writable.length === 0 && (
        <Text size="sm">
          Create a developer folder from the dashboards page first.
        </Text>
      )}
    </Stack>
  );
}
