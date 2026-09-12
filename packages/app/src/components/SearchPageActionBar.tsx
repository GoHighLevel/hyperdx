import { ActionIcon, Menu } from '@mantine/core';
import { IconCopy, IconDotsVertical, IconTrash } from '@tabler/icons-react';

import { usePermissions } from '@/usePermissions';

export default function SearchPageActionBar({
  onClickDeleteSavedSearch,
  onClickSaveAsNew,
}: {
  onClickDeleteSavedSearch: () => void;
  onClickSaveAsNew: () => void;
}) {
  const { canManageShared } = usePermissions();
  if (!canManageShared) return null;
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
        <Menu.Item
          leftSection={<IconCopy size={16} />}
          onClick={onClickSaveAsNew}
        >
          Save as New Search
        </Menu.Item>
        <Menu.Item
          leftSection={<IconTrash size={16} />}
          color="red"
          onClick={onClickDeleteSavedSearch}
        >
          Delete Saved Search
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
