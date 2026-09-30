import { useState } from 'react';
import { SourceKind, TLogSource } from '@hyperdx/common-utils/dist/types';
import { Button, Group, Stack, Text } from '@mantine/core';

import InlineLogDetails from '@/components/InlineLogDetails';
import LatestDataRefresh from '@/components/LatestDataRefresh';
import { TimePicker } from '@/components/TimePicker/TimePicker';
import { useLastSuccessfulQueryTime } from '@/hooks/useLastSuccessfulQueryTime';

const source: TLogSource = {
  id: 'preview',
  name: 'Logs',
  kind: SourceKind.Log,
  connection: 'preview',
  from: { databaseName: 'default', tableName: 'logs' },
  timestampValueExpression: 'timestamp',
  defaultTableSelectExpression: 'timestamp, log',
};

export default function RefreshControlsPreview() {
  const [range, setRange] = useState('Live Tail');
  const [duration, setDuration] = useState(15 * 60 * 1000);
  const [completedUntil, setCompletedUntil] = useState(
    Date.parse('2026-09-16T13:07:00Z'),
  );
  const [isFetching, setFetching] = useState(false);
  const [isError, setError] = useState(false);
  const until = useLastSuccessfulQueryTime({
    queryIdentity: 'preview',
    completedUntil,
    isFetching,
    isError,
    isPlaceholderData: false,
  });
  return (
    <Stack p="lg">
      <TimePicker
        inputValue={range}
        setInputValue={setRange}
        onSearch={setRange}
        onRelativeSearch={setDuration}
        showLive
        defaultRelativeTimeMode
      />
      <Text data-testid="selected-duration">
        Selected range: {duration / 86400000} days
      </Text>
      <Group>
        <Button
          variant="secondary"
          onClick={() => {
            setFetching(true);
            setError(false);
            setCompletedUntil(v => v + 60000);
          }}
        >
          Start refresh
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            setFetching(false);
            setError(false);
          }}
        >
          Finish refresh
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            setFetching(false);
            setError(true);
          }}
        >
          Fail refresh
        </Button>
      </Group>
      <LatestDataRefresh until={until} />
      <InlineLogDetails
        source={source}
        rowId="sample"
        onOpenDetails={() => {}}
        onOpenTrace={() => {}}
      />
    </Stack>
  );
}
