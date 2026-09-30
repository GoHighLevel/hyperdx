import { useState } from 'react';
import { Button } from '@mantine/core';
import { IconFolder } from '@tabler/icons-react';

import { Dashboard } from '@/dashboard';
import { useCanEditDashboard } from '@/dashboardFolders';

import MoveDashboardsDialog from './MoveDashboardsDialog';

export default function MoveDashboardButton({
  dashboard,
}: {
  dashboard: Dashboard;
}) {
  const canEdit = useCanEditDashboard(dashboard);
  const [opened, setOpened] = useState(false);
  if (!canEdit) return null;
  return (
    <>
      <Button
        variant="secondary"
        size="xs"
        leftSection={<IconFolder size={14} />}
        onClick={() => setOpened(true)}
      >
        Move to folder
      </Button>
      {opened && (
        <MoveDashboardsDialog
          dashboards={[dashboard]}
          onClose={() => setOpened(false)}
        />
      )}
    </>
  );
}
