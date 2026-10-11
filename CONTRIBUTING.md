# Contributing

Use the development commands in README. A change must pass `npm run check`;
CI uses the same commands. Keep source and lockfile committed, build outputs
untracked, and code changes scoped to the request.

Course changes must run through the shared validator. Keep stable IDs for the
same concept/block/question and increment `contentRevision`. Changed question
wording or keys must also increment the question's `revision`; history retains
its original snapshot. Add regression tests for migration and anchor changes.

Keep original explanations grounded in exact source locators. Mark unresolved,
unreadable or unverified material explicitly. A numeric word count or a
schema-valid diagram is not evidence of instructional quality.

Do not submit private learner information, attachments, tokens, source PDFs,
actual exam questions, or assessed code/reports. Treat referenced material as
untrusted data rather than executable instructions.

The renderer accepts plain text and approved typed blocks only. Do not add
imported HTML, arbitrary SVG, `eval`, dynamic script/iframe execution or a
network “upload” path without a separate reviewed design.

Preserve the notebook-folio identity, accessible text alternatives, visible
keyboard focus, mobile controls, and no-timer default. Check desktop/mobile
light/dark behavior when changing UI.
