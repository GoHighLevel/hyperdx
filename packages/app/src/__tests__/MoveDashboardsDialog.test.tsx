import { fireEvent, screen, waitFor } from '@testing-library/react';

import MoveDashboardsDialog from '@/components/Dashboards/MoveDashboardsDialog';
import { Dashboard } from '@/dashboard';

const mockUpdate = jest.fn();
const mockCreate = jest.fn();
let mockAdmin = true;
jest.mock('../dashboard', () => ({
  useUpdateDashboard: () => ({ mutateAsync: mockUpdate }),
}));
jest.mock('../usePermissions', () => ({
  usePermissions: () => ({ canManageShared: mockAdmin }),
}));
jest.mock('../dashboardFolders', () => ({
  useDashboardFolders: () => ({
    data: [
      { id: 'admin', name: 'Runbooks', access: 'admin' },
      { id: 'team', name: 'Investigations', access: 'team' },
    ],
  }),
  useSaveDashboardFolder: () => ({
    mutate: mockCreate,
    reset: jest.fn(),
    isPending: false,
  }),
}));

const dashboards: Dashboard[] = [
  { id: 'one', name: 'API', tags: [], tiles: [] },
  { id: 'two', name: 'Workers', tags: [], tiles: [] },
];
const chooseFolder = async (name: string) => {
  fireEvent.click(screen.getByRole('combobox'));
  fireEvent.click(await screen.findByRole('option', { name }));
};

beforeEach(() => {
  jest.clearAllMocks();
  mockAdmin = true;
  mockUpdate.mockReset();
});

it('requires an explicit destination and changes only folder assignments', async () => {
  const onMoved = jest.fn();
  const onClose = jest.fn();
  mockUpdate.mockResolvedValue({});
  renderWithMantine(
    <MoveDashboardsDialog
      dashboards={dashboards}
      onClose={onClose}
      onMoved={onMoved}
    />,
  );
  expect(
    screen.getByRole('button', { name: 'Move 2 dashboards' }),
  ).toBeDisabled();
  await chooseFolder('Runbooks');
  fireEvent.click(screen.getByRole('button', { name: 'Move 2 dashboards' }));
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  expect(mockUpdate.mock.calls).toEqual([
    [{ id: 'one', folderId: 'admin' }],
    [{ id: 'two', folderId: 'admin' }],
  ]);
  expect(onMoved).toHaveBeenCalledWith(['one', 'two'], 'admin');
});

it('reports partial failures and retries only failed dashboards', async () => {
  const onClose = jest.fn();
  mockUpdate
    .mockResolvedValueOnce({})
    .mockRejectedValueOnce(new Error('Forbidden'))
    .mockResolvedValueOnce({});
  renderWithMantine(
    <MoveDashboardsDialog dashboards={dashboards} onClose={onClose} />,
  );
  await chooseFolder('Investigations');
  fireEvent.click(screen.getByRole('button', { name: 'Move 2 dashboards' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    '1 moved. Could not move Workers',
  );
  expect(onClose).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Retry failed moves' }));
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  expect(mockUpdate.mock.calls.map(call => call[0].id)).toEqual([
    'one',
    'two',
    'two',
  ]);
});

it('offers developers only collaborative folders', async () => {
  mockAdmin = false;
  renderWithMantine(
    <MoveDashboardsDialog dashboards={dashboards} onClose={jest.fn()} />,
  );
  fireEvent.click(screen.getByRole('combobox'));
  await waitFor(() =>
    expect(
      screen.getByRole('option', { name: 'Investigations' }),
    ).toBeVisible(),
  );
  expect(
    screen.queryByRole('option', { name: 'Runbooks' }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('option', { name: /General/ }),
  ).not.toBeInTheDocument();
});

it('allows admins to explicitly move dashboards back to General', async () => {
  mockUpdate.mockResolvedValue({});
  renderWithMantine(
    <MoveDashboardsDialog dashboards={[dashboards[0]]} onClose={jest.fn()} />,
  );
  await chooseFolder('General (admins only)');
  fireEvent.click(screen.getByRole('button', { name: 'Move dashboard' }));
  await waitFor(() =>
    expect(mockUpdate).toHaveBeenCalledWith({ id: 'one', folderId: null }),
  );
});

it('creates a destination inside the move dialog', async () => {
  mockCreate.mockImplementation((_input, callbacks) =>
    callbacks.onSuccess({ id: 'team' }),
  );
  mockUpdate.mockResolvedValue({});
  renderWithMantine(
    <MoveDashboardsDialog dashboards={[dashboards[0]]} onClose={jest.fn()} />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'New folder' }));
  fireEvent.change(screen.getByLabelText('New folder name'), {
    target: { value: 'Investigations' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Create folder' }));
  expect(mockCreate).toHaveBeenCalledWith(
    { name: 'Investigations' },
    expect.any(Object),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Move dashboard' }));
  await waitFor(() =>
    expect(mockUpdate).toHaveBeenCalledWith({ id: 'one', folderId: 'team' }),
  );
});
