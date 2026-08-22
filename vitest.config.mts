import { defineConfig } from 'vitest/config';
import * as path from 'path';

export default defineConfig({
  // Renderer modules use the same @ alias Next resolves, so tests that reach
  // into src/ need it too.
  resolve: {
    alias: { '@': path.resolve(process.cwd(), 'src') },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: [
        'electron/constants/**',
        'electron/utils/**',
        'electron/services/**',
        'electron/handlers/**',
        'electron/providers/**',
        'mcp-orchestrator/src/utils/**',
        'mcp-orchestrator/src/tools/**',
        'mcp-telegram/src/**',
        'mcp-kanban/src/**',
      ],
    },
  },
});
