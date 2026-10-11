# KBAI source-grounding and coverage

## Scope and distribution boundary

The persistent `src/content/kbai.json` is a canonical Course Pack (`schemaVersion:
1.0`, course ID `kbai`, content revision 4), validated by the shared
`validateCoursePack` contract. Production consumption needs neither the private
conversion inputs nor a PDF parser. `scripts/build-kbai.ts` is an explicit
conversion tool, not part of the app’s content loader: it evaluates only the
trusted baseline data files with Node `vm` and writes validated JSON.

All 26 baseline lessons, their titles, explanations, objectives, worked-step
content, original exercises, and three recall cards per lesson are retained.
Lessons01–12 have **benchmark-depth expansion**; **Lessons13–26 are preserved
foundation**, not an assertion of equivalent coverage. Four limited later-topic
terminology corrections do not change that distinction.

Content revision **4** adds owned source-PDF fingerprints and restores the
approved original **cube** cover through declarative `metadata.cover`, without
app-specific rendering logic. This revision supersedes the preliminary content
revision3 for browser update previews. The independent practice bank revision
remains **3**, preserving all historical question and answer-key snapshots.

The pack distributes original paraphrases, original invented examples and
declarative diagrams, original baseline practice, bibliographic pointers, and
administrative facts. It does not distribute source PDFs, extracted transcripts,
source figures, input artifacts, private context, assessed student submissions,
or actual exam questions. Two owned PDF asset declarations contain only generic
filenames and SHA-256 fingerprints, not source bytes or private paths. Source
copyrights remain reserved.

## Source verification method

The supplied 2016 ebook has **357 PDF pages**. PDF ordinal and the printed
“Page … of 357” agree at inspected locations. Citations therefore use 1-based PDF
pages, matching printed-page locators. The edition is **October 6, 2016**, not a
current Canvas assignment specification. Local PyMuPDF text inspection was used
for substantive sections, not merely filenames or headings. The primitive-action
vocabulary was also checked in the embedded p.202 figure; that inspection image
was not included in the output.

The supplied Fall2026 syllabus has **9 pages**. Its p.3 calendar and pp.3–6
assessment/policy prose were read substantively. No lecture timestamps are
invented. Live video correspondence and authenticated linked assignment/rubric
pages were not independently verified.

### Owned PDF fingerprints

SHA-256 digests were computed directly from the two supplied PDFs during release
hardening. These are byte-level identities of the inspected editions, not
fingerprints of extracted text or filenames:

| Source | Owned asset ID | Generic filename | SHA-256 |
|---|---|---|---|
| `ebook-2016` | `asset-ebook-2016-pdf` | `kbai-2016-ebook.pdf` | `9f8e120b152fcdee0e1f59ddec10e7c522c26d3578f594fea91ee69e52e1a6ff` |
| `syllabus-fa26` | `asset-syllabus-fa26-pdf` | `kbai-fall2026-syllabus.pdf` | `fdf83711dde8bbe1bd51352d3d255c947ce17408f81d61454ff98f2595679d32` |

Each source references its own `assetId`, and each declaration references its
owning `sourceId`. Shared validation enforces both directions; content tests
verify the known digests and reject swapped or missing ownership links. This
metadata enables the app to reject a different locally attached PDF before using
verified source-page locators. A re-exported PDF with different bytes needs
independent verification rather than silently bypassing the known fingerprint.
No PDF bytes are embedded, and users supply local attachments separately.

New explanatory block citations identify actual source section names/numbers
and inspected page ranges. A citation supports the course mechanism: it does
**not** attribute the pack’s invented labels, numerical parameters, examples,
diagrams, or additional counterexamples to the source. Extended reasoning checks
(normalization sensitivity, state-equivalence conditions for safe pruning,
quantifier-order countermodels, and explicit premise consistency) are original
pedagogical clarifications, not purported quotations or exhaustive ebook coverage.

## Benchmark-depth evidence

