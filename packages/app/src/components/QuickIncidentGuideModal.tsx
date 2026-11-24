import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Anchor, Box, Modal, ScrollArea } from '@mantine/core';

import guide from '@/docs/incident-guide.json';

export default function QuickIncidentGuideModal({
  opened,
  onClose,
}: {
  opened: boolean;
  onClose: () => void;
}) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={guide.title}
      size="xl"
      scrollAreaComponent={ScrollArea.Autosize}
    >
      <Box className="hdx-markdown">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            a: ({ href, children }) => (
              <Anchor href={href} target="_blank" rel="noopener noreferrer">
                {children}
              </Anchor>
            ),
          }}
        >
          {guide.markdown}
        </ReactMarkdown>
      </Box>
    </Modal>
  );
}
