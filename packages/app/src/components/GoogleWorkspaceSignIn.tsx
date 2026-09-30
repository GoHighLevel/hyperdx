import { Alert, Button, Stack, Text } from '@mantine/core';

import api from '@/api';

import styles from './GoogleWorkspaceSignIn.module.scss';

export default function GoogleWorkspaceSignIn({
  joinToken,
}: {
  joinToken?: string;
}) {
  const { data, isError, isLoading } = api.useGoogleWorkspaceConfig();
  if (isLoading)
    return (
      <Text role="status" ta="center" c="dimmed">
        Loading Google sign-in…
      </Text>
    );
  if (isError)
    return (
      <Alert variant="danger">
        Could not load Google sign-in. Reload to try again.
      </Alert>
    );
  if (!data?.configured)
    return (
      <Alert variant="info">
        Google Workspace sign-in is not configured. Contact your HyperDX admin.
      </Alert>
    );
  return (
    <form method="POST" action="/api/auth/google/start">
      <Stack gap="lg">
        {joinToken && (
          <input type="hidden" name="joinToken" value={joinToken} />
        )}
        <Text size="sm" ta="center" c="dimmed" id="google-workspace-domain">
          Use your{' '}
          <Text component="span" inherit c="var(--color-text-primary)" fw={600}>
            @{data.domain}
          </Text>{' '}
          Google Workspace account.
        </Text>
        <Button
          variant="secondary"
          type="submit"
          fullWidth
          size="md"
          h={48}
          radius="md"
          className={styles.googleButton}
          aria-describedby="google-workspace-domain"
          leftSection={
            <svg
              width="20"
              height="20"
              viewBox="0 0 48 48"
              aria-hidden="true"
              focusable="false"
            >
              <path
                fill="#EA4335"
                d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
              />
              <path
                fill="#4285F4"
                d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
              />
              <path
                fill="#FBBC05"
                d="M10.53 28.59A14.41 14.41 0 0 1 9.75 24c0-1.59.27-3.13.76-4.59l-7.98-6.19A23.7 23.7 0 0 0 0 24c0 3.87.93 7.53 2.56 10.78l7.97-6.19z"
              />
              <path
                fill="#34A853"
                d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
              />
            </svg>
          }
        >
          Continue with Google
        </Button>
        <Text size="xs" c="dimmed" ta="center">
          New here? Your account is created automatically with developer access.
        </Text>
      </Stack>
    </form>
  );
}
