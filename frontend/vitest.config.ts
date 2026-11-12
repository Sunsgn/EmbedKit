import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { repositoryMarkdownPlugin } from './vite.config.ts';

export default defineConfig({
  plugins: [repositoryMarkdownPlugin(), react()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
    restoreMocks: true,
  },
});
