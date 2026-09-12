import { ActionIcon, Group, Text, Tooltip } from '@mantine/core';

import { useUserPreferences } from '@/useUserPreferences';

const FONT_SIZES = [12, 14, 16, 18] as const;

export default function LogFontSizeControl() {
  const {
    userPreferences: { logFontSize = 14 },
    setUserPreference,
  } = useUserPreferences();
  const index = FONT_SIZES.indexOf(logFontSize);
  return (
    <Group gap={2} wrap="nowrap" role="group" aria-label="Log font size">
      <Tooltip label="Decrease log font size">
        <ActionIcon
          variant="secondary"
          size="sm"
          aria-label="Decrease log font size"
          disabled={index <= 0}
          onClick={() =>
            setUserPreference({ logFontSize: FONT_SIZES[index - 1] })
          }
        >
          A−
        </ActionIcon>
      </Tooltip>
      <Text size="xs" miw={34} ta="center" aria-live="polite">
        {logFontSize}px
      </Text>
      <Tooltip label="Increase log font size">
        <ActionIcon
          variant="secondary"
          size="sm"
          aria-label="Increase log font size"
          disabled={index >= FONT_SIZES.length - 1}
          onClick={() =>
            setUserPreference({ logFontSize: FONT_SIZES[index + 1] })
          }
        >
          A+
        </ActionIcon>
      </Tooltip>
    </Group>
  );
}
