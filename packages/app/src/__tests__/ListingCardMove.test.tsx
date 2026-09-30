import Router from 'next/router';
import { fireEvent, screen } from '@testing-library/react';

import { ListingCard } from '@/components/ListingCard';

jest.mock('next/router', () => ({ push: jest.fn() }));
jest.mock('../usePermissions', () => ({
  usePermissions: () => ({ canManageShared: true }),
}));
jest.mock('../components/FavoriteButton', () => ({
  FavoriteButton: () => null,
}));
jest.mock('../useFormatTime', () => ({ FormatTime: () => null }));

it('selection and Move never navigate, while the card body still opens the dashboard', () => {
  const onMove = jest.fn();
  const onChange = jest.fn();
  renderWithMantine(
    <ListingCard
      name="API"
      href="/dashboards/one"
      description="Service traffic"
      onMove={onMove}
      selection={{ checked: false, onChange }}
    />,
  );
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select API' }));
  fireEvent.click(screen.getByRole('button', { name: 'Move API' }));
  expect(onChange).toHaveBeenCalledWith(true);
  expect(onMove).toHaveBeenCalledTimes(1);
  expect(Router.push).not.toHaveBeenCalled();
  expect(screen.getByRole('link', { name: 'API' })).toHaveAttribute(
    'href',
    '/dashboards/one',
  );
  fireEvent.click(screen.getByText('Service traffic'));
  expect(Router.push).toHaveBeenCalledWith('/dashboards/one');
});
