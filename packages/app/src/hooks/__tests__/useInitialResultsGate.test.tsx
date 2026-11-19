import { act, renderHook } from '@testing-library/react';

import {
  useInitialResultsGate,
  useNotifyInitialResultsReady,
} from '@/hooks/useInitialResultsGate';

it('releases independent background queries after first results and resets for a new search', () => {
  const { result, rerender } = renderHook(
    ({ scope }) => useInitialResultsGate(scope, true),
    { initialProps: { scope: 'billing-30m' } },
  );
  expect(result.current.ready).toBe(false);
  const staleCallback = result.current.markReady;
  act(() => result.current.markReady());
  expect(result.current.ready).toBe(true);
  rerender({ scope: 'contacts-30m' });
  expect(result.current.ready).toBe(false);
  act(() => staleCallback());
  expect(result.current.ready).toBe(false);
  act(() => result.current.markReady());
  act(() => staleCallback());
  expect(result.current.ready).toBe(true);
});

it('does not gate other search types', () => {
  const { result } = renderHook(() => useInitialResultsGate('traces', false));
  expect(result.current.ready).toBe(true);
});

it('signals streamed rows before completion, but waits on an empty in-flight page', () => {
  const onReady = jest.fn();
  const { rerender } = renderHook(
    ({ hasRows, isFetching }) =>
      useNotifyInitialResultsReady(
        { data: hasRows ? [{}] : [] },
        {
          isFetching,
          isPlaceholderData: false,
          isError: false,
          onReady,
        },
      ),
    { initialProps: { hasRows: false, isFetching: true } },
  );
  expect(onReady).not.toHaveBeenCalled();
  rerender({ hasRows: true, isFetching: true });
  expect(onReady).toHaveBeenCalledTimes(1);
});
it('releases a successful empty page and rejects placeholder data and errors', () => {
  const onReady = jest.fn();
  const { rerender } = renderHook(
    ({ placeholder, error }) =>
      useNotifyInitialResultsReady(
        { data: [] },
        {
          isFetching: false,
          isPlaceholderData: placeholder,
          isError: error,
          onReady,
        },
      ),
    { initialProps: { placeholder: true, error: false } },
  );
  expect(onReady).not.toHaveBeenCalled();
  rerender({ placeholder: false, error: true });
  expect(onReady).not.toHaveBeenCalled();
  rerender({ placeholder: false, error: false });
  expect(onReady).toHaveBeenCalledTimes(1);
});
it('does not signal a failed request without any data', () => {
  const onReady = jest.fn();
  renderHook(() =>
    useNotifyInitialResultsReady(undefined, {
      isFetching: false,
      isPlaceholderData: false,
      isError: true,
      onReady,
    }),
  );
  expect(onReady).not.toHaveBeenCalled();
});
