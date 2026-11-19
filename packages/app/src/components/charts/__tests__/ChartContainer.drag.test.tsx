import { fireEvent, screen } from '@testing-library/react';

import ChartContainer, {
  ChartContainerCardHeaderProvider,
} from '@/components/charts/ChartContainer';
import SnapGridLayout from '@/components/dashboard/SnapGridLayout';

describe('dashboard chart header dragging', () => {
  beforeEach(() => {
    jest
      .spyOn(HTMLElement.prototype, 'offsetParent', 'get')
      .mockReturnValue(document.body);
  });

  afterEach(() => jest.restoreAllMocks());

  it.each([
    { scrollBody: false, readOnly: false },
    { scrollBody: true, readOnly: false },
    { scrollBody: false, readOnly: true },
  ])(
    'protects controls and respects permissions (scroll body: $scrollBody, read-only: $readOnly)',
    ({ scrollBody, readOnly }) => {
      const onDrag = jest.fn();
      renderWithMantine(
        <SnapGridLayout
          layout={[{ i: 'panel', x: 0, y: 0, w: 6, h: 4 }]}
          draggableHandle="[data-dashboard-drag-handle]"
          isDraggable={!readOnly}
          onDrag={onDrag}
        >
          <div key="panel">
            <ChartContainerCardHeaderProvider>
              <ChartContainer
                title="Requests"
                toolbarItems={[<button key="menu">Panel actions</button>]}
                disableReactiveContainer={scrollBody}
              >
                <button>Inspect chart</button>
              </ChartContainer>
            </ChartContainerCardHeaderProvider>
          </div>
        </SnapGridLayout>,
      );
      const drag = (target: HTMLElement) => {
        fireEvent.mouseDown(target, { clientX: 10, clientY: 10, buttons: 1 });
        fireEvent.mouseMove(document, {
          clientX: 150,
          clientY: 100,
          buttons: 1,
        });
        fireEvent.mouseUp(document);
      };
      drag(screen.getByRole('button', { name: 'Panel actions' }));
      drag(screen.getByRole('button', { name: 'Inspect chart' }));
      expect(onDrag).not.toHaveBeenCalled();
      drag(screen.getByText('Requests'));
      if (readOnly) {
        expect(onDrag).not.toHaveBeenCalled();
      } else {
        expect(onDrag).toHaveBeenCalled();
      }
    },
  );
});
