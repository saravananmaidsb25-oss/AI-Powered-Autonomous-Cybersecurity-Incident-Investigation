import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {join} from 'node:path';

const root = join(import.meta.dirname, '..');
const docs = [
  'docs/JURY_EVALUATION.md',
  'docs/PITCH.md',
  'docs/BUSINESS_CASE.md',
  'docs/ARCHITECTURE.md',
  'docs/SCHEMA.md',
  'docs/SECURITY.md',
  'docs/PERFORMANCE.md',
  'docs/DEMO_SCRIPT.md',
  'docs/openapi.yaml',
];

for (const doc of docs) {
  test(`jury documentation exists: ${doc}`, () => {
    const path = join(root, doc);
    assert.ok(existsSync(path), `${doc} is required for jury evaluation`);
    assert.ok(readFileSync(path, 'utf8').length > 100);
  });
}

test('evaluation view exports scorecard', async () => {
  const {evaluationView} = await import('../src/ui/views/evaluation.js');
  const html = evaluationView();
  assert.match(html, /Human jury criteria breakdown/);
  assert.match(html, /AI jury score breakdown/);
  assert.match(html, /Innovation/);
  assert.match(html, /Security/);
});
