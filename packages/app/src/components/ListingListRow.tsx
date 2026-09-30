import Router from 'next/router';
import { formatDistanceToNow } from 'date-fns';
import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Menu,
  Table,
  Text,
  Tooltip,
} from '@mantine/core';
import { IconDots, IconFolder, IconTrash } from '@tabler/icons-react';

import { FormatTime } from '@/useFormatTime';
import { usePermissions } from '@/usePermissions';

export function ListingRow({
  id,
  name,
  href,
  tags,
  onDelete,
  leftSection,
  updatedAt,
  updatedBy,
  createdBy,
  canDelete,
  onMove,
  folderName,
}: {
  id: string;
  name: string;
  href: string;
  tags?: string[];
  onDelete?: (id: string) => void;
  leftSection?: React.ReactNode;
  updatedAt?: string;
  updatedBy?: string;
  createdBy?: string;
  canDelete?: boolean;
  onMove?: () => void;
  folderName?: string;
}) {
  const { canManageShared } = usePermissions();
  return (
    <Table.Tr
      style={{ cursor: 'pointer' }}
      onClick={e => {
        if (e.metaKey || e.ctrlKey) {
          window.open(href, '_blank');
        } else {
          Router.push(href);
        }
      }}
      onAuxClick={e => {
        if (e.button === 1) {
          window.open(href, '_blank');
        }
      }}
    >
      {leftSection != null && <Table.Td px={0}>{leftSection}</Table.Td>}
      <Table.Td>
        <Group gap={4} wrap="nowrap">
          <Text
            fw={500}
            size="sm"
            maw={folderName === undefined ? 500 : '100%'}
            truncate="end"
            title={name}
          >
            {name}
          </Text>
        </Group>
      </Table.Td>
      {folderName !== undefined && (
        <Table.Td>
          <Text size="xs" c="dimmed">
            {folderName}
          </Text>
        </Table.Td>
      )}
      <Table.Td>
        <Group gap={4}>
          {tags?.map(tag => (
            <Badge key={tag} variant="light" size="xs">
              {tag}
            </Badge>
          ))}
        </Group>
      </Table.Td>
      <Table.Td>
        <Text size="xs" c="dimmed" truncate="end">
          {createdBy ?? '-'}
        </Text>
      </Table.Td>
      <Table.Td>
        {updatedAt ? (
          <Tooltip
            label={
              <>
                <FormatTime value={updatedAt} format="short" />
                {updatedBy ? ` by ${updatedBy}` : ''}
              </>
            }
          >
            <Text size="xs" c="dimmed" truncate="end">
              {formatDistanceToNow(new Date(updatedAt), { addSuffix: true })}
            </Text>
          </Tooltip>
        ) : (
          '-'
        )}
      </Table.Td>
      <Table.Td>
        <Group wrap="nowrap" gap="xs">
          {onMove && (
            <Button
              variant="subtle"
              size="compact-xs"
              leftSection={<IconFolder size={13} />}
              aria-label={`Move ${name}`}
              onClick={e => {
                e.stopPropagation();
                onMove();
              }}
            >
              Move
            </Button>
          )}
          {(canDelete ?? canManageShared) && onDelete && (
            <Menu position="bottom-end" withinPortal>
              <Menu.Target>
                <ActionIcon
                  variant="secondary"
                  size="sm"
                  onClick={e => e.stopPropagation()}
                >
                  <IconDots size={14} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item
                  color="red"
                  leftSection={<IconTrash size={14} />}
                  onClick={e => {
                    e.stopPropagation();
                    onDelete(id);
                  }}
                >
                  Delete
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          )}
        </Group>
      </Table.Td>
    </Table.Tr>
  );
}
