import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import DeveloperUISection from '@/components/TeamSettings/DeveloperUISection';

const mockSave = jest.fn();
let mockAdmin = true;
jest.mock('@/usePermissions', () => ({
  usePermissions: () => ({ canManageShared: mockAdmin }),
}));
jest.mock('@/api', () => ({
  __esModule: true,
  default: {
    useMe: () => ({
      data: {
        team: {
          developerUI: {
            defaultSummaryFields: ['deployment_name', 'pod_name'],
          },
        },
      },
    }),
    useUpdateDeveloperUI: () => ({ mutate: mockSave, isPending: false }),
  },
}));

beforeEach(() => {
  mockSave.mockClear();
  mockAdmin = true;
});

it('lets admins reorder, remove and add defaults and submits the ordered list', async () => {
  const user = userEvent.setup();
  render(
    <MantineProvider>
      <DeveloperUISection />
    </MantineProvider>,
  );
  await user.click(screen.getByRole('button', { name: 'Move pod_name up' }));
  await user.click(
    screen.getByRole('button', {
      name: 'Remove deployment_name from field list',
    }),
  );
  await user.type(
    screen.getByRole('combobox', { name: 'Add a field' }),
    'cluster_name',
  );
  await user.click(screen.getByRole('button', { name: 'Add field' }));
  await user.click(
    screen.getByRole('button', { name: 'Save developer layout' }),
  );
  expect(mockSave).toHaveBeenCalledWith(
    expect.objectContaining({
      defaultSummaryFields: ['pod_name', 'cluster_name'],
    }),
    expect.any(Object),
  );
});

it('does not expose team defaults editing to developers', () => {
  mockAdmin = false;
  render(
    <MantineProvider>
      <DeveloperUISection />
    </MantineProvider>,
  );
  expect(screen.queryByText('Default summary fields')).not.toBeInTheDocument();
  expect(mockSave).not.toHaveBeenCalled();
});