| Lesson | Source pages and substantive sections | Added mechanism / original evidence |
|---|---|---|
| 01 Introduction | pp.5, 7–11; §03 Conundrums in AI, §11 Four Schools, §17 Cognitive System Architecture | Reaction versus deliberation versus metacognition; versioned library-return trace; strategy-repair feedback diagram; separate object/meta-level transfer exercise. |
| 02 Course introduction | pp.16–18, 25–27; Class Goals, Class Outcomes, Computational Psychometrics, What is intelligence; FA26 pp.3–6 | Outcomes versus activities; two mechanisms yielding the same invented panel answer; discriminating two-dot follow-up; historical Raven/current ARC-AGI distinction. |
| 03 Semantic networks | **pp.28–42**, especially pp.29–32 and 37–40; Structure of Semantic Networks, Characteristics of Good Representations, Choosing Matches by Weights | Lexicon/structure/semantics; within-state versus between-state links; original nested-badge mapping with explicit similarity direction; scheduling abstraction counterexample. |
| 04 Generate & Test | pp.43–52, especially pp.45–49; Dumb Generators/Dumb Testers, Smart Testers, Smart Generators | Separate legality, duplication, and goal tests; nine-to-four candidate trace preserving the accepted answer set; key-inventory counterexample to unsafe duplicate pruning. |
| 05 Means-Ends Analysis | pp.54–62; State Spaces, Differences, Process of Means End Analysis, Problem Reduction; forward §09 Operators at p.175 | Explicit difference measure and applicability; desk-folder trace; required detour with mismatch counts 1→2→1→0; subgoal interactions and preconditions/postconditions. |
| 06 Productions | **pp.67–81**, especially pp.69–79; Levels/Assumptions of Cognitive Architectures, Bringing in Memory, Chunking, Fundamentals of Learning | Architecture/content distinction; procedural/semantic/episodic knowledge; match–select–update cycle; original format-choice impasse and bounded learned chunk. |
| 07 Frames | pp.83–89; How do we make sense of a sentence, Complex Frame Systems, Properties of Frames, Frames and Semantic Nets/Production Systems | Slot/filler/default/inheritance distinctions; borrowing-frame trace with explicit overrides; revision of a default-dependent inference; provenance diagram. |
| 08 Recording cases | pp.94–98; Learning by Recording Cases, Case Retrieval by Nearest Neighbor, k-Dimensional Space | Retention versus concept abstraction; exact squared-distance tie 4/10/4; explicitly original weighted extension 4/37/16; unit-sensitivity transfer and reuse limitation. |
| 09 CBR | pp.102–114; Assumptions, model/recursive/rule adaptation, Evaluation, Storage by Index/Discrimination Tree, Retrieval Revisited | Retrieve–adapt–evaluate–store with failure loops; directed archive-route composition; inappropriate origin-only index; missing-feature retrieval limitation. |
| 10 Incremental learning | pp.122–130; Variabilization, Ignore/Require/Exclude Features, Background Knowledge, Heuristics | All seven requested operations; optional versus mandatory relation semantics; labelled stand-learning trace; taxonomy overgeneralization and interval limitations; coverage/label decision diagram. |
| 11 Classification | pp.136–147, especially pp.139–146; Equivalence Classes, Concept Hierarchies, Axiomatic/Prototype/Exemplar Concepts, Bottom-Up Search | Classifying versus learning; three distinct membership justifications; atypical pedestal-seat trace; missing-evidence and study-space transfer. |
| 12 Logic | **pp.149–171**, especially pp.150–159, 161–165; Predicates, Truth Tables, Implication Elimination, Rules of Inference, Universal Quantifiers, A Simple/More Complex Proof | Premises/interpretation/entailment; modus ponens/tollens; converse countermodel; CNF and full original propositional refutation; quantified scope transfer and proof-dependency diagram. |

Every benchmark lesson has at least three substantial mechanism paragraphs, a
visible canonical vocabulary table, at least three assumptions/counterexample
checks, a multi-step original worked trace, a separate transfer exercise, and
one original graph with labelled edges, node details, narrated active-node
steps, a caption, and a text alternative. Graphs are neither images nor executable
HTML. Their different topologies encode the argument: branches for alternatives,
feedback for adaptation, and two-parent dependencies for resolution.

### Specific vocabulary checks

