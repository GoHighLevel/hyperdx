import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import api from '@/api';
import BulkMemberRoles from '@/components/TeamSettings/BulkMemberRoles';
import { useConfirm } from '@/useConfirm';

jest.mock('@/api', () => ({
  __esModule: true,
  default: { useSetTeamMemberRoles: jest.fn() },
}));
jest.mock('@/useConfirm', () => ({ useConfirm: jest.fn() }));
const mutateAsync = jest.fn();
const confirm = jest.fn();
const members = ['alice', 'bob'].map((name, index) => ({
  _id: String(index),
  name,
  email: `${name}@gohighlevel.com`,
  role: 'developer' as const,
  isCurrentUser: false,
  hasPasswordAuth: true,
}));

beforeEach(() => {
  jest.clearAllMocks();
  jest
    .mocked(api.useSetTeamMemberRoles)
    .mockReturnValue({ mutateAsync, isPending: false } as unknown as ReturnType<
      typeof api.useSetTeamMemberRoles
    >);
  jest.mocked(useConfirm).mockReturnValue(confirm);
});

it('requires a selection and confirms before changing the batch', async () => {
  confirm.mockResolvedValue(true);
  mutateAsync.mockResolvedValue({ updated: 2 });
  renderWithMantine(<BulkMemberRoles members={members} />);
  expect(screen.getByRole('button', { name: 'Make admin' })).toBeDisabled();
  await userEvent.click(
    screen.getByRole('checkbox', { name: 'Select all members' }),
  );
  await userEvent.click(screen.getByRole('button', { name: 'Make admin' }));
  expect(confirm).toHaveBeenCalled();
  expect(mutateAsync).toHaveBeenCalledWith({
    userIds: ['0', '1'],
    role: 'admin',
  });
});

it('does not mutate when the admin cancels', async () => {
  confirm.mockResolvedValue(false);
  renderWithMantine(<BulkMemberRoles members={members} />);
  await userEvent.click(
    screen.getByRole('checkbox', { name: 'Select all members' }),
  );
  await userEvent.click(screen.getByRole('button', { name: 'Make developer' }));
  expect(mutateAsync).not.toHaveBeenCalled();
});
