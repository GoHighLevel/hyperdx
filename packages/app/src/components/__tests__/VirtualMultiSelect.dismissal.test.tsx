import { useState } from 'react';
import { MantineProvider, Popover } from '@mantine/core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { VirtualMultiSelect } from '@/components/VirtualMultiSelect/VirtualMultiSelect';

function Harness() {
  const [values, setValues] = useState<string[]>([]);
  return (
    <MantineProvider
      theme={{
        components: {
          Popover: Popover.extend({
            defaultProps: {
              // jsdom has no layout, so every target would appear detached.
              hideDetached: false,
              transitionProps: { duration: 0 },
            },
          }),
        },
      }}
    >
      <VirtualMultiSelect
        data={[]}
        placeholder="Cluster"
        values={values}
        onChange={setValues}
      />
      <div data-testid="outside">Dashboard background</div>
      <output data-testid="selected">{values.join(',')}</output>
    </MantineProvider>
  );
}

describe('VirtualMultiSelect dismissal', () => {
  it.each(['mouse', 'touch', 'Escape'])(
    'dismisses on %s and preserves a selected custom value when reopened',
    async interaction => {
      render(<Harness />);
      const input = screen.getByPlaceholderText('Cluster');
      await userEvent.type(input, 'production{Enter}');
      expect(screen.getByTestId('selected')).toHaveTextContent('production');
      expect(await screen.findByRole('listbox')).toBeInTheDocument();

      if (interaction === 'touch') {
        fireEvent.touchStart(screen.getByTestId('outside'));
      } else if (interaction === 'mouse') {
        await userEvent.click(screen.getByTestId('outside'));
      } else {
        await userEvent.keyboard('{Escape}');
      }
      await waitFor(() =>
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument(),
      );

      await userEvent.click(input);
      expect(await screen.findByRole('listbox')).toBeInTheDocument();
      expect(screen.getByTestId('selected')).toHaveTextContent('production');
    },
  );
});
