import { Text, TextProps } from '@mantine/core';
import {
  IconAlertTriangle,
  IconBug,
  IconCircleX,
  IconDots,
  IconHelpCircle,
  IconInfoCircle,
} from '@tabler/icons-react';

import { getLogLevelClass } from '@/utils';

export default function LogLevel({
  level,
  iconOnly = false,
  inferred = false,
  ...props
}: { level: string; iconOnly?: boolean; inferred?: boolean } & TextProps) {
  const levelClass = getLogLevelClass(level);
  const Icon =
    levelClass === 'error'
      ? IconCircleX
      : levelClass === 'warn'
        ? IconAlertTriangle
        : level === 'debug'
          ? IconBug
          : level === 'trace'
            ? IconDots
            : levelClass === 'info'
              ? IconInfoCircle
              : IconHelpCircle;
  const description =
    levelClass == null
      ? 'not provided or unrecognized'
      : `${level}${inferred ? ' (from log text)' : ''}`;

  return (
    <Text
      component="span"
      size="xs"
      c={
        levelClass === 'error'
          ? 'var(--color-chart-error)'
          : levelClass === 'warn'
            ? 'var(--color-chart-warning)'
            : levelClass === 'info'
              ? 'var(--color-chart-info)'
              : 'var(--color-text-muted)'
      }
      {...props}
    >
      {iconOnly ? (
        <span
          role="img"
          aria-label={`Severity: ${description}`}
          title={description}
        >
          <Icon
            size={16}
            stroke={1.8}
            aria-hidden="true"
            style={{ verticalAlign: 'middle' }}
          />
        </span>
      ) : (
        level
      )}
    </Text>
  );
}
