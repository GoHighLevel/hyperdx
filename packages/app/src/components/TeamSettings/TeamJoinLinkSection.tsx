import { useState } from 'react';
import {
  Alert,
  Button,
  CopyButton,
  Group,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';

import api from '@/api';
import { useConfirm } from '@/useConfirm';

export default function TeamJoinLinkSection() {
  const { data, isLoading, isError } = api.useTeamJoinLink();
  const create = api.useCreateTeamJoinLink();
  const revoke = api.useRevokeTeamJoinLink();
  const confirm = useConfirm();
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const busy = create.isPending || revoke.isPending;
  const change = async (action: 'create' | 'revoke') => {
    if (
      data?.active &&
      !(await confirm(
        action === 'revoke'
          ? 'Revoke the joining link? Existing members keep access. New users will need a new link.'
          : 'Replace the joining link? The previous link will stop working.',
        action === 'revoke' ? 'Revoke link' : 'Replace link',
        { variant: 'danger' },
      ))
    )
      return;
    setError('');
    try {
      if (action === 'create') setUrl((await create.mutateAsync()).url);
      else {
        await revoke.mutateAsync();
        setUrl('');
      }
    } catch {
      setError('Could not update the joining link. Please try again.');
    }
  };
  if (isLoading) return <Text role="status">Loading joining link…</Text>;
  if (isError)
    return (
      <Alert variant="danger">Could not load joining link settings.</Alert>
    );
  return (
    <Stack gap="sm" my="md">
      <Text fw={600}>Company joining link</Text>
      {!data?.configured ? (
        <Alert variant="info">
          Google Workspace sign-in needs an OAuth client, secret, callback URL,
          and allowed domain configured by your operator.
        </Alert>
      ) : (
        <>
          <Text size="sm">
            Anyone with a verified @{data.domain} Google Workspace account can
            use this link to join as a developer.
          </Text>
          <Group>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => change('create')}
            >
              {data.active ? 'Replace joining link' : 'Create joining link'}
            </Button>
            {data.active && (
              <Button
                variant="danger"
                disabled={busy}
                onClick={() => change('revoke')}
              >
                Revoke joining link
              </Button>
            )}
          </Group>
          {url ? (
            <>
              <TextInput label="Joining link" readOnly value={url} />
              <CopyButton value={url}>
                {({ copied, copy }) => (
                  <Button variant="secondary" onClick={copy}>
                    {copied ? 'Copied' : 'Copy joining link'}
                  </Button>
                )}
              </CopyButton>
              <Text size="xs" c="dimmed">
                This link is shown only once. Save a copy before leaving this
                page.
              </Text>
            </>
          ) : (
            data.active && (
              <Text size="sm">
                A joining link is active. Replace it if you need a new copy.
              </Text>
            )
          )}
        </>
      )}
      {error && <Alert variant="danger">{error}</Alert>}
    </Stack>
  );
}
