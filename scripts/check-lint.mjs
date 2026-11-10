import { ESLint } from 'eslint';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

// Existing findings stay visible; new findings cannot silently expand the debt.
const baseline = JSON.parse(await readFile(new URL('./lint-baseline.json', import.meta.url), 'utf8'));
const eslint = new ESLint();
const results = await eslint.lintFiles(['.']);
const counts = {};
for (const result of results) {
  for (const message of result.messages) {
    const key = `${path.relative(process.cwd(), result.filePath).split(path.sep).join('/')}|${message.ruleId}`;
    counts[key] = (counts[key] || 0) + 1;
  }
}
console.log(await (await eslint.loadFormatter('stylish')).format(results));
const regressions = Object.entries(counts).filter(([key, count]) => count > (baseline[key] || 0));
if (regressions.length) {
  console.error('New lint findings exceed the reviewed baseline:', regressions);
  process.exitCode = 1;
} else {
  console.log(`Lint regression gate passed; ${Object.values(counts).reduce((a, b) => a + b, 0)} existing findings remain. Full npm run lint is not yet clean.`);
}
