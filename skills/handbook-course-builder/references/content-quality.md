# Course content quality

The default output is course-content notes plus explanatory diagrams. Its value
comes from faithful source reading and connected explanation, not from how many
activities it contains. Retain diagrams that teach the concepts; keep practice
optional rather than using it as the reading narrative.

## Write for the learner, not the release report

`metadata.description` explains what the learner will study or learn to do.
Use ordinary course language and a concise course-purpose introduction. The
subtitle identifies the course or term. Neither field is a QA report: do not
list question counts, benchmark targets, preserved baseline content, revision
history, implementation vocabulary, or defensive release disclaimers.

`coverage.summary` explains practical learning scope and what still needs the
original material. Complete all requested lessons; if any remain partial,
identify them honestly rather than describing unfinished work as complete. Describe
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
- The explanation and any diagrams that use it; practice only when requested.

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

Each topic should explain the idea, its representation/components, how the
mechanism works and why, a relevant source example, and the distinction or
limitation actually taught. Summarize in original prose. Do not replace the
source with a generic AI textbook, an invented deployment scenario, or a stronger
algorithm the supplied material does not teach. Preserve the source's example
context where it helps understanding.

Use ordinary headings and connected paragraphs. Do not break every explanation
into repeated “What it is,” “Preview,” “Original application,” or “Next step”
boxes. Place a brief synthesis after the explanation, not dozens of reminders
between fragments. Concrete inference or representation tables can make prose
checkable; they complement explanatory diagrams rather than replace them all.

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

Include a useful selection of explanatory diagrams across the notes, placed
inline after their supporting explanations. A short static schematic can teach
more than a padded animation. Use one diagram state when the explanation is
static; do not invent extra nodes or steps to meet a numerical quota.
Tables can show concrete values or clauses alongside the diagrams.
See [the block recipe](course-pack-format.md) for the existing weekly renderer.

Every node and edge must mean something. Define the difference between hierarchy, causal influence, data flow, temporal order, and association. Arrow direction is not decorative.

For step-through traces, specify:

- Initial state.
- Active rule or transformation.
- Changed state.
- A plain-language explanation of the change.
- Result and boundary conditions.

Do not count a course-cover illustration as an explanatory diagram. Avoid copying textbook figures unless explicit permission and appropriate rights allow it. Prefer original teaching drawings based on the explained mechanism.

## Source examples and optional reinforcement

Summarize a source example where it illuminates the actual lesson. Identify which
part is stipulated and which part is derived. Original explanatory schematics
are appropriate; copying source figures or transcripts is not.

Worked traces are useful only when the steps themselves clarify the mechanism.
They are not required for every lesson. Independent attempts, recall, quizzes
and engineering bridges are optional additions when requested, not prerequisites
for complete notes.

For requested practice, change a meaningful condition rather than just renaming
objects. Use feedback to explain the decision. Where helpful, supply a
countermodel or a case in which a tempting conclusion fails.

Examples grounded in a learner's profession can help transfer. Keep the original course terminology and concept meaning intact.

## Practice, when requested

Practice should reference specific concepts and learning objectives.
An empty `practice` array is valid for a notes-and-diagrams course. No question,
recall-card, or exercise count is required. On a content correction, preserve
existing practice/history rather than generating a new bank by default.

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

For each syllabus outcome, identify relevant explanations and diagrams.
Map practice if it was requested. Record omissions explicitly.

Useful coverage statuses distinguish:

- Supported material with checked locators.
- Agent-authored explanation requiring interpretation.
- Human-confirmed material.
- Unreadable source.
- Missing source.
- Conflicting source statements.
- Optional enrichment.

Do not claim a course is complete merely because all lesson titles exist. Check
whether each important outcome is actually explained by the notes, using the
source's representations and distinctions. A learner should be able to follow
what changed and why without needing to answer a wall of prompts first.

## Cognitive accessibility

Keep the core path short and optional enrichment optional.

Use stable source vocabulary, explicit instructions, meaningful chunks, and visible resume context. Do not remove explanatory depth to make a screen sparse; reveal it in an organized sequence.

Do not force study timers, reminders, streaks, celebratory animations, or overdue counts into focused learning. If the learner requests these features, they must remain controllable.

## Rights and assessment boundaries

The software's open-source license and the source material's rights are different.

Generate original educational explanations, diagrams, and optional original
practice. Do not copy complete chapters, source figures, current or prior
students' submissions, or real exam questions.

If the course permits AI for discussion but prohibits generated submissions, keep the handbook on the learning side of that boundary. Explain a method and create separate toy practice; do not generate the assessed report or agent implementation.

## Quality review before release

Inspect the actual notes against the source, not a checklist of content quotas:

- Substantive source-page discussions and actual section headings for the summarized material.
- Teaching order, definitions, mechanisms, source examples and core distinctions.
- The complete requested lesson/week mapping, including later lessons and weeks without new chapters.
- Explanatory diagrams: accurate relation labels, inline placement, readable mobile geometry and complete text alternatives.
- A connected representative week's overview, topic explanations and synthesis as rendered.
- Unsupported additions, repetition, generic filler, or practice replacing explanation.
- Questions and worked traces only if included, with their assumptions and feedback.
- An update that preserves private data and handles changed/orphaned anchors explicitly, if this is an update.
- The distinction between shared content and private learner data.

Use automated checks for structure and referential integrity. Use explicit review for instructional meaning. Never present one as a substitute for the other.
