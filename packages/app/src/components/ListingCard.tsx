import Link from 'next/link';
import Router from 'next/router';
import { formatDistanceToNow } from 'date-fns';
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Checkbox,
  Group,
  Menu,
  Text,
  Tooltip,
} from '@mantine/core';
import { IconDots, IconFolder, IconTrash } from '@tabler/icons-react';

import { FavoriteButton } from '@/components/FavoriteButton';
import { Favorite } from '@/favorites';
import { FormatTime } from '@/useFormatTime';
import { usePermissions } from '@/usePermissions';

export function ListingCard({
  name,
  href,
  description,
  tags,
  onDelete,
  statusIcon,
  resourceId,
  resourceType,
  updatedAt,
  updatedBy,
  canDelete,
  onMove,
  selection,
  folderName,
}: {
  name: string;
  href: string;
  description?: string;
  tags?: string[];
  onDelete?: () => void;
  statusIcon?: React.ReactNode;
  resourceId?: string;
  resourceType?: Favorite['resourceType'];
  updatedAt?: string;
  updatedBy?: string;
  canDelete?: boolean;
  onMove?: () => void;
  selection?: { checked: boolean; onChange: (checked: boolean) => void };
  folderName?: string;
}) {
  const { canManageShared } = usePermissions();
  return (
    <Card
      withBorder
      padding="lg"
      radius="sm"
      style={{ cursor: 'pointer', textDecoration: 'none' }}
      onClick={e => {
        if (
          (e.target as HTMLElement).closest(
            'a,button,input,label,[role="menuitem"]',
          )
        )
          return;
        if (e.metaKey || e.ctrlKey) window.open(href, '_blank', 'noopener');
        else void Router.push(href);
      }}
      onAuxClick={e => {
        if (
          e.button === 1 &&
          e.target instanceof Element &&
          !e.target.closest('a,button,input,label')
        ) {
          window.open(href, '_blank', 'noopener');
        }
      }}
    >
      <Group justify="space-between" wrap="nowrap">
        <Group gap="xs" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
          {selection && (
            <Checkbox
              aria-label={`Select ${name}`}
              checked={selection.checked}
              onChange={e => selection.onChange(e.currentTarget.checked)}
              onClick={e => e.stopPropagation()}
            />
          )}
          <Text
            component={Link}
            href={href}
            fw={500}
            lineClamp={1}
            style={{ flex: 1, minWidth: 0 }}
            title={name}
          >
            {name}
          </Text>
          {statusIcon}
          {resourceId && resourceType && (
            <FavoriteButton
              resourceType={resourceType}
              resourceId={resourceId}
              size="xs"
            />
          )}
        </Group>
        {(canDelete ?? canManageShared) && onDelete && (
          <Menu position="bottom-end" withinPortal>
            <Menu.Target>
              <ActionIcon
                variant="secondary"
                size="sm"
                onClick={e => e.preventDefault()}
              >
                <IconDots size={14} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item
                color="red"
                leftSection={<IconTrash size={14} />}
                onClick={e => {
                  e.preventDefault();
                  onDelete();
                }}
              >
                Delete
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        )}
      </Group>

      {(onMove || folderName) && (
        <Group justify="space-between" mt="xs" gap="xs">
          <Text
            size="xs"
            c="dimmed"
            truncate
            title={folderName}
            style={{ flex: 1 }}
          >
            {folderName}
          </Text>
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
        </Group>
      )}

      {updatedAt && (
        <Tooltip
          label={
            <>
              <FormatTime value={updatedAt} format="short" />
              {updatedBy ? ` by ${updatedBy}` : ''}
            </>
          }
        >
          <Text size="xs" c="dimmed" mt={2}>
            Updated{' '}
            {formatDistanceToNow(new Date(updatedAt), { addSuffix: true })}
          </Text>
        </Tooltip>
      )}

      {description && (
        <Text size="sm" c="dimmed" mt="xs">
          {description}
        </Text>
      )}

      {tags && tags.length > 0 && (
        <Group gap="xs" mt="xs">
          {tags.map(tag => (
            <Badge key={tag} variant="light" size="xs">
              {tag}
            </Badge>
          ))}
        </Group>
      )}
    </Card>
  );
}
