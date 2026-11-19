import { useEffect } from 'react';
import { useAtom } from 'jotai';
import { atomWithStorage, createJSONStorage } from 'jotai/utils';
import { parseAsStringEnum, useQueryState } from 'nuqs';

import api from '@/api';
import { IS_LOCAL_MODE } from '@/config';

// UI preview only: never changes the authenticated user or their database role.
// Session storage keeps other browser tabs independent; identity scopes reloads.
const developerPreviewAtom = atomWithStorage<string | null>(
  'hdx-developer-preview',
  null,
  createJSONStorage(() => sessionStorage),
);

export function useDeveloperPreview() {
  const { data: me } = api.useMe();
  const [requestedView, setRequestedView] = useQueryState(
    'view',
    parseAsStringEnum<'developer'>(['developer']).withOptions({
      history: 'replace',
    }),
  );
  const [previewIdentity, setPreviewIdentity] = useAtom(developerPreviewAtom);
  const canPreviewDeveloper = !IS_LOCAL_MODE && me?.role === 'admin';
  const identity = me ? JSON.stringify([me.id, me.team.id]) : null;
  const isViewingAsDeveloper =
    canPreviewDeveloper &&
    (requestedView === 'developer' || previewIdentity === identity);

  useEffect(() => {
    if (canPreviewDeveloper && requestedView === 'developer') {
      setPreviewIdentity(identity);
    }
  }, [canPreviewDeveloper, requestedView, identity, setPreviewIdentity]);

  return {
    canPreviewDeveloper,
    isViewingAsDeveloper,
    setDeveloperPreview: (enabled: boolean) => {
      if (canPreviewDeveloper) {
        setPreviewIdentity(enabled ? identity : null);
        void setRequestedView(enabled ? 'developer' : null);
      }
    },
  };
}
