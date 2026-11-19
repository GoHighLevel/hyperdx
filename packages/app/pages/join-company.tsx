import { useEffect, useState } from 'react';
import { NextSeo } from 'next-seo';
import { Alert, Center, Paper, Stack, Title } from '@mantine/core';

import GoogleWorkspaceSignIn from '@/components/GoogleWorkspaceSignIn';

export default function JoinCompanyPage() {
  const [token, setToken] = useState<string>();
  useEffect(() => {
    const value =
      new URLSearchParams(window.location.hash.slice(1)).get('token') ?? '';
    setToken(/^[a-f0-9]{64}$/.test(value) ? value : '');
  }, []);
  return (
    <Center mih="100vh" p="md">
      <NextSeo
        title="Join your HyperDX team"
        noindex
        nofollow
        additionalMetaTags={[{ name: 'referrer', content: 'no-referrer' }]}
      />
      <Paper p="xl" withBorder maw={440} w="100%">
        <Stack>
          <Title order={1} size="h3">
            Join your HyperDX team
          </Title>
          {token === '' ? (
            <Alert variant="danger">
              This joining link is incomplete. Ask your admin for the full link.
            </Alert>
          ) : (
            token && <GoogleWorkspaceSignIn joinToken={token} />
          )}
        </Stack>
      </Paper>
    </Center>
  );
}
