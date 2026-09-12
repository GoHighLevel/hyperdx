import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { createRegisterTool } from '@/mcp/utils/registerTool';

describe('MCP permissions', () => {
  it.each(['developer', 'admin'] as const)(
    'enforces the %s role on tool calls',
    async role => {
      const server = new McpServer({ name: 'test', version: '1' });
      const register = createRegisterTool(server, {
        teamId: 'team',
        userId: 'user',
        role,
      });
      const write = jest.fn(async () => ({
        content: [{ type: 'text' as const, text: 'written' }],
      }));
      const read = jest.fn(async () => ({
        content: [{ type: 'text' as const, text: 'read' }],
      }));
      register(
        'write',
        { title: 'Write', description: 'Write', inputSchema: z.object({}) },
        write,
      );
      register(
        'read',
        {
          title: 'Read',
          description: 'Read',
          inputSchema: z.object({}),
          annotations: { readOnlyHint: true },
        },
        read,
      );
      const [clientTransport, serverTransport] =
        InMemoryTransport.createLinkedPair();
      await server.connect(serverTransport);
      const client = new Client({ name: 'test', version: '1' });
      await client.connect(clientTransport);
      try {
        const result = await client.callTool({ name: 'write', arguments: {} });
        expect(write).toHaveBeenCalledTimes(role === 'admin' ? 1 : 0);
        expect(Boolean(result.isError)).toBe(role !== 'admin');
        await client.callTool({ name: 'read', arguments: {} });
        expect(read).toHaveBeenCalledTimes(1);
      } finally {
        await client.close();
        await server.close();
      }
    },
  );
});
