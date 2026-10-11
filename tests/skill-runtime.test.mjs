import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('installable bundled validator accepts the same example as the app and rejects private fields', () => {
  const example = 'skills/handbook-course-builder/assets/example-course.json';
  const cli = 'skills/handbook-course-builder/scripts/validate-course-pack.mjs';
  assert.equal(spawnSync(process.execPath, [cli, example], { encoding: 'utf8' }).status, 0);
  const directory = mkdtempSync(join(tmpdir(), 'handbook-skill-test-'));
  try {
    const pack = JSON.parse(readFileSync(example, 'utf8'));
    pack.profile = { ageBand: '13-15' };
    const file = join(directory, 'invalid.json'); writeFileSync(file, JSON.stringify(pack));
    const result = spawnSync(process.execPath, [cli, file], { encoding: 'utf8' });
    assert.equal(result.status, 1); assert.match(result.stderr, /Unrecognized key.*profile/);
  } finally { rmSync(directory, { recursive: true }); }
});
