import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Loader, Text } from '@mantine/core';

import { Dashboard } from '@/dashboard';
import { DBSearchPage } from '@/DBSearchPage';

export default function SearchDashboardPage({
  dashboard,
}: {
  dashboard: Dashboard;
}) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    const view = dashboard.searchView;
    if (!view) return;
    let mounted = true;
    const defaults = {
      source: view.search.source,
      where: encodeURIComponent(view.search.where),
      select: encodeURIComponent(view.search.select),
      whereLanguage: view.search.whereLanguage,
      filters: encodeURIComponent(JSON.stringify(view.search.filters ?? [])),
      orderBy: encodeURIComponent(view.search.orderBy ?? ''),
      from: String(view.time.from),
      to: String(view.time.to),
      isLive: String(view.time.isLive),
      liveInterval: String(view.time.liveInterval),
      refreshFrequency: String(view.time.refreshFrequency),
      mode: view.analysisMode,
      denoise: String(view.denoise),
      ...(view.patternColumn ? { patternColumn: view.patternColumn } : {}),
    };
    void router
      .replace(
        {
          pathname: router.pathname,
          query: { ...defaults, ...router.query },
        },
        undefined,
        { shallow: true },
      )
      .then(() => {
        if (mounted) setReady(true);
      })
      .catch(() => {
        if (mounted) setError(true);
      });
    return () => {
      mounted = false;
    };
    // Initialize URL-backed hooks once per dashboard mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (error) {
    return (
      <Text c="red">
        Could not open this search dashboard. Reload to try again.
      </Text>
    );
  }
  return ready ? <DBSearchPage dashboard={dashboard} /> : <Loader />;
}
