import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { NextSeo } from 'next-seo';
import { HTTPError } from 'ky';
import { SubmitHandler, useForm, useWatch } from 'react-hook-form';
import {
  Box,
  Button,
  Notification,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { IconAt, IconLock } from '@tabler/icons-react';

import GoogleWorkspaceSignIn from './components/GoogleWorkspaceSignIn';
import { useBrandDisplayName } from './theme/ThemeProvider';
import api from './api';
import * as config from './config';
import LandingHeader from './LandingHeader';
import { CheckOrX, PasswordCheck } from './PasswordCheck';

type FormData = {
  email: string;
  password: string;
  confirmPassword: string;
};

export default function AuthPage({ action }: { action: 'register' | 'login' }) {
  const brandName = useBrandDisplayName();
  const { data: team, isLoading: teamIsLoading } = api.useTeam();
  const router = useRouter();

  const isLoggedIn = Boolean(!teamIsLoading && team);

  useEffect(() => {
    if (isLoggedIn) {
      router.push('/');
    }
  }, [isLoggedIn, router]);

  const isRegister = action === 'register';
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
    control,
  } = useForm<FormData>({
    reValidateMode: 'onSubmit',
  });

  const { err, msg } = router.query;

  const { data: installation } = api.useInstallation();
  const registerPassword = api.useRegisterPassword();

  const verificationSent = msg === 'verify';

  const title = `${brandName} - ${isRegister ? 'Sign up' : 'Login'}`;

  useEffect(() => {
    // If an OSS user accidentally lands on /register after already creating a team
    // redirect them to login instead
    if (config.IS_OSS && installation?.isTeamExisting === true && isRegister) {
      router.push('/login');
    }
  }, [installation, isRegister, router]);

  const currentPassword = useWatch({
    control,
    name: 'password',
    defaultValue: '',
  });
  const confirmPassword = useWatch({
    control,
    name: 'confirmPassword',
    defaultValue: '',
  });

  const confirmPass = () => {
    return currentPassword === confirmPassword;
  };

  const onSubmit: SubmitHandler<FormData> = data =>
    registerPassword.mutate(
      {
        email: data.email,
        password: data.password,
        confirmPassword: data.confirmPassword,
      },
      {
        onSuccess: () => router.push('/'),
        onError: async error => {
          if (error instanceof HTTPError) {
            const jsonData = await error.response.json();

            if (Array.isArray(jsonData) && jsonData[0]?.errors?.issues) {
              return jsonData[0].errors.issues.forEach((issue: any) => {
                setError(issue.path[0], {
                  type: issue.code,
                  message: issue.message,
                });
              });
            }
          }
          setError('root', {
            type: 'manual',
            message: 'An unexpected error occurred, please try again later.',
          });
        },
      },
    );

  const form = {
    controller: { onSubmit: handleSubmit(onSubmit) },
    email: register('email', { required: true }),
    password: register('password', { required: true }),
    confirmPassword: register('confirmPassword', { required: true }),
  };

  return (
    <div className="AuthPage">
      <NextSeo title={title} />
      <LandingHeader activeKey={`/${action}`} fixed />
      <Box
        className="d-flex justify-content-center align-items-center"
        mih="100dvh"
        px="md"
        py={96}
      >
        <Box w="100%" maw="28rem">
          <Title order={1} size="h2" ta="center" mb="sm">
            {config.IS_OSS && isRegister
              ? 'Setup '
              : isRegister
                ? 'Register for '
                : 'Sign in to '}
            <span className="text-brand fw-bold">{brandName}</span>
          </Title>
          {action === 'login' && (
            <Text ta="center" c="dimmed" size="sm" mb="xl">
              Logs, traces and metrics in one workspace.
            </Text>
          )}
          {isRegister && config.IS_OSS === true && (
            <div className="text-center mb-2 text-muted">
              Create the first admin account. You can invite users and manage
              their roles in Team settings.
            </div>
          )}
          <Stack gap="lg">
            {!isRegister && (
              <Paper p="xl" withBorder radius="md">
                <GoogleWorkspaceSignIn />
              </Paper>
            )}
            {isRegister && (
              <form className="text-start mt-4" {...form.controller}>
                <Paper p={34} shadow="md" radius="md">
                  <Stack gap="lg">
                    <TextInput
                      label="Email"
                      size="md"
                      withAsterisk={false}
                      placeholder="you@company.com"
                      type="email"
                      leftSection={<IconAt size={18} />}
                      error={errors.email?.message}
                      required
                      {...form.email}
                    />
                    <PasswordInput
                      size="md"
                      label="Password"
                      withAsterisk={false}
                      leftSection={<IconLock size={16} />}
                      error={errors.password?.message}
                      required
                      placeholder="Password"
                      {...form.password}
                    />
                    {isRegister && (
                      <>
                        <PasswordInput
                          label={
                            <CheckOrX
                              handler={confirmPass}
                              password={currentPassword}
                            >
                              Confirm Password
                            </CheckOrX>
                          }
                          size="md"
                          required
                          withAsterisk={false}
                          leftSection={<IconLock size={16} />}
                          error={errors.confirmPassword?.message}
                          placeholder="Confirm Password"
                          {...form.confirmPassword}
                        />
                        <Notification withCloseButton={false}>
                          <PasswordCheck password={currentPassword} />
                        </Notification>
                      </>
                    )}
                    <Button
                      mt={4}
                      type="submit"
                      variant="primary"
                      size="md"
                      disabled={isSubmitting || verificationSent}
                      loading={isSubmitting}
                      data-test-id="submit"
                    >
                      {config.IS_OSS && isRegister
                        ? 'Create'
                        : isRegister
                          ? 'Register'
                          : 'Login'}
                    </Button>
                  </Stack>
                </Paper>
              </form>
            )}

            {err != null && (
              <Notification
                withCloseButton={false}
                withBorder
                color="red"
                data-test-id="auth-error-msg"
              >
                {err === 'googleAuth'
                  ? 'Google sign-in failed. Use your allowed company Workspace account and try again.'
                  : err === 'googleJoinLink'
                    ? 'This joining link has been revoked or replaced. Ask your admin for a new link.'
                    : err === 'googleTeamUnavailable'
                      ? 'Google sign-in could not find your company team. Contact your HyperDX admin.'
                      : err === 'missing'
                        ? 'Please provide a valid email and password'
                        : err === 'invalid'
                          ? 'Email or password is invalid'
                          : err === 'authFail'
                            ? 'Failed to login with email and password, please try again.'
                            : err === 'passwordAuthNotAllowed'
                              ? 'Password authentication is not allowed by your team admin.'
                              : err === 'teamAlreadyExists'
                                ? 'Team already exists, please login instead.'
                                : 'Unknown error occurred, please try again later.'}
              </Notification>
            )}

            {verificationSent && (
              <Notification
                withCloseButton={false}
                withBorder
                color="green"
                data-test-id="auth-msg"
              >
                Sent verification email! Please check your email inbox
              </Notification>
            )}

            {isRegister && config.IS_OSS === false && (
              <div data-test-id="login-link" className="text-center fs-8 ">
                Already have an account? <Link href="/login">Log in</Link>{' '}
                instead.
              </div>
            )}
          </Stack>
        </Box>
      </Box>
    </div>
  );
}
