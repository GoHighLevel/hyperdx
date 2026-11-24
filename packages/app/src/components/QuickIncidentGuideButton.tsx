import dynamic from 'next/dynamic';
import { Button } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconBook } from '@tabler/icons-react';

const QuickIncidentGuideModal = dynamic(
  () => import('./QuickIncidentGuideModal'),
  { ssr: false },
);

export function QuickIncidentGuideButton() {
  const [opened, { open, close }] = useDisclosure(false);

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="xs"
        leftSection={<IconBook size={14} aria-hidden="true" />}
        style={{ flexShrink: 0 }}
        onClick={open}
      >
        Quick incident guide
      </Button>
      {opened && <QuickIncidentGuideModal opened onClose={close} />}
    </>
  );
}