- **move-object / move-possession / ingest:** p.202 primitive-action figure and
  pp.203–205 interpretation/role discussion. Physical movement, possession
  transfer, and ingestion are distinguished; historical examples do not become
  current project specifications.
- **preconditions / postconditions:** p.175, Lesson13 §09 Operators. Their use
  in Lesson05 is explicitly marked as a forward connection.
- **specific model / general model:** p.253, Lesson19 §03 Abstract Version Spaces.
  Conventional S/G notation does not replace the textbook vocabulary.
- **knowledge gap → learning goal:** p.317, Lesson24 §03 Beyond Mistakes Knowledge
  Gaps. Detection, goal generation, and obtaining the missing knowledge are
  separate steps.
- **Variabilization / drop-link / require-link / forbid-link / enlarge-set /
  climb-tree / close-interval:** pp.123–130. Drop-link is substantively explained
  at p.124, require-link at p.125, forbid-link at p.126, set enlargement at p.127,
  taxonomy climbing at pp.127–128, and close-interval at p.130. Near-miss wording
  is a pedagogical label for the focused contrasting negatives, not a claim of a
  verbatim source sentence.

## Preservation and migration evidence

- **66 current original questions:** 44 `e1-*` and 22 `e2-*`; question IDs,
  prompts, option order, text, correctness, and option explanations are preserved.
  Their current bank revision is **3**, as in the baseline workbook.
- **78 recall cards:** exact prompt/answer pairs retained as three recall blocks
  per lesson. A legacy card `01-1` maps deterministically to canonical block
  `lesson-01-recall-1`; the contract’s letter-leading IDs preclude using the raw
  numeric legacy ID as a block ID.
- **Historical question bank:** `legacy-questions.json` has keys `"1"`, `"2"`,
  `"3"`, each mapping the 66 original question IDs to canonical question snapshots.
  `questionAtRevision` is evaluated at conversion, including all
  `LEGACY_OPTIONS` and `PREVIOUS_QUESTIONS` changes. Stable `option-1` through
  `option-5` correspond to legacy zero-based option indices 0–4. Revision1 and
  revision2 keys are not overwritten with current answers.
- **Exact focus sequence:** `legacy-focus-map.json` maps each two-digit numeric
  lesson ID to an array of canonical block IDs in the old `focusSteps` order:
  preview, guide sections, each individual worked trace step, attempt, comparison,
  three recalls, finish. Every trace position has its own block; no invented
  nearest-location matching or collapsing several steps onto one block is used.
  All 26 sequences are fully mapped, with lengths 15–18. App migration is outside
  this content change.
- Tests use fixed SHA-256 preservation fingerprints for current learner question
  fields, all three historical snapshots, and recall prompt/answer fields.
  They do not require the private inputs to exist.

## Fall2026 administration

The complete **17-week** baseline schedule is retained against the supplied
p.3 calendar, including ARC-AGI milestones A–D, final project, mini-projects,
homeworks, participation activities, and optional study/reflection prompts.

| Exam | Scope | Due time | Timezone | Format |
|---|---|---|---|---|
| Exam1 | Lessons01–12 | `2026-10-11T23:59:00-12:00` | `Etc/GMT+12` | 90 minutes; 22 questions; five options; one to four correct |
| Exam2 | Lessons13–25 | `2026-12-13T23:59:00-12:00` | `Etc/GMT+12` | 90 minutes; 22 questions; five options; one to four correct |

The IANA name’s reversed sign denotes UTC−12. The actual syllabus says official
exams award partial credit, but does **not** disclose a grading formula.
Original diagnostic exact-set/decision feedback is therefore not advertised as
the official partial-credit grade or an exam prediction.

AI may be used for conceptual discussion and learning. It may not generate or
directly supply assessed code, reports, or document content. Actual proctored
exam questions must not be copied, retained, shared, or entered into a tool that
preserves access afterward. These boundaries are visible pack policies cited to
FA26 p.6, not merely an external disclaimer.

## Real limitations and unverified material

1. **Later depth:** Lessons13–26 keep foundation explanations and original
   practice. Their exact baseline heading/definition pairings have not all been
   rechecked, and they do not have newly authored benchmark diagrams.
