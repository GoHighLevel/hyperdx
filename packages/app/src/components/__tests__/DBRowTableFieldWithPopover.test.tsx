import { fireEvent, screen, waitFor, within } from '@testing-library/react';

import DBRowTableFieldWithPopover from '@/components/DBTable/DBRowTableFieldWithPopover';

jest.mock('@/components/DBRowSidePanel', () => ({
  RowSidePanelContext: jest.requireActual('react').createContext({}),
}));

async function renderField() {
  renderWithMantine(
    <>
      <button type="button">Outside</button>
      <DBRowTableFieldWithPopover
        cellValue="example"
        columnName="message"
        tableContainerRef={null}
        wrapLinesEnabled={false}
      >
        <span>Log value</span>
      </DBRowTableFieldWithPopover>
    </>,
  );
  fireEvent.mouseEnter(screen.getByText('Log value'));
  const toolbar = await screen.findByRole('dialog', { hidden: true });
  return within(toolbar).getByRole('button', { hidden: true });
}

describe('log field action popover dismissal', () => {
  it('closes on an outside pointer interaction', async () => {
    await renderField();
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Outside' }));
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { hidden: true }),
      ).not.toBeInTheDocument(),
    );
  });

  it('closes on Escape from a toolbar action', async () => {
    const copy = await renderField();
    copy.focus();
    fireEvent.keyDown(copy, { key: 'Escape' });
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { hidden: true }),
      ).not.toBeInTheDocument(),
    );
  });

  it('keeps actions available while interacting inside the popover', async () => {
    const copy = await renderField();
    fireEvent.mouseEnter(copy);
    fireEvent.mouseDown(copy);
    expect(copy).toBeInTheDocument();
  });
});
