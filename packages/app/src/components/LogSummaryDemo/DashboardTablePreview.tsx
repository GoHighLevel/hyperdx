import { useState } from 'react';
import { Text } from '@mantine/core';

import SnapGridLayout from '@/components/dashboard/SnapGridLayout';

import LiveTablePreview from './LiveTablePreview';

// Exercise the real grid and log table together: a standalone picker does not
// reproduce dashboard drag suppression intercepting outside clicks.
export default function DashboardTablePreview() {
  const [dragStarts, setDragStarts] = useState(0);
  return (
    <main style={{ padding: 12 }}>
      <Text role="status">Tile drags: {dragStarts}</Text>
      <SnapGridLayout
        layout={[{ i: 'logs', x: 0, y: 0, w: 24, h: 34 }]}
        cols={24}
        rowHeight={32}
        onDragStart={() => setDragStarts(value => value + 1)}
      >
        <div key="logs">
          <div style={{ padding: 12, cursor: 'grab' }}>
            Drag tile from this header
          </div>
          <div data-dashboard-no-drag>
            <LiveTablePreview />
          </div>
        </div>
      </SnapGridLayout>
    </main>
  );
}
