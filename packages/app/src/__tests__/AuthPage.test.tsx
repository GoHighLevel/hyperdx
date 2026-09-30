import { screen } from '@testing-library/react';

import AuthPage from '@/AuthPage';

const mockQuery: Record<string, string> = {};
const mockGoogleConfig = {
  data: { configured: true, domain: 'gohighlevel.com' },
  isLoading: false,
  isError: false,
};
jest.mock('next/router', () => ({
  useRouter: () => ({ query: mockQuery, push: jest.fn() }),
}));
jest.mock('next-seo', () => ({ NextSeo: () => null }));
jest.mock('../LandingHeader', () => () => null);
jest.mock('../theme/ThemeProvider', () => ({
  useBrandDisplayName: () => 'HyperDX',
}));
jest.mock('../config', () => ({ IS_OSS: true }));
jest.mock('../api', () => ({
  __esModule: true,
  default: {
    useTeam: () => ({ data: undefined, isLoading: false }),
    useInstallation: () => ({ data: { isTeamExisting: false } }),
    useRegisterPassword: () => ({ mutate: jest.fn() }),
    useGoogleWorkspaceConfig: () => mockGoogleConfig,
  },
}));

beforeEach(() => {
  delete mockQuery.err;
  mockGoogleConfig.data.configured = true;
  mockGoogleConfig.isLoading = false;
  mockGoogleConfig.isError = false;
});

it('offers Google login without email or password controls', () => {
  const { container } = renderWithMantine(<AuthPage action="login" />);
  const button = screen.getByRole('button', { name: 'Continue with Google' });
  expect(button.closest('form')).toHaveAttribute('method', 'POST');
  expect(button.closest('form')).toHaveAttribute(
    'action',
    '/api/auth/google/start',
  );
  expect(container.querySelector('input')).toBeNull();
  expect(container.querySelector('form form')).toBeNull();
});

it('keeps first-time administrator setup available', () => {
  renderWithMantine(<AuthPage action="register" />);
  expect(screen.getByLabelText('Email')).toBeRequired();
  expect(screen.getByLabelText('Password', { exact: true })).toBeRequired();
  expect(
    screen.queryByRole('button', { name: 'Continue with Google' }),
  ).toBeNull();
});

it('keeps OAuth errors visible outside the removed password form', () => {
  mockQuery.err = 'googleAuth';
  renderWithMantine(<AuthPage action="login" />);
  expect(screen.getByText(/Google sign-in failed/)).toBeVisible();
});

it.each(['loading', 'error', 'unconfigured'])(
  'shows the %s sign-in state',
  state => {
    mockGoogleConfig.isLoading = state === 'loading';
    mockGoogleConfig.isError = state === 'error';
    mockGoogleConfig.data.configured = state !== 'unconfigured';
    renderWithMantine(<AuthPage action="login" />);
    expect(
      screen.getByText(
        state === 'loading'
          ? /Loading Google sign-in/
          : state === 'error'
            ? /Could not load Google sign-in/
            : /Google Workspace sign-in is not configured/,
      ),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Continue with Google' }),
    ).toBeNull();
  },
);
