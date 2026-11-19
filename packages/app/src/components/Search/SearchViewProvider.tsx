import { ReactNode, useCallback, useMemo, useState } from 'react';
import {
  type SearchView,
  SearchViewSchema,
} from '@hyperdx/common-utils/dist/types';

import api from '@/api';
import { SearchViewContext } from '@/SearchViewContext';

export default function SearchViewProvider({
  view,
  dashboardId,
  children,
}: {
  view?: SearchView;
  dashboardId?: string;
  children: ReactNode;
}) {
  const { data: me } = api.useMe();
  const storageKey = `hdx-dashboard-personal-filters:${me?.id ?? 'local'}:${dashboardId}`;
  const [preferences, setPreferences] = useState(view?.preferences ?? {});
  const [userPreferences, setUserPreferences] = useState(view?.userPreferences);
  const [sharedPins, setSharedPins] = useState(view?.sharedPins);
  const [personalPins, setPins] = useState(() => {
    if (!dashboardId) return undefined;
    try {
      const stored = SearchViewSchema.shape.personalPins.safeParse(
        JSON.parse(localStorage.getItem(storageKey) ?? 'null'),
      );
      if (stored.success) return stored.data;
    } catch {
      /* Browser storage may be disabled. */
    }
    return view?.personalPins;
  });
  // Persist only this viewer's changes, never the imported shared definition.
  const setPersonalPins = useCallback(
    (
      change: (pins: SearchView['personalPins']) => SearchView['personalPins'],
    ) => {
      setPins(previous => {
        if (!previous) return previous;
        const next = change(previous);
        if (next !== previous && dashboardId) {
          try {
            localStorage.setItem(storageKey, JSON.stringify(next));
          } catch {
            /* Keep in-memory preferences when storage is unavailable. */
          }
        }
        return next;
      });
    },
    [dashboardId, storageKey],
  );
  const value = useMemo(
    () => ({
      sourceId: view?.search.source,
      layout: view?.layout,
      preferences,
      setPreferences,
      userPreferences,
      setUserPreferences,
      sharedPins,
      setSharedPins,
      personalPins,
      setPersonalPins,
    }),
    [
      view?.search.source,
      view?.layout,
      preferences,
      userPreferences,
      sharedPins,
      personalPins,
      setPersonalPins,
    ],
  );
  return <SearchViewContext value={value}>{children}</SearchViewContext>;
}
