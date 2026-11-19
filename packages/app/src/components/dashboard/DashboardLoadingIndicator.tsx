import { Group, Loader, Text } from '@mantine/core';
import { useIsFetching } from '@tanstack/react-query';

export default function DashboardLoadingIndicator() {
  const fetching = useIsFetching({ type: 'active' });

  if (!fetching) return null;

  return (
    <Group gap="xs" wrap="nowrap" role="status" aria-live="polite">
      <Loader size="xs" aria-hidden="true" />
      <Text size="sm">Loading dashboard…</Text>
    </Group>
  );
}
