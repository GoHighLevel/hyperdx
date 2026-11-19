import { Text } from '@mantine/core';

import { useFormatTime } from '@/useFormatTime';

export default function LatestDataRefresh({ until }: { until?: number }) {
  const formatTime = useFormatTime();
  if (until == null) return null;
  return (
    <Text
      size="xs"
      c="var(--color-text-muted)"
      py={4}
      role="status"
      title={`Latest successfully fetched time window ends at ${formatTime(until, { format: 'withYear' })}.`}
      data-testid="latest-data-refresh"
    >
      Latest data refreshed up to {formatTime(until, { format: 'time' })}
    </Text>
  );
}
