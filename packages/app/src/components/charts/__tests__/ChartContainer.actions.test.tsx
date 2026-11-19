import { Menu } from '@mantine/core';
import { act, fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ChartContainer, {
  CollapsedToolbarProvider,
} from '@/components/charts/ChartContainer';
import DisplaySwitcher from '@/components/charts/DisplaySwitcher';

describe('compact panel actions', () => {
  it('names display modes, exposes selection and preserves disabled controls', async () => {
    const onChange = jest.fn();
    renderWithMantine(
      <DisplaySwitcher
        value="line"
        onChange={onChange}
        options={[
          { label: 'Line chart', value: 'line', icon: <span /> },
          { label: 'Bar chart', value: 'bar', icon: <span /> },
          { label: 'Table', value: 'table', icon: <span />, disabled: true },
        ]}
      />,
    );
    expect(screen.getByRole('button', { name: 'Line chart' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    const bar = screen.getByRole('button', { name: 'Bar chart' });
    expect(bar).toHaveAttribute('aria-pressed', 'false');
    act(() => bar.focus());
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Bar chart');
    await userEvent.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith('bar');
    expect(screen.getByRole('button', { name: 'Table' })).toBeDisabled();
  });

  it('has a name before hover, explains itself on focus, and opens from the keyboard', async () => {
    const onEdit = jest.fn();
    renderWithMantine(
      <CollapsedToolbarProvider
        suffixCount={1}
        menuItems={<Menu.Item onClick={onEdit}>Edit</Menu.Item>}
      >
        <ChartContainer
          title="Requests"
          toolbarItems={[<span key="actions">Wide actions</span>]}
        >
          <span>Chart data</span>
        </ChartContainer>
      </CollapsedToolbarProvider>,
    );
    const button = screen.getByRole('button', { name: 'Panel actions' });
    act(() => button.focus());
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'Panel actions',
    );
    await userEvent.keyboard('{Enter}');
    const edit = await screen.findByRole('menuitem', { name: 'Edit' });
    fireEvent.click(edit);
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(button.closest('[data-dashboard-no-drag]')).not.toBeNull();
  });
});
