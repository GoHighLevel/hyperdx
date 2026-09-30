import { useState } from 'react';
import { JSDataType } from '@hyperdx/common-utils/dist/clickhouse';
import { SourceKind, TSource } from '@hyperdx/common-utils/dist/types';
import { Button } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { RawLogTable } from '@/components/DBRowTable';
import HyperJson from '@/components/HyperJson';
import type { LogEdgeNavigation } from '@/components/LogScrollButtons';
import DirectTraceSidePanel, {
  TraceSidePanelSelection,
} from '@/components/Search/DirectTraceSidePanel';

import SummaryFieldButton from './SummaryFieldButton';

const sample = {
  timestamp: '2026-09-16T05:00:00.125Z',
  log_level: 'info',
  deployment_name: 'billing-api',
  container_name: 'api',
  host: 'node-1',
  labels: { product: 'st-contacts' },
  log: '{"msg":"Payment processed; fallback from log.msg","request_id":"request-123"}',
  json_payload: {
    'httpRequest.requestMethod': 'POST',
    'httpRequest.status': '200',
  },
};
const collectorSamples = [
  {
    log_level: 'unknown',
    log: '2026-09-16T06:26:54.743Z warn internal/transport.go:20 Request failed',
  },
  {
    log_level: '',
    log: '2026-09-16T06:26:54.743Z debug Scrape failed; retry scheduled',
  },
  {
    log_level: '',
    log: 'Plain message without a severity; mentions error but is not classified',
  },
].map((row, index) => ({
  ...sample,
  ...row,
  id: `collector-${index}`,
  deployment_name: 'otel-metrics-collector-servers-sre-stg',
  json_payload: {},
}));
export default function LiveTablePreview() {
  const [count, setCount] = useState(80);
  const [displayedCount, setDisplayedCount] = useState(80);
  const [windowStart, setWindowStart] = useState(0);
  const [highVolume, setHighVolume] = useState(false);
  const [navigation, setNavigation] = useState<LogEdgeNavigation>();
  const [clock, setClock] = useState(Date.parse(sample.timestamp) + 300000);
  const [checkedUntil, setCheckedUntil] = useState<number>();
  const [expanded, setExpanded] = useState(false);
  const [activeTrace, setActiveTrace] =
    useState<TraceSidePanelSelection | null>(null);
  const paused = expanded || activeTrace != null;
  const [loads, setLoads] = useState(0);
  const navigate = async (edge: 'start' | 'latest') => {
    if (paused) return;
    const id = (navigation?.id ?? 0) + 1;
    setNavigation({ id, edge, status: 'loading' });
    // Synthetic latency; this fixture exercises the real table's navigation UI.
    // The query hook's DESC/ASC behavior is covered separately by regression tests.
    await new Promise(resolve => setTimeout(resolve, 250));
    setWindowStart(edge === 'latest' ? Math.max(0, count - 80) : 0);
    setDisplayedCount(Math.min(80, count));
    setLoads(value => value + 1);
    setCheckedUntil(edge === 'latest' ? clock : undefined);
    setNavigation({ id, edge, status: 'success' });
  };
  const [queryClient] = useState(() => {
    const client = new QueryClient({
      defaultOptions: { queries: { staleTime: Infinity, retry: false } },
    });
    // This local fixture has no backend trace source. Exercise the real drawer's
    // source-selection state without pretending sample spans were ingested.
    client.setQueryData(['sources'], []);
    return client;
  });
  return (
    <QueryClientProvider client={queryClient}>
      <main
        style={{
          height: '95vh',
          background: 'var(--color-bg-body)',
          padding: 12,
        }}
      >
        <Button onClick={() => setCount(value => value + 1)}>
          Simulate incoming log
        </Button>
        <Button ml="xs" onClick={() => setClock(value => value + 60000)}>
          Advance clock 1 minute
        </Button>
        <Button
          ml="xs"
          onClick={() => {
            setHighVolume(true);
            setCount(1000000);
            setDisplayedCount(80);
            setWindowStart(0);
            setNavigation(undefined);
          }}
        >
          Simulate high-volume range
        </Button>
        <span role="status">
          {' '}
          Available: {count} · Displayed: {displayedCount} · Loads: {loads}
        </span>
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8 }}
        >
          <span>labels.product</span>
          <SummaryFieldButton sourceId="preview-logs" path="labels.product" />
        </div>
        <div style={{ height: '85vh' }}>
          <RawLogTable
            source={{ id: 'preview-logs', kind: SourceKind.Log } as TSource}
            displayedColumns={[
              'timestamp',
              'log_level',
              'deployment_name',
              'log',
            ]}
            rows={[
              ...(windowStart === 0 && !highVolume ? collectorSamples : []),
              ...Array.from({ length: displayedCount }, (_, index) => ({
                ...sample,
                timestamp: new Date(
                  Date.parse(sample.timestamp) +
                    (windowStart + index) *
                      (highVolume ? 300000 / count : 1000),
                ).toISOString(),
                log: `Request ${windowStart + index + 1} completed`,
                __hdx_trace_id: '0123456789abcdef0123456789abcdef',
                id: windowStart + index + 1,
              })),
            ]}
            generateRowId={row => ({ where: `id=${row.id}`, aliasWith: [] })}
            onRowDetailsClick={() => {}}
            onOpenTrace={setActiveTrace}
            columnTypeMap={new Map([['timestamp', { _type: JSDataType.Date }]])}
            renderRowDetails={() => (
              <HyperJson data={sample} groupDottedKeys expandJsonStrings />
            )}
            isLive
            loadOnScroll
            loadingPaused={paused}
            jumpToLatest={() => {
              void navigate('latest');
            }}
            jumpToStart={() => {
              void navigate('start');
            }}
            edgeNavigation={navigation}
            refreshedUntil={checkedUntil}
            latestInRange={windowStart + displayedCount >= count}
            dateRange={[
              new Date(sample.timestamp),
              new Date(
                Date.parse(sample.timestamp) + (highVolume ? 300000 : 80000),
              ),
            ]}
            hasNextPage={windowStart + displayedCount < count}
            fetchNextPage={() => navigate('latest')}
            onExpandedRowsChange={setExpanded}
            wrapLines
          />
        </div>
        {activeTrace && (
          <DirectTraceSidePanel
            {...activeTrace}
            opened
            onClose={() => setActiveTrace(null)}
            onSourceChange={traceSourceId =>
              setActiveTrace(previous =>
                previous ? { ...previous, traceSourceId } : null,
              )
            }
            closeOnClickOutside={false}
          />
        )}
      </main>
    </QueryClientProvider>
  );
}
