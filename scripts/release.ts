import { mkdir, copyFile, writeFile, readFile, readdir, unlink, utimes } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';
import { z } from 'zod';
import { coursePackSchema, privateProfileSchema, validateCoursePack } from '../packages/course-pack/src';
import { samplePack } from '../src/content/sample';
import { generateIcons } from './icons';

await generateIcons();
for (const directory of ['public/courses', 'public/downloads', 'public/licenses', 'skills/handbook-course-builder/assets', 'skills/handbook-course-builder/scripts', 'skills/handbook-course-builder/licenses', 'packages/course-pack/schema', 'packages/course-pack/licenses']) await mkdir(directory, { recursive: true });
for (const dependency of ['react', 'react-dom', 'idb', 'zod']) await copyFile(`node_modules/${dependency}/LICENSE`, `public/licenses/${dependency}.txt`);
await copyFile('node_modules/zod/LICENSE', 'skills/handbook-course-builder/licenses/zod.txt');
await copyFile('node_modules/zod/LICENSE', 'packages/course-pack/licenses/zod.txt');
const schema = JSON.stringify({ ...z.toJSONSchema(coursePackSchema), $id: 'https://fatmali.github.io/handbook/downloads/course-pack-v1.schema.json', title: 'Handbook Course Pack v1' }, null, 2);
await writeFile('packages/course-pack/schema/course-pack-v1.schema.json', schema);
await writeFile('skills/handbook-course-builder/assets/course-pack.schema.json', schema);
await writeFile('skills/handbook-course-builder/assets/private-profile.schema.json', JSON.stringify(z.toJSONSchema(privateProfileSchema), null, 2));
const notesExample = JSON.parse(await readFile('skills/handbook-course-builder/assets/example-course.json', 'utf8'));
await writeFile('public/courses/everyday-evidence.json', JSON.stringify(samplePack));
for (const pack of [samplePack, notesExample]) {
  const result = validateCoursePack(pack);
  if (!result.ok) throw new Error(result.issues.map(issue => `${issue.path}: ${issue.message}`).join('\n'));
}
await copyFile('packages/course-pack/schema/course-pack-v1.schema.json', 'public/downloads/course-pack-v1.schema.json');
await build({ entryPoints: ['packages/course-pack/cli.ts'], outfile: 'skills/handbook-course-builder/scripts/validate-course-pack.mjs', bundle: true, platform: 'node', format: 'esm', target: 'node20', legalComments: 'eof' });
await build({ entryPoints: ['packages/course-pack/src/index.ts'], outfile: 'packages/course-pack/dist/index.js', bundle: true, platform: 'neutral', format: 'esm', target: 'es2022', legalComments: 'eof' });
await build({ entryPoints: ['packages/course-pack/cli.ts'], outfile: 'packages/course-pack/dist/validate-course-pack.mjs', bundle: true, platform: 'node', format: 'esm', target: 'node20', legalComments: 'eof', banner: { js: '#!/usr/bin/env node' } });
execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'packages/course-pack/tsconfig.build.json']);
await copyFile('LICENSE', 'packages/course-pack/LICENSE');
await copyFile('LICENSE', 'skills/handbook-course-builder/LICENSE');
await copyFile('THIRD_PARTY.md', 'skills/handbook-course-builder/THIRD_PARTY.md');
async function filesIn(directory: string): Promise<string[]> {
  const files = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(files.map(file => file.isDirectory() ? filesIn(`${directory}/${file.name}`) : [`${directory}/${file.name}`]))).flat().sort();
}
const files = await filesIn('skills/handbook-course-builder');
for (const file of files) await utimes(file, new Date('2026-10-11T00:00:00Z'), new Date('2026-10-11T00:00:00Z'));
try { await unlink('public/downloads/handbook-course-builder.zip'); }
catch (error) { if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) throw error; }
execFileSync('zip', ['-q', '-X', '../public/downloads/handbook-course-builder.zip', ...files.map(file => file.slice(7))], { cwd: 'skills' });
