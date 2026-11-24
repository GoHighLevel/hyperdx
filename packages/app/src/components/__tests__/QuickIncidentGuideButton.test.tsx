import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { QuickIncidentGuideButton } from '@/components/QuickIncidentGuideButton';

jest.mock('next/dynamic', () => ({
  __esModule: true,
  default: () =>
    jest.requireActual('@/components/QuickIncidentGuideModal').default,
}));

it('loads the guide only when requested and closes it without leaving search', async () => {
  render(<QuickIncidentGuideButton />, { wrapper: MantineProvider });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  await userEvent.click(
    screen.getByRole('button', { name: 'Quick incident guide' }),
  );
  expect(
    await screen.findByRole('dialog', {
      name: 'Quick guide for incident scenarios',
    }),
  ).toBeVisible();
  await userEvent.keyboard('{Escape}');
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  );
});

it('does not submit or change the search form', () => {
  const onSubmit = jest.fn(event => event.preventDefault());
  render(
    <form onSubmit={onSubmit}>
      <QuickIncidentGuideButton />
    </form>,
    { wrapper: MantineProvider },
  );
  fireEvent.click(screen.getByRole('button', { name: 'Quick incident guide' }));
  expect(onSubmit).not.toHaveBeenCalled();
});
