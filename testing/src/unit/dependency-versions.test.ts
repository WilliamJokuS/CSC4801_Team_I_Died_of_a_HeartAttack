import { createRequire } from 'node:module';
import { expect, it } from 'vitest';

const fromBackend = createRequire(new URL('../../../backend/package.json', import.meta.url));
const fromExpress = createRequire(fromBackend.resolve('express/package.json'));

it('Express resolves the patched body-parser at runtime', () => {
  const { version } = fromExpress('body-parser/package.json');
  const [major, minor] = version.split('.').map(Number);
  expect(major > 2 || (major === 2 && minor >= 4), version).toBe(true);
});

it('loads a patched Zod version at runtime', () => {
  const { version } = fromBackend('zod/package.json');
  const [major, minor, patch] = version.split('.').map(Number);
  expect(version).toMatch(/^\d+\.\d+\.\d+$/);
  expect(major > 4 || (major === 4 && (minor > 6 || (minor === 6 && patch >= 6))), version).toBe(true);
});
