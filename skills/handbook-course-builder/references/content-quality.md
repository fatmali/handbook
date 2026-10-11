# Course content quality

The output must support understanding, not merely resemble a course. Its value comes from organized source evidence, explanatory structure, and an effective path from exposure to independent reasoning.

## Write for the learner, not the release report

`metadata.description` explains what the learner will study or learn to do.
Use ordinary course language and a concise course-purpose introduction. The
subtitle identifies the course or term. Neither field is a QA report: do not
list question counts, benchmark targets, preserved baseline content, revision
history, implementation vocabulary, or defensive release disclaimers.

`coverage.summary` explains practical learning scope and what still needs the
original material. For example, say that later lessons are shorter introductions
and recommend the corresponding textbook sections for deeper study. Describe
missing or unchecked material plainly in coverage gaps; do not hide a genuine
limitation, but keep it out of the course's introductory pitch.

Put QA metrics, preservation history, generation methods and implementation
details in `provenance` or a separate developer/quality report. A demonstration
course may retain its demo label, but its introduction still describes the
subject being learned rather than the platform's renderer.

## Source crosswalk

Each concept needs:

- Its canonical source term.
- Relevant aliases, if they are actually used or clearly labeled supplemental vocabulary.
- Its definition in original wording.
- The source edition and locator.
- Prerequisites and closely related concepts.
- The explanation, diagram, and practice that use it.

Do not create aliases solely because two words sound similar. State meaningful distinctions rather than collapsing them.

Visible course language should lead. For example, if a source describes a learning goal triggered by a knowledge gap, do not replace it throughout the handbook with a different technical label and claim exact vocabulary alignment.

PDF viewer page numbers and printed page numbers are different locator types. A paragraph under an authentic heading is not automatically supported by that heading's page.

Use the actual source section name in a verified citation, not an invented
plain-language notes heading. Read multi-column PDFs in column order and inspect
printed figures where transcripts are incomplete before filling apparent gaps.

For weekly notes, use the real syllabus week/lesson mapping and put assigned
topic names beside a short connective overview. Explain topics in source
teaching order, then synthesize their connection. Weeks with no new lessons
remain revision, consolidation or wrap-up. Keep recall, professional bridges and
administration secondary; do not substitute repeated prompts for explanation.

## Explanation depth

For a mechanism, answer:

1. What is the input, state, or question?
2. What is represented?
3. What selects or licenses the next step?
4. What changes?
5. Why is that change useful or valid?
6. What assumptions does the conclusion depend on?
7. Where does the mechanism fail or need another method?

Depth is not a minimum word count. A long paragraph can still omit the crucial inference. A short, well-explained trace can be substantially deeper than a broad summary.

Distinguish a task from a method, representation from inference, observed evidence from default expectation, and a plausible explanation from a guaranteed consequence where the course requires those distinctions.

## Diagrams

A useful diagram must have a teaching purpose and a textual alternative. Types may include:

- Typed relation graphs.
- Control-flow and state-transition diagrams.
- Concept hierarchies.
- Constraint propagation or dependency diagrams.
- Timelines or ordered traces.
- Structured slot/filler or comparison tables.

Use only types the installed schema supports.

A short static schematic or concrete representation table can teach more than
a padded animation. Use one diagram state when the explanation is static; do not
invent extra nodes or steps to meet a numerical quota. The generic weekly reader
uses existing `syllabus.weeks.notes` as overview followed by synthesis separated
by a blank line, with `chapterIds` selecting the lesson sections. No extra HTML
or unsupported schema fields are needed.

Every node and edge must mean something. Define the difference between hierarchy, causal influence, data flow, temporal order, and association. Arrow direction is not decorative.

For step-through traces, specify:

- Initial state.
- Active rule or transformation.
- Changed state.
- A plain-language explanation of the change.
- Result and boundary conditions.

Do not count a course-cover illustration as an explanatory diagram. Avoid copying textbook figures unless explicit permission and appropriate rights allow it. Prefer original teaching drawings based on the explained mechanism.

## Worked and independent examples

Worked examples should expose the reasoning. Identify which part of the example is stipulated and which part is derived.

An independent attempt should change a meaningful condition, representation, or constraint. It should not simply rename the objects while asking for the same memorized output.

Use feedback to explain the decision. Where helpful, supply a countermodel or a case in which a tempting conclusion fails.

Examples grounded in a learner's profession can help transfer. Keep the original course terminology and concept meaning intact.

## Practice

Practice should reference specific concepts and learning objectives.

For a choice question:

- State all necessary assumptions.
- Avoid relying on unstated conventions.
- Specify whether one or several choices are expected.
- Explain every option.
- Separate correctness from confidence.
- Label it original practice.

For a reasoning question:

- Supply a rubric about the mechanism or argument.
- Give a worked explanation without requiring identical wording.
- Show an important assumption or alternate valid approach.

Do not claim a generated score predicts the course grade. Do not imitate an unknown official partial-credit formula.

Old answers must retain their original question revision. When a question's wording or key changes, do not reinterpret earlier learner responses silently.

## Coverage and uncertainty

For each syllabus outcome, identify relevant lessons and practice. Record omissions explicitly.

Useful coverage statuses distinguish:

- Supported material with checked locators.
- Agent-authored explanation requiring interpretation.
- Human-confirmed material.
- Unreadable source.
- Missing source.
- Conflicting source statements.
- Optional enrichment.

Do not claim a course is complete merely because all lesson titles exist. Check whether each important outcome can be explained and attempted independently.

## Cognitive accessibility

Keep the core path short and optional enrichment optional.

Use stable source vocabulary, explicit instructions, meaningful chunks, and visible resume context. Do not remove explanatory depth to make a screen sparse; reveal it in an organized sequence.

Do not force study timers, reminders, streaks, celebratory animations, or overdue counts into focused learning. If the learner requests these features, they must remain controllable.

## Rights and assessment boundaries

The software's open-source license and the source material's rights are different.

Generate original educational explanations and original practice. Do not copy complete chapters, source figures, current or prior students' submissions, or real exam questions.

If the course permits AI for discussion but prohibits generated submissions, keep the handbook on the learning side of that boundary. Explain a method and create separate toy practice; do not generate the assessed report or agent implementation.

## Quality review before release

Inspect at least:

- All declared source references and their available locators.
- A diagram with multiple typed relations.
- A multi-step example.
- An invalid but tempting inference.
- An activity at the chosen level of scaffolding.
- A question involving more than one correct option, when that format is used.
- An update that preserves stable identities.
- The distinction between shared content and private learner data.

Use automated checks for structure and referential integrity. Use explicit review for instructional meaning. Never present one as a substitute for the other.
