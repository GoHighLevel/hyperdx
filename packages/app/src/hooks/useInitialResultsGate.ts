import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

/** Give the first log page priority over optional search analytics. */
export function useInitialResultsGate(scope: string, enabled: boolean) {
  const currentScopeRef = useRef(scope);
  const [readyScope, setReadyScope] = useState<string | null>(null);
  useLayoutEffect(() => {
    currentScopeRef.current = scope;
  }, [scope]);
  const markReady = useCallback(() => {
    if (currentScopeRef.current === scope) setReadyScope(scope);
  }, [scope]);
  return { ready: !enabled || readyScope === scope, markReady };
}

/** Signal from the real row stream, without treating placeholders or errors as results. */
export function useNotifyInitialResultsReady(
  data: { data: unknown[] } | null | undefined,
  {
    isFetching,
    isPlaceholderData,
    isError,
    onReady,
  }: {
    isFetching: boolean;
    isPlaceholderData: boolean;
    isError: boolean;
    onReady?: () => void;
  },
) {
  useEffect(() => {
    if (
      data &&
      !isPlaceholderData &&
      !isError &&
      (data.data.length > 0 || !isFetching)
    )
      onReady?.();
  }, [data, isFetching, isPlaceholderData, isError, onReady]);
}
