import { render, waitFor } from '@testing-library/react';

import LandingPage from '@/LandingPage';

const mockPush = jest.fn();
const mockRouter = { push: mockPush };
let mockMe: { role: string } | undefined;
let mockLoggedIn = true;
let mockCanManageShared = false;
jest.mock('next/router', () => ({ useRouter: () => mockRouter }));
jest.mock('@/AuthLoadingBlocker', () => () => null);
jest.mock('@/config', () => ({ IS_LOCAL_MODE: false }));
jest.mock('@/usePermissions', () => ({
  usePermissions: () => ({ canManageShared: mockCanManageShared }),
}));
jest.mock('@/api', () => ({
  __esModule: true,
  default: {
    useInstallation: () => ({ data: { isTeamExisting: true } }),
    useTeam: () => ({ data: mockLoggedIn ? {} : undefined, isLoading: false }),
    useMe: () => ({ data: mockMe }),
  },
}));

beforeEach(() => {
  mockPush.mockClear();
  mockLoggedIn = true;
  mockMe = { role: 'developer' };
  mockCanManageShared = false;
});

it('lands developers on dashboards without a competing login redirect', async () => {
  render(<LandingPage />);
  await waitFor(() =>
    expect(mockPush).toHaveBeenCalledWith('/dashboards/list'),
  );
  expect(mockPush).not.toHaveBeenCalledWith('/login');
});

it('waits for the user before choosing a home page', () => {
  mockMe = undefined;
  const { rerender } = render(<LandingPage />);
  expect(mockPush).not.toHaveBeenCalled();
  mockMe = { role: 'admin' };
  mockCanManageShared = true;
  rerender(<LandingPage />);
  expect(mockPush).toHaveBeenCalledWith('/search');
});

it('lands admin previews on dashboards', () => {
  mockMe = { role: 'admin' };
  render(<LandingPage />);
  expect(mockPush).toHaveBeenCalledWith('/dashboards/list');
});

it('sends unauthenticated users to login', () => {
  mockLoggedIn = false;
  mockMe = undefined;
  render(<LandingPage />);
  expect(mockPush).toHaveBeenCalledWith('/login');
});
