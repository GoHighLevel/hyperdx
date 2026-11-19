import { useEffect, useRef } from 'react';

// Scroll events also come from layout/virtualizer corrections. Only wheel,
// touch, keyboard, or a scrollbar drag can authorize another page.
export default function useLogScrollLoad({
  enabled,
  blocked,
  canLoad,
  load,
}: {
  enabled: boolean;
  blocked: boolean;
  canLoad: boolean;
  load?: () => unknown;
}) {
  const intentRef = useRef({ at: Number.NEGATIVE_INFINITY, consumed: false });
  const pendingRef = useRef(false);
  const touchYRef = useRef<number | undefined>(undefined);
  const draggingRef = useRef(false);
  const scrollTopRef = useRef(0);
  useEffect(() => {
    const release = () => {
      draggingRef.current = false;
    };
    document.addEventListener('pointerup', release);
    document.addEventListener('pointercancel', release);
    return () => {
      document.removeEventListener('pointerup', release);
      document.removeEventListener('pointercancel', release);
    };
  }, []);

  const request = () => {
    if (!enabled || blocked || !canLoad || pendingRef.current || !load) return;
    pendingRef.current = true;
    intentRef.current.consumed = true;
    Promise.resolve(load())
      .catch(() => {
        // The query hook owns and displays the error; another gesture retries.
      })
      .finally(() => {
        pendingRef.current = false;
      });
  };
  const atBottom = (element: HTMLDivElement) =>
    element.scrollHeight - element.scrollTop - element.clientHeight <= 2;
  const downwardIntent = (element: HTMLDivElement, wheel = false) => {
    const now = performance.now();
    if (wheel && now - intentRef.current.at > 250)
      intentRef.current.consumed = false;
    intentRef.current.at = now;
    if (!intentRef.current.consumed && atBottom(element)) request();
  };
  return {
    request,
    cancelIntent: () => {
      intentRef.current = { at: Number.NEGATIVE_INFINITY, consumed: true };
      draggingRef.current = false;
      touchYRef.current = undefined;
    },
    handlers: {
      onWheel: (event: React.WheelEvent<HTMLDivElement>) => {
        if (event.deltaY > 0 && Math.abs(event.deltaY) > Math.abs(event.deltaX))
          downwardIntent(event.currentTarget, true);
      },
      onTouchStart: (event: React.TouchEvent<HTMLDivElement>) => {
        touchYRef.current = event.touches[0]?.clientY;
        intentRef.current.consumed = false;
      },
      onTouchMove: (event: React.TouchEvent<HTMLDivElement>) => {
        const y = event.touches[0]?.clientY;
        if (y != null && touchYRef.current != null && y < touchYRef.current)
          downwardIntent(event.currentTarget);
        touchYRef.current = y;
      },
      onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (
          event.target !== event.currentTarget ||
          event.repeat ||
          event.shiftKey
        )
          return;
        if (['ArrowDown', 'PageDown', 'End', ' '].includes(event.key)) {
          intentRef.current.consumed = false;
          downwardIntent(event.currentTarget);
        }
      },
      onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => {
        draggingRef.current = event.target === event.currentTarget;
        intentRef.current.consumed = false;
      },
      onPointerUp: () => {
        draggingRef.current = false;
      },
      onPointerCancel: () => {
        draggingRef.current = false;
      },
      onScroll: (event: React.UIEvent<HTMLDivElement>) => {
        if (event.target !== event.currentTarget) return;
        const element = event.currentTarget;
        const movedDown = element.scrollTop > scrollTopRef.current;
        scrollTopRef.current = element.scrollTop;
        if (
          movedDown &&
          !intentRef.current.consumed &&
          atBottom(element) &&
          (draggingRef.current ||
            performance.now() - intentRef.current.at <= 250)
        )
          request();
      },
    },
  };
}
