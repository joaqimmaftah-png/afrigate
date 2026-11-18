import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import globMatcher from 'picomatch';
import { glob } from 'tinyglobby';
import { resolveConfig } from 'vite';

test('build matcher uses the local replacement and rejects unsupported extglob syntax', async () => {
  const { packages } = JSON.parse(await readFile(new URL('../package-lock.json', import.meta.url), 'utf8'));
  assert.deepEqual(Object.entries(packages).filter(([name]) => name.endsWith('/picomatch')), [
    ['node_modules/picomatch', { resolved: 'tools/build-glob', link: true }],
  ]);
  const match = globMatcher(['./src/**/*.{ts,tsx}', 'public/*.css']);
  assert.equal(match('src/pages/portal/Report.tsx'), true);
  assert.equal(match('src/App.tsx'), true);
  assert.equal(match('public/main.css'), true);
  assert.equal(match('src/.cache/App.tsx'), false);
  assert.equal(match('node_modules/App.tsx'), false);
  assert.equal(globMatcher('!src/*.test.ts')('src/App.ts'), true);
  assert.equal(globMatcher('!src/*.test.ts')('src/App.test.ts'), false);
  assert.throws(() => globMatcher('@(One|Two).tsx'), /Extended globs are not supported/);
  assert.throws(() => globMatcher.scan('@(One|Two).tsx'), /Extended globs are not supported/);
  assert.deepEqual(globMatcher.scan('/src/{client/routes,staff}/**/*.tsx', { parts: true }), {
    input: '/src/{client/routes,staff}/**/*.tsx', prefix: '', negated: false, isGlob: true,
    base: '/src', glob: '{client/routes,staff}/**/*.tsx', parts: ['', 'src', '{client/routes,staff}', '**', '*.tsx'],
  });
});

test('tinyglobby retains recursive includes, directory pruning and explicit excludes', async t => {
  const cwd = await mkdtemp(join(tmpdir(), 'afrigate-glob-'));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  for (const name of ['a', 'b', 'c', 'a/inner']) await mkdir(join(cwd, name));
  for (const name of ['a/App.tsx', 'a/inner/View.ts', 'b/User.ts', 'b/Ignore.test.ts', 'c/Skip.ts']) {
    await writeFile(join(cwd, name), '');
  }
  const matched = await glob(['{a,b}/**/*.{ts,tsx}', '!**/*.test.ts'], { cwd });
  assert.deepEqual(matched.sort(), ['a/App.tsx', 'a/inner/View.ts', 'b/User.ts']);
  assert.deepEqual(await glob('{a/inner,b}/**/View.ts', { cwd }), ['a/inner/View.ts']);
});

test('Vite default filesystem deny rules remain effective with the replacement', async () => {
  const { fsDenyGlob } = await resolveConfig({ configFile: false }, 'serve');
  for (const path of ['/app/.env', '/app/.env.local', '/app/config/.ENV', '/app/.git/config', '/app/ssl/test.pem', '/app/ssl/test.CRT']) {
    assert.equal(fsDenyGlob(path), true, path);
  }
  assert.equal(fsDenyGlob('/app/src/main.tsx'), false);
});
