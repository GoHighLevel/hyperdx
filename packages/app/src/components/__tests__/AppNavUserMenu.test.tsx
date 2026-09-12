import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  AppNavContext,
  AppNavUserMenu,
} from '@/components/AppNav/AppNav.components';

const renderAppNavUserMenu = (userName?: string) => {
  return renderWithMantine(
    <AppNavContext value={{ isCollapsed: false, pathname: '/' }}>
      <AppNavUserMenu userName={userName} teamName="HyperDX" />
    </AppNavContext>,
  );
};

describe('AppNavUserMenu', () => {
  it('lets an admin enter the developer preview', async () => {
    const onToggle = jest.fn();
    renderWithMantine(<AppNavUserMenu onToggleDeveloperView={onToggle} />);
    await userEvent.click(screen.getByTestId('user-menu-trigger'));
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'View as developer' }),
    );
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('offers a return action while previewing', async () => {
    const onToggle = jest.fn();
    renderWithMantine(
      <AppNavUserMenu isViewingAsDeveloper onToggleDeveloperView={onToggle} />,
    );
    await userEvent.click(screen.getByTestId('user-menu-trigger'));
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'Return to admin view' }),
    );
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('does not offer role preview for a developer', async () => {
    renderAppNavUserMenu('Developer');
    await userEvent.click(screen.getByTestId('user-menu-trigger'));
    await screen.findByTestId('user-preferences-menu-item');
    expect(
      screen.queryByRole('menuitem', { name: 'View as developer' }),
    ).not.toBeInTheDocument();
  });

  it('renders initials for multi-word names with extra whitespace', () => {
    renderAppNavUserMenu('  Ada   Lovelace  ');

    expect(screen.getByText('AL')).toBeInTheDocument();
    expect(screen.getByText(/Ada\s+Lovelace/)).toBeInTheDocument();
  });

  it('falls back to the default user label for blank names', () => {
    renderAppNavUserMenu('   ');

    expect(screen.getByText('U')).toBeInTheDocument();
    expect(screen.getByText('User')).toBeInTheDocument();
  });
});
