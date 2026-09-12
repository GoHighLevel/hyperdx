import { useState } from 'react';
import {
  DEFAULT_DEVELOPER_UI,
  DeveloperUI,
} from '@hyperdx/common-utils/dist/types';
import {
  Alert,
  Button,
  Card,
  Group,
  SimpleGrid,
  Stack,
  Switch,
  Text,
} from '@mantine/core';

import api from '@/api';
import { usePermissions } from '@/usePermissions';

const SECTIONS: {
  key: keyof DeveloperUI;
  label: string;
  description: string;
}[] = [
  {
    key: 'analysisMode',
    label: 'Analysis mode',
    description: 'Switch between results, event patterns and event deltas.',
  },
  {
    key: 'histogram',
    label: 'Log timeline',
    description: 'Show the histogram above the results table.',
  },
  {
    key: 'sharedFilters',
    label: 'Shared filters',
    description: 'Show the filters pinned by admins.',
  },
  {
    key: 'filters',
    label: 'Personal filters',
    description: 'Discover fields, select values and manage personal pins.',
  },
  {
    key: 'denoise',
    label: 'Denoise results',
    description:
      'Allow developers to hide repetitive events. Requires personal filters.',
  },
];

export default function DeveloperUISection() {
  const { data: me } = api.useMe();
  const { canManageShared } = usePermissions();
  const update = api.useUpdateDeveloperUI();
  const [draft, setDraft] = useState<DeveloperUI | null>(null);
  const settings = draft ?? {
    ...DEFAULT_DEVELOPER_UI,
    ...me?.team.developerUI,
  };
  if (!canManageShared) return null;

  return (
    <Stack gap="md">
      <Text fw={600}>Developer experience</Text>
      <Text size="sm" c="dimmed">
        Choose the sections developers see in search. The log table and access
        to all logs stay available. Use “View as developer” in your user menu to
        preview the saved layout.
      </Text>
      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        {SECTIONS.map(section => (
          <Card key={section.key} withBorder padding="md">
            <Switch
              label={section.label}
              description={section.description}
              checked={settings[section.key]}
              disabled={update.isPending || !me}
              onChange={event =>
                setDraft({
                  ...settings,
                  [section.key]: event.currentTarget.checked,
                })
              }
            />
          </Card>
        ))}
      </SimpleGrid>
      {update.isError && (
        <Alert variant="danger">
          Could not save the developer layout. Your changes are still here; try
          again.
        </Alert>
      )}
      {update.isSuccess && !draft && (
        <Text variant="success" size="sm">
          Developer layout saved.
        </Text>
      )}
      <Group>
        <Button
          variant="primary"
          disabled={!draft || !me}
          loading={update.isPending}
          onClick={() =>
            update.mutate(settings, { onSuccess: () => setDraft(null) })
          }
        >
          Save developer layout
        </Button>
        <Button
          variant="secondary"
          disabled={update.isPending}
          onClick={() => setDraft({ ...DEFAULT_DEVELOPER_UI })}
        >
          Restore defaults
        </Button>
      </Group>
    </Stack>
  );
}