2. **External readings:** all 53 retained bibliographic entries are marked
   **unverified**. Full texts, editions, exact page claims, and link availability
   were not inspected. No local reading filename or PDF is published.
3. **Preserved guide anchors:** the old guide section-to-paragraph association
   sometimes differs from the substantive source section or crosses a page
   boundary. Preserved guide blocks are marked unverified; new mechanism blocks
   use checked substantive ranges. Unverified is not silently upgraded because
   a heading exists nearby.
4. **Source transcript gaps:** ebook p.3 reports correspondence problems for
   Lessons02/04/14/25 and incomplete transcripts in Lessons03/05/24/25. This work
   does not reconstruct missing transcripts or claim video/timestamp validation.
5. **Calendar display discrepancy:** p.3 specifies Sunday 23:59 AoE. The exported
   local-time summary on pp.7–9 displays other dates/times, and the end-of-course
   survey summary differs from the week17 planning date. The pack retains p.3’s
   planning calendar and flags the discrepancy; it does not invent a reconciliation.
6. **Live authority:** authenticated current Canvas/Ed/Gradescope instructions,
   assignment-specific rubrics, exam opening times, and subsequent announcements
   were not reviewed. They can supersede this supplied syllabus snapshot.
7. **Logic boundary:** quantifiers and predicate concepts are covered, but the
   worked resolution proof is propositional. Full first-order normalization,
   Skolemization, unification, and exhaustive proof-search algorithms remain
   outside this expansion.
8. **Validation is not mastery:** structural tests and preservation hashes verify
   the artifact, not learners’ understanding or a guaranteed human cognitive model.

## Quantitative evidence and checks

Learner-visible block text is counted by whitespace tokens in explanations,
lists, examples, table rows, recall pairs, diagram labels/details, and narrated
steps; IDs and JSON property names are excluded. These are **rendered-content
counts, not unique-prose counts**: preservation of separate focus steps repeats
some setup text, and vocabulary and source-locator rows also contribute. They are
not a claim of having transcribed or covered every source paragraph.

The final validated artifact has **37,440 rendered-content words** overall,
including **23,778 words in Lessons01–12** and **13,662 words in Lessons13–26**.
Individual benchmark lessons range from **1,721 to 2,460** words, compared with
the conservative baseline JSON inventory of roughly 393–555 words per lesson.
The tests enforce each benchmark lesson exceeds 1,500 words and 2.5 times its
baseline inventory, independently of private inputs.

| Benchmark lesson | Rendered-content words |
|---|---:|
| 01 | 2,177 |
| 02 | 1,941 |
| 03 | 1,866 |
| 04 | 1,744 |
| 05 | 1,834 |
| 06 | 2,011 |
| 07 | 1,721 |
| 08 | 1,877 |
| 09 | 2,095 |
| 10 | 2,124 |
| 11 | 1,928 |
| 12 | 2,460 |

The pack contains **150 concepts, 673 blocks, 12 diagrams, 66 questions, and
78 recall blocks**. The generated JSON is **1,204,434 bytes**, below the shared
8 MB ceiling. Historical snapshots are stored separately and contain no source
PDF assets.

Validation commands:

```sh
npx tsx scripts/build-kbai.ts                 # explicit conversion; private inputs needed only here
npx vitest run tests/content.test.ts          # persistent-output tests; no private inputs needed
npx eslint scripts/build-kbai.ts tests/content.test.ts
npx tsc --noEmit
```

Content tests enforce canonical validation, all 26/17/66/78 preservation
invariants, historical answer keys, exact focus mappings, meaningful depth,
distinct original diagrams, visible terms and source anchors, policy boundaries,
and absence of published input paths/PDF bytes. No contract, app, persistence,
migration, or toolchain changes are required by this content conversion.

Final revision4 release-hardening checks: **21 content tests passed** after JSON
generation; shared validation succeeded with the cube cover, both fingerprinted
PDF declarations, and bidirectional ownership.
Earlier implementation checks passed ESLint and `tsc --noEmit`; these were not
rerun for this content-only hardening. The private source-inspection image was
removed. No commit was created.
