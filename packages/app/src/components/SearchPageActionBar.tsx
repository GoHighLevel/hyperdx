import { ActionIcon, Menu } from '@mantine/core';
import {
  IconCopy,
  IconDotsVertical,
  IconDownload,
  IconTrash,
} from '@tabler/icons-react';

import { usePermissions } from '@/usePermissions';

export default function SearchPageActionBar({
  onClickDeleteSavedSearch,
  onClickSaveAsNew,
  onExport,
  isDashboard = false,
  canEdit,
}: {
  onClickDeleteSavedSearch: () => void;
  onClickSaveAsNew: () => void;
  onExport?: () => void;
  isDashboard?: boolean;
  canEdit?: boolean;
}) {
  const { canManageShared } = usePermissions();
  if (!(canEdit ?? canManageShared)) return null;
  return (
    <Menu width={250}>
      <Menu.Target>
        <ActionIcon
          data-testid="search-page-action-bar"
          variant="secondary"
          style={{ flexShrink: 0 }}
          size="input-xs"
        >
          <IconDotsVertical size={14} />
        </ActionIcon>
      </Menu.Target>

      <Menu.Dropdown>
        {onExport && (
          <Menu.Item
            leftSection={<IconDownload size={16} />}
            onClick={onExport}
            data-testid="export-search-dashboard"
          >
            {isDashboard ? 'Export dashboard' : 'Export as dashboard'}
          </Menu.Item>
        )}
        {!isDashboard && (
          <Menu.Item
            leftSection={<IconCopy size={16} />}
            onClick={onClickSaveAsNew}
          >
            Save as New Search
          </Menu.Item>
        )}
        <Menu.Item
          leftSection={<IconTrash size={16} />}
          color="red"
          onClick={onClickDeleteSavedSearch}
        >
          {isDashboard ? 'Delete dashboard' : 'Delete Saved Search'}
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
