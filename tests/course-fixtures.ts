import { execFileSync } from 'node:child_process';
import { validateCoursePack } from '../packages/course-pack/src';

export function historicalKBAI(revision: 5 | 6 = 6) {
  const commit = revision === 5 ? 'ea89ab985acbfab6497e99ac017e42d534d8580a' : '07b608005aa6fc2f800446317efa12cb04fbcd7a';
  const raw = execFileSync('git', ['show', `${commit}:src/content/kbai.json`], { encoding: 'utf8', maxBuffer: 4_000_000 });
  const result = validateCoursePack(JSON.parse(raw));
  if (!result.ok) throw new Error(`Invalid historical test course: ${JSON.stringify(result.issues)}`);
  return result.pack;
}

export const kbaiFixture = historicalKBAI();
