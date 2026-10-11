# Course Pack v1

The canonical implementation is `packages/course-pack/src/index.ts`.
`npm run build` generates `packages/course-pack/schema/course-pack-v1.schema.json`
and bundles that **same validator** into the downloadable skill. TypeScript
models are inferred from the strict runtime schema, not maintained separately.

`schemaVersion: "1.0"` identifies the contract. `contentRevision` identifies
the course's changing material. A pack is one shareable course, not a learner
profile or progress backup.

| Field | Purpose |
|---|---|
| `id`, `contentRevision` | Stable course identity and increasing content revision |
| `metadata` | Title, language, source-evidenced education level, depth and dates |
| `sources`, `assets` | Author, edition, rights, verification and optional source/PDF binding |
| `concepts` | Canonical terms, aliases, notation, definitions, prerequisites and contrasts |
| `chapters` | Ordered stable units, outcomes and typed blocks |
| `syllabus` | Outcomes, weeks, assessments, timezone deadlines, scope and policies |
| `practice` | Original multiple-correct questions with stable IDs and option explanations |
| `coverage` | Explicit omissions, unreadable/unverified/partial material |
| `provenance` | Generation method, rights, license and original-explanation declaration |

Supported block kinds: `paragraph`, `list`, `callout`, `example`, `table`,
`recall`, `diagram`. All have stable IDs, concept references and citations.
Text is plain text, not Markdown or executable markup. Script-like text is
displayed literally. Unknown fields, block kinds and versions are rejected,
not silently dropped.

`metadata.description` explains what the learner will study or learn to do.
It is not a release report. `coverage.summary` describes practical learning
scope and where the original material is still needed. QA counts, preservation
history and implementation terminology belong in provenance/developer reports,
not course introductions. These descriptions are also published in the JSON
Schema and course-builder guidance.

Diagrams contain bounded nodes, interpreted edges, step titles/explanations
and active node IDs, plus a caption and full textual alternative. Cycles are
permitted in an explanatory state graph; **prerequisite** graphs must be
acyclic. A decorative cover does not count as instruction.

Source citations distinguish PDF viewer pages, optional printed pages,
sections and optional known lecture timestamps. Page ends must follow starts
and fit declared page counts. No timestamps may be invented.
Assets and sources must agree bidirectionally on ownership. Optional SHA-256
binding refuses a mismatched PDF; an absent hash is not edition verification.

Assessment deadlines must include a UTC offset and a valid IANA timezone.
`Etc/GMT+12` represents UTC-12. Displayed local times do not replace the
official deadline. Mock specifications define count, duration, option count,
and supported-option bounds; practice refuses an insufficient in-scope bank.

## Limits and validation

8 MB course JSON; 150 chapters; 3,000 total blocks; 1,500 concepts;
2,000 questions; 30 optional PDF assets; 80 nodes/160 edges per diagram;
20,000 characters per text value. Nested arrays and references are also
bounded. URLs require HTTPS and no embedded credentials.

The local library and private backup contract both support 32 courses (including
the two bundled courses and up to 30 legacy personal courses). Private progress
is capped at 8 MB per course; a complete private JSON backup is capped at 64 MB.
Export validates the same restore contract and refuses oversize data explicitly.

Semantic checks include unique global IDs, correct references, page ranges,
source/asset ownership, table row shapes, acyclic prerequisites, chronology,
timezone validity, option identity and mixed supported/unsupported answers.
This checks integrity, **not factual truth** or learning effectiveness.

```sh
npm run validate -- my-course.json
# installed skill, without npm dependencies:
node scripts/validate-course-pack.mjs my-course.json
```

The CLI exits 0 for valid structure, 1 for invalid course content, and 2 for
usage/file errors. Errors name field paths. Use the bundled original example
as a complete starting point rather than fabricating undeclared fields.

## Updates and private boundaries

An import is previewed before installation. An existing course ID requires a
higher content revision; changed questions require higher question revisions.
Removed/changed block annotations are retained and visibly flagged, with
deliberate reattachment. No approximate anchor matching occurs.

Shared packs never have age, profile, notes, answers, confidence or time-log
fields. The separate strict private profile schema permits an optional age band
and defaults to no study timer. The separate `handbook-private-backup` v1 format
holds packs, private progress and profile, and an optional preserved legacy
snapshot. Invalid import/restore leaves existing records untouched.
