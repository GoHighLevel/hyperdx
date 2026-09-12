import React from 'react';
import { Provider } from 'jotai';
import { act, renderHook, waitFor } from '@testing-library/react';

import { useDeveloperPreview } from '@/useDeveloperPreview';
import { usePermissions } from '@/usePermissions';

let mockMe: { id: string; team: { id: string }; role: string } | undefined;
jest.mock('@/api', () => ({
  __esModule: true,
  default: { useMe: () => ({ data: mockMe }) },
}));
jest.mock('@/config', () => ({ IS_LOCAL_MODE: false }));
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <Provider>{children}</Provider>
);

beforeEach(() => {
  sessionStorage.clear();
  mockMe = { id: 'admin-1', team: { id: 'team-1' }, role: 'admin' };
});

it('applies developer UI permissions across hook consumers and restores admin view', () => {
  const { result } = renderHook(
    () => ({ preview: useDeveloperPreview(), permissions: usePermissions() }),
    { wrapper },
  );
  expect(result.current.permissions.canManageShared).toBe(true);
  act(() => result.current.preview.setDeveloperPreview(true));
  expect(result.current.preview.isViewingAsDeveloper).toBe(true);
  expect(result.current.permissions.canManageShared).toBe(false);
  expect(mockMe?.role).toBe('admin');
  act(() => result.current.preview.setDeveloperPreview(false));
  expect(result.current.permissions.canManageShared).toBe(true);
});

it('restores preview in the same browser tab after remount', async () => {
  const first = renderHook(useDeveloperPreview, { wrapper });
  act(() => first.result.current.setDeveloperPreview(true));
  first.unmount();
  const second = renderHook(useDeveloperPreview, { wrapper });
  await waitFor(() =>
    expect(second.result.current.isViewingAsDeveloper).toBe(true),
  );
});

it('does not carry the preview into a different user or team', () => {
  const { result, rerender } = renderHook(useDeveloperPreview, { wrapper });
  act(() => result.current.setDeveloperPreview(true));
  mockMe = { id: 'admin-2', team: { id: 'team-1' }, role: 'admin' };
  rerender();
  expect(result.current.isViewingAsDeveloper).toBe(false);
  mockMe = { id: 'admin-1', team: { id: 'team-2' }, role: 'admin' };
  rerender();
  expect(result.current.isViewingAsDeveloper).toBe(false);
});

it('cannot give developers admin UI access, including after a role change', () => {
  const { result, rerender } = renderHook(
    () => ({ preview: useDeveloperPreview(), permissions: usePermissions() }),
    { wrapper },
  );
  act(() => result.current.preview.setDeveloperPreview(true));
  mockMe = { ...mockMe!, role: 'developer' };
  rerender();
  expect(result.current.preview.canPreviewDeveloper).toBe(false);
  expect(result.current.preview.isViewingAsDeveloper).toBe(false);
  act(() => result.current.preview.setDeveloperPreview(false));
  expect(result.current.permissions.canManageShared).toBe(false);
  act(() => result.current.preview.setDeveloperPreview(true));
  expect(result.current.preview.isViewingAsDeveloper).toBe(false);
});

it('does not expose admin controls before the user loads', () => {
  mockMe = undefined;
  const { result } = renderHook(usePermissions, { wrapper });
  expect(result.current.canManageShared).toBe(false);
});
