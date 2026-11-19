import { fireEvent, render, screen } from '@testing-library/react';

import SnapGridLayout from '@/components/dashboard/SnapGridLayout';

describe('dashboard drop persistence', () => {
  beforeEach(() => {
    jest
      .spyOn(HTMLElement.prototype, 'offsetParent', 'get')
      .mockReturnValue(document.body);
    jest
      .spyOn(HTMLElement.prototype, 'offsetWidth', 'get')
      .mockReturnValue(1200);
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
  });
  afterEach(() => jest.restoreAllMocks());

  it.each([false, true])(
    'reports the compacted drop exactly once (multiple moves: %s)',
    multipleMoves => {
      const onLayoutChange = jest.fn();
      render(
        <SnapGridLayout
          layout={[
            { i: 'a', x: 0, y: 0, w: 6, h: 2 },
            { i: 'b', x: 6, y: 0, w: 6, h: 2 },
          ]}
          cols={12}
          rowHeight={100}
          margin={[0, 0]}
          containerPadding={[0, 0]}
          onLayoutChange={onLayoutChange}
        >
          <div key="a">Panel A</div>
          <div key="b">Panel B</div>
        </SnapGridLayout>,
      );
      onLayoutChange.mockClear();
      fireEvent.mouseDown(screen.getByText('Panel A'), {
        clientX: 10,
        clientY: 10,
        buttons: 1,
      });
      fireEvent.mouseUp(document, { clientX: 10, clientY: 10 });
      expect(onLayoutChange).not.toHaveBeenCalled();
      fireEvent.mouseDown(screen.getByText('Panel A'), {
        clientX: 10,
        clientY: 10,
        buttons: 1,
      });
      if (multipleMoves)
        fireEvent.mouseMove(document, {
          clientX: 210,
          clientY: 10,
          buttons: 1,
        });
      fireEvent.mouseMove(document, { clientX: 610, clientY: 10, buttons: 1 });
      fireEvent.mouseUp(document, { clientX: 610, clientY: 10 });
      expect(onLayoutChange).toHaveBeenCalledTimes(1);
      expect(onLayoutChange.mock.calls[0][0]).toEqual([
        expect.objectContaining({ i: 'a', x: 6, y: 0, w: 6, h: 2 }),
        expect.objectContaining({ i: 'b', x: 6, y: 2, w: 6, h: 2 }),
      ]);
    },
  );
});
