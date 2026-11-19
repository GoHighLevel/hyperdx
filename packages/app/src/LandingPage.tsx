import { useEffect } from 'react';
import { useRouter } from 'next/router';

import api from '@/api';
import AuthLoadingBlocker from '@/AuthLoadingBlocker';
import { IS_LOCAL_MODE } from '@/config';
import { usePermissions } from '@/usePermissions';

export default function LandingPage() {
  const { data: installation } = api.useInstallation();
  const { data: team, isLoading: teamIsLoading } = api.useTeam();
  const { data: me } = api.useMe();
  const { canManageShared } = usePermissions();
  const router = useRouter();

  const isLoggedIn = Boolean(!teamIsLoading && team);

  useEffect(() => {
    if (IS_LOCAL_MODE || (isLoggedIn && me)) {
      router.push(canManageShared ? '/search' : '/dashboards/list');
    }
  }, [isLoggedIn, me, canManageShared, router]);

  useEffect(() => {
    if (teamIsLoading || isLoggedIn || IS_LOCAL_MODE) return;
    if (installation?.isTeamExisting === true) {
      router.push('/login');
    } else if (installation?.isTeamExisting === false) {
      router.push('/register');
    }
  }, [installation, router, teamIsLoading, isLoggedIn]);

  return <AuthLoadingBlocker />;
}
