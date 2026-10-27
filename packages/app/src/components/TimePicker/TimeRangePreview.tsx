import { useMemo } from 'react';
import { format, formatDuration } from 'date-fns';
import { Stack, Text } from '@mantine/core';

import { parseTimeRangeInput } from './utils';

export default function TimeRangePreview({
  inputValue,
  isUTC,
}: {
  inputValue: string;
  isUTC: boolean;
}) {
  const [start, end] = useMemo(
    () => parseTimeRangeInput(inputValue, isUTC),
    [inputValue, isUTC],
  );
  const valid =
    start &&
    end &&
    Number.isFinite(start.getTime()) &&
    Number.isFinite(end.getTime());
  const seconds = valid
    ? Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000))
    : 0;
  // Elapsed 24-hour days, not calendar days: an incident may cross a DST change.
  const duration =
    formatDuration({
      days: Math.floor(seconds / 86400),
      hours: Math.floor((seconds % 86400) / 3600),
      minutes: Math.floor((seconds % 3600) / 60),
      seconds: seconds % 60,
    }) || '0 seconds';

  return (
    <Stack
      gap={4}
      px="xs"
      py="xs"
      style={{ borderTop: '1px solid var(--color-border)' }}
    >
      <Text size="xs">
        Time zone:{' '}
        {isUTC
          ? 'UTC'
          : `Browser (${Intl.DateTimeFormat().resolvedOptions().timeZone})`}
      </Text>
      {valid && (
        <>
          <Text size="xxs" c="dimmed">
            Input range preview
          </Text>
          <Text size="xxs">
            {isUTC
              ? start.toISOString().replace('T', ' ')
              : format(start, 'yyyy-MM-dd HH:mm:ss.SSS xxx')}
            {' → '}
            {isUTC
              ? end.toISOString().replace('T', ' ')
              : format(end, 'yyyy-MM-dd HH:mm:ss.SSS xxx')}
          </Text>
          <Text size="xxs">Duration: {duration}</Text>
        </>
      )}
    </Stack>
  );
}
