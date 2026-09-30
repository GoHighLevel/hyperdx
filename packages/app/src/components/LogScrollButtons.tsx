import { useCallback, useEffect, useRef } from 'react';
import { ActionIcon, Group, Tooltip } from '@mantine/core';
import { IconArrowBarDown, IconArrowBarUp } from '@tabler/icons-react';

export type LogEdgeNavigation = {
  id: number;
  edge: 'start' | 'latest';
  status: 'loading' | 'success' | 'error';
};

export default function LogScrollButtons({
  container,
  disabled,
  beforeScroll,
  onJumpToStart,
  onJumpToLatest,
  navigation,
}: {
  container: HTMLDivElement | null;
  disabled: boolean;
  beforeScroll: () => void;
  onJumpToStart?: () => void;
  onJumpToLatest?: () => void;
  navigation?: LogEdgeNavigation;
}) {
  const frameRef = useRef<number | undefined>(undefined);
  const cancel = useCallback(() => {
    if (frameRef.current != null) cancelAnimationFrame(frameRef.current);
    frameRef.current = undefined;
  }, []);

  useEffect(() => {
    // A new user gesture always takes priority over a pending jump.
    const events = ['wheel', 'touchstart', 'pointerdown', 'keydown'];
    events.forEach(event => container?.addEventListener(event, cancel, true));
    return () => {
      cancel();
      events.forEach(event =>
        container?.removeEventListener(event, cancel, true),
      );
    };
  }, [container, cancel]);

  const move = useCallback(
    (bottom: boolean) => {
      cancel();
      if (!container || disabled) return;
      beforeScroll();
      if (!bottom) {
        container.scrollTop = 0;
        return;
      }
      // Virtual rows change height as they enter the viewport. Settle at the
      // actual bottom (including the footer), without smooth scrolling or fetches.
      let previousHeight = -1;
      let stableFrames = 0;
      let remainingFrames = 30;
      const settle = () => {
        frameRef.current = undefined;
        const height = container.scrollHeight;
        const bottomOffset = Math.max(0, height - container.clientHeight);
        stableFrames =
          height === previousHeight &&
          Math.abs(container.scrollTop - bottomOffset) <= 2
            ? stableFrames + 1
            : 0;
        previousHeight = height;
        container.scrollTop = bottomOffset;
        if (stableFrames < 2 && --remainingFrames > 0)
          frameRef.current = requestAnimationFrame(settle);
      };
      settle();
    },
    [beforeScroll, cancel, container, disabled],
  );

  const handledNavigationRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!navigation) {
      handledNavigationRef.current = undefined;
    } else if (
      navigation.status === 'success' &&
      !disabled &&
      container != null &&
      handledNavigationRef.current !== navigation.id
    ) {
      // The new page is now rendered. Never scroll the old page while its
      // replacement is loading, or after that replacement failed.
      handledNavigationRef.current = navigation.id;
      move(navigation.edge === 'latest');
    }
  }, [navigation, move, disabled, container]);

  const jump = (bottom: boolean) => {
    cancel();
    beforeScroll();
    const request = bottom ? onJumpToLatest : onJumpToStart;
    if (request) request();
    else move(bottom);
  };
  const blocked = disabled || !container || navigation?.status === 'loading';

  return (
    <Group gap={2} wrap="nowrap" data-dashboard-no-drag>
      <Tooltip
        label={
          onJumpToStart
            ? 'Load earliest logs in the selected range'
            : 'Go to top of loaded logs'
        }
      >
        <ActionIcon
          variant="subtle"
          size="sm"
          aria-label={onJumpToStart ? 'Go to earliest logs' : 'Go to top'}
          disabled={blocked}
          onClick={() => jump(false)}
        >
          <IconArrowBarUp size={16} aria-hidden="true" />
        </ActionIcon>
      </Tooltip>
      <Tooltip
        label={
          onJumpToLatest
            ? 'Load latest matching logs'
            : 'Go to bottom of loaded logs'
        }
      >
        <ActionIcon
          variant="subtle"
          size="sm"
          aria-label={onJumpToLatest ? 'Go to latest logs' : 'Go to bottom'}
          disabled={blocked}
          onClick={() => jump(true)}
        >
          <IconArrowBarDown size={16} aria-hidden="true" />
        </ActionIcon>
      </Tooltip>
    </Group>
  );
}
