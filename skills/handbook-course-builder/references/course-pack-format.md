# Course-pack contract and handoff

This document defines the skill's integration boundary. The released package must provide the actual versioned schema and runnable validator produced by the shared Handbook contract package.

Do not substitute this document for that schema.

This release uses `schemaVersion: "1.0"` and an integer `contentRevision`.
The complete example is `assets/example-course.json`. Top-level fields are
`id`, `metadata`, `sources`, `assets`, `concepts`, `chapters`, `syllabus`,
`practice`, `coverage`, and `provenance`, in addition to the two version fields.
Every field is strict; use the schema's exact structure, not these headings as
an alternative loose format.

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
- Declarative diagrams with captions and textual alternatives.
- Worked reasoning and independent examples.
- Original practice and explanation-based feedback.
- Coverage, omissions, and uncertainty.

Do not invent unsupported properties because they sound useful. Request a contract change through the normal development workflow or record the idea outside the course.

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
