import { useCallback, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useQueryState } from 'nuqs';
import {
  ActionIcon,
  Anchor,
  Button,
  Checkbox,
  Container,
  Flex,
  Group,
  Menu,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { useLocalStorage } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconChevronDown,
  IconDeviceFloppy,
  IconLayoutGrid,
  IconList,
  IconPlus,
  IconSearch,
  IconUpload,
} from '@tabler/icons-react';

import { AlertStatusIcon } from '@/components/AlertStatusIcon';
import EmptyState from '@/components/EmptyState';
import { FavoriteButton } from '@/components/FavoriteButton';
import { ListingCard } from '@/components/ListingCard';
import { ListingRow } from '@/components/ListingListRow';
import { PageHeader } from '@/components/PageHeader';
import { IS_K8S_DASHBOARD_ENABLED } from '@/config';
import { type Dashboard, useDashboards, useDeleteDashboard } from '@/dashboard';
import { useDashboardFolders } from '@/dashboardFolders';
import { useFavorites } from '@/favorites';
import { withAppNav } from '@/layout';
import { useBrandDisplayName } from '@/theme/ThemeProvider';
import { useConfirm } from '@/useConfirm';
import { useDeveloperPreview } from '@/useDeveloperPreview';
import { usePermissions } from '@/usePermissions';
import { groupByTags } from '@/utils/groupByTags';

import DashboardCreateDialog from './DashboardCreateDialog';
import DashboardFoldersBar from './DashboardFoldersBar';
import MoveDashboardsDialog from './MoveDashboardsDialog';

function getDashboardAlerts(tiles: Dashboard['tiles']) {
  return tiles.map(t => t.config.alert).filter(a => a != null);
}

const PRESET_DASHBOARDS = [
  {
    name: 'Services',
    href: '/services',
    description: 'Monitor HTTP endpoints, latency, and error rates',
  },
  {
    name: 'ClickHouse',
    href: '/clickhouse',
    description: 'ClickHouse cluster health and query performance',
  },
  ...(IS_K8S_DASHBOARD_ENABLED
    ? [
        {
          name: 'Kubernetes',
          href: '/kubernetes',
          description: 'Kubernetes cluster monitoring and pod health',
        },
      ]
    : []),
  {
    name: 'LLM',
    href: '/llm',
    description: 'LLM calls, token usage, cost, and latency by model',
  },
];

