# Handbook

[Open Handbook](https://fatmali.github.io/handbook/) — a local-first learning
platform that turns a course pack into source-linked chapters, explanatory
diagrams, original practice, and a private notebook.

React, TypeScript and Vite power one generic renderer. The bundled KBAI course,
the clearly labeled original demonstration, and imported courses use the same
versioned contract and components. There are no accounts, model keys, inference
requests, analytics, or server uploads in v1.

## Develop and verify

Use Node 22 and npm 10:

```sh
npm ci
npm run dev
# open http://127.0.0.1:5173/handbook/
npm run check
```

`check` runs ESLint, Vitest, TypeScript, the production build, bundled skill
contract tests, and Playwright desktop/mobile flows. On a machine without a
Playwright browser, run `npx playwright install chromium` first.

```sh
npm run build
npm run validate -- path/to/course.json
```

The reproducible production source is in `src/`, the canonical Course Pack
contract in `packages/course-pack/`, and the installable portable agent skill
in `skills/handbook-course-builder/`. Build output is `dist/`; do not commit it.
The curriculum JSON is persistent source, not regenerated from private PDFs
on builds.

## Use your own course

Install [the course-builder skill](docs/skill-installation.md), give your agent
your authorized materials and syllabus, and review a representative lesson.
The skill asks about goals, prior knowledge, optional age/age band, explanation
depth, scaffolding and optional timing. Course level is evidence-led and
requires confirmation; age is never an ability or academic-level classifier.

Generate a Course Pack JSON, run the bundled validator, then choose **Import
course** in Handbook. Review sources, gaps and update changes before confirming.
The manual file handoff is the real v1 installation mechanism, not a remote
“upload” API. Agents cannot implicitly write your browser storage.

## Learning tools

Chapters connect canonical terms to source pages and use interpreted original
graphs, traces, examples, contrasts and independent recall. Focus hides the
library chrome and preserves the exact block and diagram step. Study is untimed
by default, with no break cues. Optional elapsed time is a current-visit display,
not a persistent time log.

Original multiple-correct practice reports exact matches and skips, not an
official or predicted grade. Explicitly started KBAI mocks are separate:
90 minutes, 22 questions, five options and 1–4 supported statements. The stored
deadline and question snapshot survive reload and content revisions.

## Privacy and persistence

Courses, learner preferences, study progress and optional PDF blobs are separate
IndexedDB stores. Shared course exports cannot carry profile fields, answers,
notes, confidence or timing state. **Private backups** contain those personal
records and must remain private. Source PDFs are excluded from every export;
reattach them on another device.

Storage depends on browser/origin and may be cleared or evicted by the browser.
Export backups regularly. Writes are transactional, quota failures are visible,
and stale concurrent edits require reloading rather than silently overwriting.
There is no automatic cross-device sync.

The library supports 32 courses, including bundled volumes. Complete private
backups are bounded at 64 MB and validated against the restore contract before
download. For larger libraries, export separate private course backups; data is
never truncated to produce a superficially successful backup.

The prior `kbai-study-companion-v1` state is backed up and migrated transactionally.
The original key is never automatically deleted. Exact historical question
revisions and Focus anchors are preserved; legacy logs and administrative
checks remain available through the private archive. See
[migration and portability](docs/migration.md).

## Coverage and rights

KBAI contains all 26 lessons and the 17-week Fall 2026 calendar. Lessons 1–12 are
the expanded benchmark; 13–26 remain explicitly labeled foundation coverage.
See [the source/coverage report](docs/kbai-coverage.md) for page evidence,
remaining gaps and the distinction between locator checks and factual review.

All explanations, examples, figures and teaching questions are original
paraphrases/schematics. The supplied textbook, syllabus, readings and lectures
are not distributed. This is not official courseware or exam prediction.
Discuss understanding with AI; do not generate assessed submission code/reports,
retain real exam items, or publish class submissions.

Original software, skill instructions and teaching material are MIT-licensed.
Source material retains its own rights. Hanken Grotesk is SIL OFL-licensed;
its full license accompanies the local font. See [third-party rights](THIRD_PARTY.md).

## Deployment

GitHub Actions verifies the source on PRs. On `main`, it builds and deploys
`dist/` to GitHub Pages at `/handbook/`. The service worker caches only public
release assets and never local profiles or source blobs. A release epoch hashes
course/schema/skill bytes as well as application outputs. Updates wait for an
explicit user action and cannot force a reload during Focus or a mock.

[Contract](docs/course-pack.md) · [Generation workflow](docs/generation.md) ·
[Contribution guide](CONTRIBUTING.md) · [Design system](DESIGN.md)
