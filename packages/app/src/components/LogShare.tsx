import { useEffect } from 'react';
import { useRouter } from 'next/router';
import {
  freezeLogShareTarget,
  LogShareTargetSchema,
} from '@hyperdx/common-utils/dist/logShare';
import type { BuilderChartConfigWithDateRange } from '@hyperdx/common-utils/dist/types';
import { ActionIcon, Loader, Text, Tooltip } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconShare } from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';

import { hdxServer } from '@/api';
import EmptyState from '@/components/EmptyState';
import { useSummaryFields } from '@/components/LogSummaryDemo/useSummaryFields';
import { copyTextToClipboard } from '@/utils/clipboard';

export function ShareLogButton({
  sourceId,
  dateRange,
  config,
}: {
  sourceId: string;
  dateRange: readonly [Date, Date];
  config?: BuilderChartConfigWithDateRange;
}) {
  const router = useRouter();
  const [fields] = useSummaryFields(sourceId);
  const share = useMutation({
    mutationFn: async () => {
      const url = new URL(window.location.href);
      let path = router.basePath
        ? url.pathname.slice(router.basePath.length)
        : url.pathname;
      if (/^\/search\/[a-f0-9]{24}$/.test(path) && config) path = '/search';
      url.searchParams.set('source', sourceId);
      if (config) {
        if (typeof config.where === 'string')
          url.searchParams.set('where', encodeURIComponent(config.where));
        if (typeof config.select === 'string')
          url.searchParams.set('select', encodeURIComponent(config.select));
        if (typeof config.orderBy === 'string')
          url.searchParams.set('orderBy', encodeURIComponent(config.orderBy));
        if (config.whereLanguage)
          url.searchParams.set('whereLanguage', config.whereLanguage);
        url.searchParams.set(
          'filters',
          encodeURIComponent(JSON.stringify(config.filters ?? [])),
        );
      }
      url.searchParams.set('summaryFields', JSON.stringify(fields));
      const target = freezeLogShareTarget(path + url.search, dateRange);
      const result = await hdxServer('log-shares', {
        method: 'POST',
        headers: { 'X-HyperDX-Share': '1' },
        json: { target },
      }).json<{ id: string }>();
      if (!/^[A-Za-z0-9_-]{24}$/.test(result.id))
        throw new Error('Invalid short link');
      if (
        !(await copyTextToClipboard(
          `${url.origin}${router.basePath}/s/${result.id}`,
        ))
      )
        throw new Error('Clipboard unavailable');
    },
    onSuccess: () => notifications.show({ message: 'Short log link copied' }),
    onError: () =>
      notifications.show({
        message:
          'Could not create or copy the short link. The original URL still works.',
        color: 'red',
      }),
  });
  return (
    <Tooltip label="Copy short log link">
      <ActionIcon
        variant="subtle"
        size="sm"
        aria-label="Share logs"
        loading={share.isPending}
        onClick={() => share.mutate()}
      >
        <IconShare size={16} />
      </ActionIcon>
    </Tooltip>
  );
}

export function SharedLogLink() {
  const router = useRouter();
  const id = typeof router.query.id === 'string' ? router.query.id : undefined;
  const query = useQuery({
    queryKey: ['shared-log-link', id],
    enabled: !!id && /^[A-Za-z0-9_-]{24}$/.test(id),
    retry: false,
    gcTime: 0,
    queryFn: async () => {
      const result = await hdxServer(`log-shares/${id}`).json<{
        target: unknown;
      }>();
      return LogShareTargetSchema.parse(result.target);
    },
  });
  useEffect(() => {
    if (query.data) void router.replace(query.data);
  }, [query.data, router]);
  if (query.isError || (id && !/^[A-Za-z0-9_-]{24}$/.test(id)))
    return (
      <EmptyState
        title="This log link is unavailable"
        description="Sign in to the correct team, or ask the sender for a new link."
      />
    );
  return (
    <>
      <Loader size="sm" />
      <Text size="sm" role="status">
        Opening shared logs…
      </Text>
    </>
  );
}
