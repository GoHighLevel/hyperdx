import { SourceKind, TSource } from '@hyperdx/common-utils/dist/types';
import { MantineProvider, Popover } from '@mantine/core';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import SnapGridLayout from '@/components/dashboard/SnapGridLayout';
import { RawLogTable } from '@/components/DBRowTable';
import * as useChartConfigModule from '@/hooks/useChartConfig';

jest.mock('@/usePermissions', () => ({
  usePermissions: () => ({ canManageShared: true }),
}));
jest.mock('@/api', () => ({
  __esModule: true,
  default: { useMe: () => ({ data: { email: 'dismissal@example.com' } }) },
}));
jest.mock('nuqs', () => ({
  ...jest.requireActual('nuqs'),
  useQueryState: () => [null, jest.fn()],
}));

describe('log summary field picker dismissal', () => {
  beforeEach(() => {
    window.localStorage.clear();
    jest
      .spyOn(useChartConfigModule, 'useAliasMapFromChartConfig')
      .mockReturnValue({
        data: {},
        isLoading: false,
        error: null,
      } as any);
    jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 1200,
      bottom: 600,
      width: 1200,
      height: 600,
      toJSON: () => ({}),
    });
    jest
      .spyOn(HTMLElement.prototype, 'offsetHeight', 'get')
      .mockReturnValue(600);
    jest
      .spyOn(HTMLElement.prototype, 'offsetWidth', 'get')
      .mockReturnValue(1200);
    jest
      .spyOn(HTMLElement.prototype, 'offsetParent', 'get')
      .mockReturnValue(document.body);
  });

  afterEach(() => jest.restoreAllMocks());

  async function openPickerWithExpandedRow(inDashboard = false) {
    const user = userEvent.setup();
    const onDragStart = jest.fn();
    const table = (
      <RawLogTable
        displayedColumns={['log']}
        rows={[
          {
            log: 'Request completed',
            deployment_name: 'contacts-external-api',
          },
        ]}
        source={{ id: 'dismissal-source', kind: SourceKind.Log } as TSource}
        columnTypeMap={new Map()}
        generateRowId={() => ({ where: 'id=1', aliasWith: [] })}
        onRowDetailsClick={jest.fn()}
        renderRowDetails={() => (
          <>
            <p>Expanded event details</p>
          </>
        )}
      />
    );
    render(
      <MantineProvider
        theme={{
          components: {
            Popover: Popover.extend({
              defaultProps: {
                hideDetached: false,
                transitionProps: { duration: 0 },
              },
            }),
          },
        }}
      >
        {inDashboard ? (
          <SnapGridLayout
            layout={[{ i: 'logs', x: 0, y: 0, w: 12, h: 4 }]}
            onDragStart={onDragStart}
          >
            <div key="logs">
              <div data-dashboard-no-drag>{table}</div>
            </div>
          </SnapGridLayout>
        ) : (
          table
        )}
      </MantineProvider>,
    );
    await user.click(
      await screen.findByRole('button', { name: 'Expand log details' }),
    );
    await user.click(screen.getByRole('button', { name: 'Add fields' }));
    await waitFor(() =>
      expect(screen.getByText('Your summary fields')).toBeVisible(),
    );
    // MantineProvider env="test" disables portals and would mask grid dragging
    // caused by events bubbling from portaled controls through their React owner.
    expect(
      screen.getByText('Your summary fields').closest('[data-portal]'),
    ).not.toBeNull();
    expect(
      screen
        .getByText('Your summary fields')
        .closest('[data-dashboard-no-drag]'),
    ).toBeNull();
    return { user, onDragStart };
  }

  it('closes when clicking expanded row content', async () => {
    const { user } = await openPickerWithExpandedRow();
    await user.click(screen.getByText('Expanded event details'));
    await waitFor(() =>
      expect(screen.queryByText('Your summary fields')).not.toBeInTheDocument(),
    );
  });

  it('dismisses inside a dashboard tile without initiating grid drag', async () => {
    const { user, onDragStart } = await openPickerWithExpandedRow(true);
    await user.click(screen.getByText('Expanded event details'));
    await waitFor(() =>
      expect(screen.queryByText('Your summary fields')).not.toBeInTheDocument(),
    );
    expect(onDragStart).not.toHaveBeenCalled();
  });

  it('keeps nested field suggestions usable and closes after clicking outside', async () => {
    const { user, onDragStart } = await openPickerWithExpandedRow(true);
    await user.type(
      screen.getByRole('combobox', { name: 'Add a field' }),
      'container',
    );
    await user.click(
      await screen.findByRole('option', { name: 'container_name' }),
    );
    await user.click(screen.getByRole('button', { name: 'Add field' }));
    expect(
      screen.getByRole('checkbox', { name: 'container_name' }),
    ).toBeChecked();
    await user.click(screen.getByText('Expanded event details'));
    await waitFor(() =>
      expect(screen.queryByText('Your summary fields')).not.toBeInTheDocument(),
    );
    await user.click(screen.getByRole('button', { name: 'Add fields' }));
    expect(
      screen.getByRole('checkbox', { name: 'container_name' }),
    ).toBeChecked();
    expect(onDragStart).not.toHaveBeenCalled();
  });

  it('preserves caller drag exclusions and still allows dragging the tile header', async () => {
    const user = userEvent.setup();
    const onDragStart = jest.fn();
    const onDrag = jest.fn();
    render(
      <SnapGridLayout
        layout={[{ i: 'tile', x: 0, y: 0, w: 4, h: 2 }]}
        draggableCancel=".custom-control"
        onDragStart={onDragStart}
        onDrag={onDrag}
      >
        <div key="tile">
          <span>Drag tile header</span>
          <div data-dashboard-no-drag>
            <button type="button">Chart control</button>
          </div>
          <button type="button" className="custom-control">
            Custom control
          </button>
        </div>
      </SnapGridLayout>,
    );
    await user.click(screen.getByRole('button', { name: 'Chart control' }));
    await user.click(screen.getByRole('button', { name: 'Custom control' }));
    expect(onDragStart).not.toHaveBeenCalled();
    const header = screen.getByText('Drag tile header');
    await user.pointer([
      {
        keys: '[MouseLeft>]',
        target: header,
        coords: { clientX: 10, clientY: 10 },
      },
      { coords: { clientX: 110, clientY: 110 } },
      { keys: '[/MouseLeft]' },
    ]);
    expect(onDragStart).toHaveBeenCalledTimes(1);
    expect(onDrag).toHaveBeenCalled();
  });
});
