import { useState } from 'react';
import { SourceKind } from '@hyperdx/common-utils/dist/types';
import { Badge, Button, Group, Stack, Text } from '@mantine/core';

import EmptyState from '@/components/EmptyState';
import DirectTraceSidePanel from '@/components/Search/DirectTraceSidePanel';
import { useSource } from '@/source';

import ServiceMap from './ServiceMap';

interface ServiceMapSidePanelProps {
  traceId: string;
  dateRange: [Date, Date];
  traceTableSourceId?: string;
  showTraceAction?: boolean;
  focusDate?: Date;
}

export default function ServiceMapSidePanel({
  traceId,
  dateRange,
  traceTableSourceId,
  showTraceAction = true,
  focusDate,
}: ServiceMapSidePanelProps) {
  const [traceOpened, setTraceOpened] = useState(false);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const {
    data: traceTableSource,
    isLoading,
    error,
    refetch,
  } = useSource({
    id: selectedSourceId ?? traceTableSourceId,
    kinds: [SourceKind.Trace],
  });

  return (
    <Stack w="100%" mih={360}>
      <Group gap={0}>
        <Text size="sm" ps="sm">
          Service map
        </Text>
        <Badge size="xs" ms="xs" color="gray" autoContrast radius="sm">
          Beta
        </Badge>
        {showTraceAction && (
          <Button
            variant="link"
            size="xs"
            ml="auto"
            onClick={() => setTraceOpened(true)}
          >
            {traceTableSource ? 'View trace' : 'Choose trace source'}
          </Button>
        )}
      </Group>
      {traceTableSource && traceTableSource.kind === SourceKind.Trace ? (
        <ServiceMap
          traceTableSource={traceTableSource}
          traceId={traceId}
          dateRange={dateRange}
          isSingleTrace
        />
      ) : (
        <EmptyState
          title={
            error
              ? 'Unable to load trace source'
              : isLoading
                ? 'Loading trace source'
                : 'No linked trace source'
          }
          description="A trace ID is present, but a valid trace source is needed. Choose a source to inspect this trace. An admin can update the log source’s linked trace source in source settings."
        >
          {error && (
            <Button variant="secondary" onClick={() => refetch()}>
              Retry
            </Button>
          )}
        </EmptyState>
      )}
      {traceOpened && (
        <DirectTraceSidePanel
          opened
          traceId={traceId}
          traceSourceId={selectedSourceId ?? traceTableSource?.id}
          dateRange={dateRange}
          focusDate={
            focusDate ??
            new Date((dateRange[0].getTime() + dateRange[1].getTime()) / 2)
          }
          onClose={() => setTraceOpened(false)}
          onSourceChange={setSelectedSourceId}
          closeOnClickOutside={false}
        />
      )}
    </Stack>
  );
}
