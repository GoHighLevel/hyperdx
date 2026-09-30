import { useEffect, useState } from 'react';
import { BuilderChartConfigWithDateRange } from '@hyperdx/common-utils/dist/types';
import { Box, Button, Group, Select, Stack, Text, Title } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import FilterLogCount from '@/components/FilterLogCount';
import { useProgressiveValueCounts } from '@/hooks/useProgressiveValueCounts';

const values = ['contacts-api', 'events-worker', 'billing-api'];
const client = new QueryClient();

function Counts() {
  const [days, setDays] = useState('30');
  const [now, setNow] = useState(() => Date.parse('2026-09-16T15:00:00Z'));
  const [fail, setFail] = useState(false);
  useEffect(() => {
    const timer = setInterval(() => setNow(previous => previous + 1000), 1000);
    return () => clearInterval(timer);
  }, []);
  const config = {
    connection: 'preview',
    from: { databaseName: 'preview', tableName: 'logs' },
    select: '',
    where: '',
    whereLanguage: 'sql',
    timestampValueExpression: 'timestamp',
    dateRange: [new Date(now - Number(days) * 86400000), new Date(now)],
  } satisfies BuilderChartConfigWithDateRange;
  const counts = useProgressiveValueCounts({
    chartConfig: config,
    field: 'deployment_name',
    values,
    source: undefined,
    enabled: true,
    isLive: true,
    fetchWindow: async (window, signal) => {
      await new Promise<void>((resolve, reject) => {
        const onAbort = () => {
          clearTimeout(timer);
          reject(signal.reason);
        };
        const timer = setTimeout(() => {
          signal.removeEventListener('abort', onAbort);
          resolve();
        }, 350);
        signal.addEventListener('abort', onAbort, { once: true });
      });
      if (fail) throw new Error('Preview query unavailable');
      const minutes =
        (window.dateRange[1].getTime() - window.dateRange[0].getTime()) / 60000;
      return new Map(
        values.map((value, index) => [
          value,
          String(Math.floor(minutes * (index + 1) * 30)),
        ]),
      );
    },
  });
  const ordered = [...values].sort((a, b) =>
    Number(
      BigInt(counts.data?.get(b) ?? '0') - BigInt(counts.data?.get(a) ?? '0'),
    ),
  );
  return (
    <Box p="xl" maw={720}>
      <Title order={2}>Progressive filter counts</Title>
      <Text c="var(--color-text-muted)" mb="lg">
        Local preview · simulated data · live time advances every second
      </Text>
      <Group mb="lg">
        <Select
          aria-label="Relative time"
          value={days}
          onChange={v => v && setDays(v)}
          data={[
            { value: '1', label: 'Last 24 hours' },
            { value: '30', label: 'Last 30 days' },
          ]}
        />
        <Button variant="secondary" onClick={() => void counts.refetch()}>
          Refresh counts
        </Button>
        <Button variant="secondary" onClick={() => setFail(!fail)}>
          {fail ? 'Restore queries' : 'Fail next query'}
        </Button>
      </Group>
      <Box
        p="md"
        style={{ border: '1px solid var(--color-border)', borderRadius: 6 }}
      >
        <Text fw={600} mb="sm">
          deployment_name
        </Text>
        <Text size="xs" c="var(--color-text-muted)" mb="sm" role="status">
          {counts.error
            ? 'Counting stopped · results retained'
            : counts.isPartial
              ? 'Counts so far · counting older logs'
              : counts.isFetching
                ? 'Updating counts'
                : 'Complete · selected range counted'}
        </Text>
        <Stack gap="sm">
          {ordered.map(value => (
            <Group key={value} justify="space-between">
              <Text size="sm">{value}</Text>
              <FilterLogCount
                testId={`count-${value}`}
                count={counts.data?.get(value)}
                partial={counts.isPartial}
                loading={counts.isFetching}
                error={!!counts.error}
                countedTo={counts.countedTo}
              />
            </Group>
          ))}
        </Stack>
      </Box>
    </Box>
  );
}

export default function FilterCountsPreview() {
  return (
    <QueryClientProvider client={client}>
      <Counts />
    </QueryClientProvider>
  );
}
