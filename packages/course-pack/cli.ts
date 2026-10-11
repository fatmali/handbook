import { readFile } from 'node:fs/promises';
import { parseCourseJSON } from './src/index';

const path = process.argv[2];
if (!path) {
  console.error('Usage: node validate-course-pack.mjs path/to/course.json');
  process.exitCode = 2;
} else {
  try {
    const result = parseCourseJSON(await readFile(path, 'utf8'));
    if (result.ok) console.log(`Valid Course Pack v1: ${result.pack.metadata.title} (revision ${result.pack.contentRevision}). Structural integrity is not factual verification.`);
    else { console.error(result.issues.map(issue => `${issue.path}: ${issue.message}`).join('\n')); process.exitCode = 1; }
  } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 2; }
}
