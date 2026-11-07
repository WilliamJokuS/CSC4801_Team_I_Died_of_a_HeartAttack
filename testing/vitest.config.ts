import { tmpdir } from 'node:os';
import { join } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// testing/ imports source straight from ../backend/src and ../frontend/src (AGENTS.md
// "Testing across folders"), so the tests exercise the team's real code, not copies of it.
export default defineConfig({
  plugins: [react()],
  // Keep Vite's cache out of node_modules so a read-only/locked node_modules never breaks a run.
  cacheDir: join(tmpdir(), 'csc4801-testing-vite-cache'),
  resolve: {
    // Frontend components live outside this folder; make them share this project's single
    // copy of React and the router so hooks and router context work (two copies break them).
    dedupe: ['react', 'react-dom', 'react-router', 'react-router-dom'],
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'node', // component tests opt into jsdom with a `@vitest-environment jsdom` docblock
    // bcrypt cost 12 (backend/src/auth/password.ts) takes a few hundred ms per hash.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
