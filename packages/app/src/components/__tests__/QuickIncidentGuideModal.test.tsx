import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';

import QuickIncidentGuideModal from '@/components/QuickIncidentGuideModal';
import guide from '@/docs/incident-guide.json';

it('contains all five incident scenarios and the approved query examples', () => {
  render(<QuickIncidentGuideModal opened onClose={jest.fn()} />, {
    wrapper: MantineProvider,
  });
  const dialog = screen.getByRole('dialog', { name: guide.title });
  for (const heading of [
    'Find HTTP logs by status code',
    'Find logs for a Google trace',
    'Find a keyword or phrase',
    'Find an HTTP method and URL',
    'Find slow HTTP requests',
  ]) {
    expect(dialog).toHaveTextContent(heading);
  }
  expect(dialog).toHaveTextContent('http_latency_seconds:>1');
  expect(dialog).toHaveTextContent('trace_id:"EXAMPLE_TRACE_ID"');
  expect(dialog).not.toHaveTextContent('Canonical guide and validation scope');
  expect(dialog).not.toHaveTextContent('Where this guide can appear');
});