export default function DashboardsListPage() {
  const { canManageShared } = usePermissions();
  const brandName = useBrandDisplayName();
  const { data: dashboards, isLoading, isError } = useDashboards();
  const confirm = useConfirm();
  const [creating, setCreating] = useState(false);
  const [folderFilter, setFolderFilter] = useQueryState('folder');
  const { data: folders } = useDashboardFolders();
  const { isViewingAsDeveloper } = useDeveloperPreview();
  const canEdit = (dashboard: Dashboard) =>
    canManageShared || (!isViewingAsDeveloper && dashboard.canEdit === true);
  const selectedFolder = folders?.find(folder => folder.id === folderFilter);
  const initialFolderId =
    selectedFolder && (canManageShared || selectedFolder.access === 'team')
      ? selectedFolder.id
      : null;
  const deleteDashboard = useDeleteDashboard();
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [moveTargets, setMoveTargets] = useState<Dashboard[] | null>(null);
  const [tagFilter, setTagFilter] = useQueryState('tag');
  const [viewMode, setViewMode] = useLocalStorage<'grid' | 'list'>({
    key: 'dashboardsViewMode',
    defaultValue: 'grid',
  });

  const { data: favorites } = useFavorites();
  const favoritedDashboards = useMemo(() => {
    if (!dashboards || !favorites?.length) return [];

    const favoritedDashboardIds = new Set(
      favorites
        .filter(f => f.resourceType === 'dashboard')
        .map(f => f.resourceId),
    );

    return dashboards
      .filter(d => favoritedDashboardIds.has(d.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [dashboards, favorites]);

  const allTags = useMemo(() => {
    if (!dashboards) return [];
    const tags = new Set<string>();
    dashboards.forEach(d => d.tags.forEach(t => tags.add(t)));
    return Array.from(tags).sort();
  }, [dashboards]);

  const filteredDashboards = useMemo(() => {
    if (!dashboards) return [];
    let result = dashboards;
    if (folderFilter) {
      result = result.filter(d =>
        folderFilter === '_general' ? !d.folderId : d.folderId === folderFilter,
      );
    }
    if (tagFilter) {
      result = result.filter(d => d.tags.includes(tagFilter));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        d =>
          d.name.toLowerCase().includes(q) ||
          d.tags.some(t => t.toLowerCase().includes(q)),
      );
    }
    return result.slice().sort((a, b) => a.name.localeCompare(b.name));
  }, [dashboards, search, tagFilter, folderFilter]);

  const tagGroups = useMemo(
    () => groupByTags(filteredDashboards, tagFilter),
    [filteredDashboards, tagFilter],
  );

  const selectionScope = JSON.stringify([folderFilter, tagFilter, search]);
  const [previousSelectionScope, setPreviousSelectionScope] =
    useState(selectionScope);
  if (previousSelectionScope !== selectionScope) {
    setPreviousSelectionScope(selectionScope);
    setSelectedIds([]);
  }
  const selectable = filteredDashboards.filter(canEdit);
  const selected = selectable.filter(d => selectedIds.includes(d.id));
  const toggleSelection = (id: string, checked: boolean) =>
    setSelectedIds(ids =>
      checked ? [...new Set([...ids, id])] : ids.filter(value => value !== id),
    );
  const folderName = (dashboard: Dashboard) =>
    dashboard.folderId
      ? (folders?.find(folder => folder.id === dashboard.folderId)?.name ??
        'Unknown folder')
      : 'General';

  const handleCreate = () => setCreating(true);

  const handleDelete = useCallback(
    async (id: string) => {
      const confirmed = await confirm(
        'Are you sure you want to delete this dashboard? This action cannot be undone.',
        'Delete Dashboard',
        { variant: 'danger' },
      );
      if (!confirmed) return;
      deleteDashboard.mutate(id, {
        onSuccess: () => {
          notifications.show({
            message: 'Dashboard deleted',
            color: 'green',
          });
        },
        onError: () => {
          notifications.show({
            message: 'Failed to delete dashboard',
            color: 'red',
          });
        },
      });
    },
    [confirm, deleteDashboard],
  );

  return (
    <div
      data-testid="dashboards-list-page"
      style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}
    >
      <Head>
        <title>Dashboards - {brandName}</title>
      </Head>
      <PageHeader title="Dashboards" />
      <Container
        maw={1200}
        py="lg"
        px="lg"
        w="100%"
        style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
      >
        <Text fw={500} size="sm" c="dimmed" mb="sm">
          Preset Dashboards
        </Text>
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }} mb="sm">
          {PRESET_DASHBOARDS.map(p => (
            <ListingCard key={p.href} {...p} />
          ))}
        </SimpleGrid>
        <Text ta="right" mb="sm">
          <Anchor component={Link} href="/dashboards/templates" fz="sm">
            Browse dashboard templates &rarr;
          </Anchor>
        </Text>

        {!folderFilter && favoritedDashboards.length > 0 && (
          <>
            <Text fw={500} size="sm" c="dimmed" mb="sm">
              Favorites
            </Text>
            <SimpleGrid
              cols={{ base: 1, sm: 2, md: 3 }}
              mb="xl"
              data-testid="favorite-dashboards-section"
            >
              {favoritedDashboards.map(d => (
                <ListingCard
                  key={d.id}
                  name={d.name}
                  href={`/dashboards/${d.id}`}
                  tags={d.tags}
                  description={`${d.tiles.length} ${d.tiles.length === 1 ? 'tile' : 'tiles'}`}
                  onDelete={() => handleDelete(d.id)}
                  canDelete={canEdit(d)}
                  folderName={folderName(d)}
                  onMove={canEdit(d) ? () => setMoveTargets([d]) : undefined}
                  statusIcon={
                    <AlertStatusIcon alerts={getDashboardAlerts(d.tiles)} />
                  }
                  resourceId={d.id}
                  resourceType="dashboard"
                  updatedAt={d.updatedAt}
                  updatedBy={d.updatedBy?.name || d.updatedBy?.email}
                />
              ))}
            </SimpleGrid>
          </>
        )}
        {moveTargets && (
          <MoveDashboardsDialog
            dashboards={moveTargets}
            onClose={() => setMoveTargets(null)}
            onMoved={ids => {
              setSelectedIds(selected =>
                selected.filter(id => !ids.includes(id)),
              );
              notifications.show({
                message: `${ids.length} ${ids.length === 1 ? 'dashboard moved' : 'dashboards moved'}`,
                color: 'green',
              });
            }}
          />
        )}

        <Text fw={500} size="sm" c="dimmed" mb="sm">
          Team Dashboards
        </Text>
        <DashboardFoldersBar
          selected={folderFilter}
          onSelect={value => void setFolderFilter(value)}
          dashboards={dashboards ?? []}
        />
        {creating && (
          <DashboardCreateDialog
            onClose={() => setCreating(false)}
            initialFolderId={initialFolderId}
          />
        )}

        <Flex justify="space-between" align="center" mb="lg" gap="sm">
          <Group gap="xs" style={{ flex: 1 }}>
            <TextInput
              placeholder="Search by name"
              leftSection={<IconSearch size={16} />}
              value={search}
              onChange={e => setSearch(e.currentTarget.value)}
              style={{ flex: 1, maxWidth: 400 }}
              miw={100}
            />
            {allTags.length > 0 && (
              <Select
                placeholder="Filter by tag"
                data={allTags}
                value={tagFilter}
                onChange={v => setTagFilter(v)}
                clearable
                searchable
                style={{ maxWidth: 200 }}
              />
            )}
          </Group>
          <Group gap="xs" align="center">
            <ActionIcon.Group>
              <ActionIcon
                variant={viewMode === 'grid' ? 'primary' : 'secondary'}
                size="input-sm"
                onClick={() => setViewMode('grid')}
                aria-label="Grid view"
              >
                <IconLayoutGrid size={16} />
              </ActionIcon>
              <ActionIcon
                variant={viewMode === 'list' ? 'primary' : 'secondary'}
                size="input-sm"
                onClick={() => setViewMode('list')}
                aria-label="List view"
              >
                <IconList size={16} />
              </ActionIcon>
            </ActionIcon.Group>
            <Button
              component={Link}
              href={
                initialFolderId
                  ? `/dashboards/import?folder=${initialFolderId}`
                  : '/dashboards/import'
              }
              variant="secondary"
              leftSection={<IconUpload size={16} />}
              data-testid="import-dashboard-button"
            >
              Import
            </Button>
            <Menu position="bottom-end" withinPortal>
              <Menu.Target>
                <Button
                  variant="primary"
                  leftSection={<IconPlus size={16} />}
                  rightSection={<IconChevronDown size={14} />}
                  data-testid="new-dashboard-button"
                >
                  New Dashboard
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item
                  leftSection={<IconDeviceFloppy size={14} />}
                  onClick={handleCreate}
                  data-testid="create-dashboard-button"
                >
                  Saved Dashboard
                  <Text size="xs" c="dimmed">
                    Persisted for your team
                  </Text>
                </Menu.Item>
                <Menu.Item
                  component={Link}
                  href="/dashboards"
                  leftSection={<IconPlus size={14} />}
                  data-testid="temp-dashboard-button"
                >
                  Temporary Dashboard
                  <Text size="xs" c="dimmed">
                    Lives in your browser only
                  </Text>
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Flex>

        {selectable.length > 0 && (
          <Group mb="md" gap="sm">
            <Checkbox
              label="Select all shown"
              checked={selected.length === selectable.length}
              indeterminate={
                selected.length > 0 && selected.length < selectable.length
              }
              onChange={event =>
                setSelectedIds(
                  event.currentTarget.checked ? selectable.map(d => d.id) : [],
                )
              }
            />
            <Text size="sm" c="dimmed">
              {selected.length} selected
            </Text>
            <Button
              size="xs"
              variant="secondary"
              disabled={!selected.length}
              onClick={() => setMoveTargets(selected)}
            >
              Move selected
            </Button>
            {selected.length > 0 && (
              <Button
                size="xs"
                variant="subtle"
                onClick={() => setSelectedIds([])}
              >
                Clear selection
              </Button>
            )}
          </Group>
        )}

        {isLoading ? (
          <Text size="sm" c="dimmed" ta="center" py="xl">
            Loading dashboards...
          </Text>
        ) : isError ? (
          <Text size="sm" c="red" ta="center" py="xl">
            Failed to load dashboards. Please try refreshing the page.
          </Text>
        ) : filteredDashboards.length === 0 ? (
          <Flex
            align="center"
            justify="center"
            style={{ flex: 1, minHeight: 0 }}
          >
            <EmptyState
              icon={<IconLayoutGrid size={32} />}
              title={
                search || tagFilter
                  ? 'No matching dashboards yet'
                  : 'No dashboards yet'
              }
            >
              <Group>
                <Button
                  component={Link}
                  href={
                    initialFolderId
                      ? `/dashboards/import?folder=${initialFolderId}`
                      : '/dashboards/import'
                  }
                  variant="secondary"
                  leftSection={<IconUpload size={16} />}
                  data-testid="empty-import-dashboard-button"
                >
                  Import
                </Button>
                <Button
                  variant="primary"
                  leftSection={<IconPlus size={16} />}
                  onClick={handleCreate}
                  data-testid="empty-create-dashboard-button"
                >
                  New Dashboard
                </Button>
              </Group>
            </EmptyState>
          </Flex>
        ) : viewMode === 'list' ? (
          <Table.ScrollContainer minWidth={950}>
            <Table highlightOnHover style={{ tableLayout: 'fixed' }}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th w="7%" />
                  <Table.Th w="26%">Name</Table.Th>
                  <Table.Th w="16%">Folder</Table.Th>
                  <Table.Th w="9%">Tags</Table.Th>
                  <Table.Th w="17%">Created By</Table.Th>
                  <Table.Th w="13%">Last Updated</Table.Th>
                  <Table.Th w="12%" />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filteredDashboards.map(d => (
                  <ListingRow
                    key={d.id}
                    id={d.id}
                    name={d.name}
                    href={`/dashboards/${d.id}`}
                    tags={d.tags}
                    onDelete={handleDelete}
                    canDelete={canEdit(d)}
                    folderName={folderName(d)}
                    onMove={canEdit(d) ? () => setMoveTargets([d]) : undefined}
                    createdBy={d.createdBy?.name || d.createdBy?.email}
                    updatedAt={d.updatedAt}
                    updatedBy={d.updatedBy?.name || d.updatedBy?.email}
                    leftSection={
                      <Group
                        gap={0}
                        ps={4}
                        justify="space-between"
                        wrap="nowrap"
                      >
                        {canEdit(d) && (
                          <Checkbox
                            aria-label={`Select ${d.name}`}
                            checked={selectedIds.includes(d.id)}
                            onClick={event => event.stopPropagation()}
                            onChange={event =>
                              toggleSelection(d.id, event.currentTarget.checked)
                            }
                          />
                        )}
                        <FavoriteButton
                          resourceType="dashboard"
                          resourceId={d.id}
                          size="xs"
                        />
                        <AlertStatusIcon alerts={getDashboardAlerts(d.tiles)} />
                      </Group>
                    }
                  />
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        ) : (
          <Stack gap="lg">
            {tagGroups.map(group => (
              <div key={group.tag}>
                <Text fw={500} size="sm" c="dimmed" mb="sm">
                  {group.tag}
                </Text>
                <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
                  {group.items.map(d => (
                    <ListingCard
                      key={d.id}
                      name={d.name}
                      href={`/dashboards/${d.id}`}
                      tags={d.tags}
                      description={`${d.tiles.length} ${d.tiles.length === 1 ? 'tile' : 'tiles'}`}
                      onDelete={() => handleDelete(d.id)}
                      canDelete={canEdit(d)}
                      folderName={folderName(d)}
                      onMove={
                        canEdit(d) ? () => setMoveTargets([d]) : undefined
                      }
                      selection={
                        canEdit(d)
                          ? {
                              checked: selectedIds.includes(d.id),
                              onChange: checked =>
                                toggleSelection(d.id, checked),
                            }
                          : undefined
                      }
                      statusIcon={
                        <AlertStatusIcon alerts={getDashboardAlerts(d.tiles)} />
                      }
                      resourceId={d.id}
                      resourceType="dashboard"
                      updatedAt={d.updatedAt}
                      updatedBy={d.updatedBy?.name || d.updatedBy?.email}
                    />
                  ))}
                </SimpleGrid>
              </div>
            ))}
          </Stack>
        )}
      </Container>
    </div>
  );
}

DashboardsListPage.getLayout = withAppNav;
