# Course-pack contract and handoff

This document defines the skill's integration boundary. The released package must provide the actual versioned schema and runnable validator produced by the shared Handbook contract package.

Do not substitute this document for that schema.

This release uses `schemaVersion: "1.0"` and an integer `contentRevision`.
The notes-and-diagrams example is `assets/example-course.json`; it has no
practice questions or exercise blocks. It illustrates the contract, not source
verification for a real course. Top-level fields are
`id`, `metadata`, `sources`, `assets`, `concepts`, `chapters`, `syllabus`,
`practice`, `coverage`, and `provenance`, in addition to the two version fields.
Every field is strict; use the schema's exact structure, not these headings as
an alternative loose format.

`metadata.description` is the learner-facing course purpose, not release
notes. `coverage.summary` describes practical scope and where original sources
are still needed. The generated schema documents this writing rule; see
[content quality](content-quality.md). Keep QA metrics, implementation vocabulary
and preservation history in provenance or a separate report.

The allowed content block `kind` values are `paragraph`, `list`, `callout`,
`example`, `table`, `recall`, and `diagram`. All use `id`, `conceptIds`, and
`citations`. Diagrams require `nodes`, `edges`, `steps`, `caption`, and
`alternative`. Use `pdfPage` for PDF viewer pages, not a guessed printed page.
Deadlines use ISO timestamps with offsets and an IANA `timezone`.

Course education levels are `middle-school`, `high-school`, `bachelors`,
`masters`, `other`, and `unknown`. `metadata.levelInference` records
`evidence`, `confidence`, `confirmed`, and `unknowns`; never put age there.
The private profile uses its separate schema and remains optional.

## Required package resources

- `assets/course-pack.schema.json`: the generated JSON Schema used by the current app.
- `scripts/validate-course-pack.mjs`: the bundled CLI that uses the same validation semantics as the app.
- At least one small, original, valid example pack.
- A schema version and compatibility statement.

If these resources are absent, generation can produce a draft but must not claim an import-ready course.

## Course content

One course document represents one course. Use the exact field names and allowed values from the installed schema.

The contract should represent:

- Identity, version, and content revision.
- Course metadata and source-supported academic level.
- Sources, provenance, rights, and locators.
- Syllabus outcomes, schedule, assessments, scope, and policy references.
- Concepts, canonical terms, aliases, notation, and prerequisites.
- Ordered lessons and supported content blocks.
- Explanatory diagrams with meaningful relations, captions and textual alternatives.
- Source examples summarized inline where useful.
- Optional reinforcement and practice only when requested.
- Coverage, omissions, and uncertainty.

Do not invent unsupported properties because they sound useful. Request a contract change through the normal development workflow or record the idea outside the course.

## Weekly notes block recipe

Use the existing contract and reader; do not add `weeklyNotes`, `html`,
`sourceSection`, or other unsupported JSON fields.

- `chapters` contains the requested lessons in source order with stable IDs,
  canonical titles, a concise summary, and source-grounded blocks.
- `syllabus.weeks[].chapterIds` selects the actual assigned lessons in their
  teaching order. Use the supplied mapping, not a fabricated calendar.
- `syllabus.weeks[].title` names the actual assigned topics. A week with no
  assigned lessons can be titled revision, consolidation, project, or wrap-up,
  with `chapterIds: []`.
- `syllabus.weeks[].notes` contains the plain-language overview, then a blank
  line, then the closing weekly synthesis. The generic Weekly notes reader
  renders the referenced chapter blocks between those two parts.
- A source-notes section uses `kind: "callout"`, `tone: "note"`, its authored
  readable heading in `title`, and connected paragraphs in `text`. Chapter and
  weekly reading modes show these as ordinary headings and prose. Use warning
  or misconception tones only for real warnings or distinctions, not every section.
- Link canonical terms through `conceptIds`. Put actual source heading(s) in
  `citations[].section` and the substantive PDF viewer range in `pdfPage` /
  `pdfPageEnd`; the authored section title is not a claimed source anchor.
- Insert `diagram` blocks immediately after the explanation they depend on.
  Every node and edge has a concept-specific meaning; `alternative` describes
  the diagram completely. Prefer compact mobile-readable geometry. For a
  static diagram use one `steps` entry; the reader omits trace controls.
- Close a lesson with a brief synthesis, for example a note section titled
  “What this lesson adds.” A table can expose actual clauses, values, or model
  changes beside the diagram where the source teaches them.

The default deliverable includes useful diagrams, not a minimum number of
nodes or animations. Do not require worked exercises for every lesson.
Use `practice: []` when practice was not requested, and omit recall and
independent-attempt blocks. Existing practice is preserved on notes updates.
Keep assessments, policies, and administrative information in the syllabus,
not repeated throughout the weekly overview or explanatory blocks.

Weekly notes are reachable through **Weekly notes** in the selected course's
workspace (tabs on desktop, **Course tools** on mobile). A direct route is
`#/weekly/<courseId>/<weekId>` using the actual IDs. If no schedule exists,
keep `syllabus.weeks: []` and use chapters without inventing weeks.

## Private data

Do not add these to a shared course:

- Exact age, age band, or birthdate.
- A learner's identity, diagnosis, or accessibility disclosure.
- Personal goals or notes.
- Answers, confidence, review schedules, or assessment history.
- Time logs or study-session records.
- Browser storage credentials or local filesystem paths.

Private profile and backup exports must be explicitly separate and consented. Personalized educational explanations can be shared only after removing private context and checking source rights.

## Validation

The shared validator must reject or clearly report:

- Unsupported schema versions and block types.
- Missing required fields.
- Duplicate or malformed identities.
- Dangling concept, source, objective, block, or practice references.
- Cycles where an acyclic prerequisite graph is expected.
- Invalid page or time ranges.
- Unsafe URLs.
- Oversized files, diagrams, or other bounded data.
- Executable markup or scripts in places reserved for declarative data.

Limits are implementation constraints, not learning-quality claims. Validation must run before a course is installed or an existing course replaced.

## Safe import

The app's import preview should show the course identity, revision, coverage, source inventory, and meaningful warnings. Installing or replacing data needs a clear confirmation.

For a failed import, keep existing courses and progress unchanged. A validator error is not grounds to silently drop the troublesome section and report success.

## Updates

Maintain stable IDs for unchanged content. Preview changes before replacement.
New notes on a different concept must not reuse an old quote's block ID merely
to avoid an orphan warning. Never rewrite historic question or recall IDs to
make old results appear to use new content.

If a block is removed or a source locator changes:

- Preserve the old annotation in private state.
- Identify that its original anchor changed or disappeared.
- Offer a deliberate reattachment or archival path rather than guessing.

If a question changes, preserve the historical question revision for existing responses.

## Local handoff

The default v1 handoff is a file:

1. Generate and validate the course JSON.
2. Tell the learner where the file was saved.
3. Open Handbook if appropriate.
4. The learner selects the file, reviews the preview, and confirms import.

Generating a file does not mean it has been installed. A remote agent has no implicit right or capability to modify the learner's browser storage.

An optional future automatic bridge must use explicit pairing, bounded permissions, a supported protocol, and an acknowledgment. It must not leak course content or personal profile information into a public link.

## Release honesty

Do not describe this skill as fully packaged, tested, or import-compatible until its schema, validator, valid example, installation instructions, and app import flow have all been exercised together.
