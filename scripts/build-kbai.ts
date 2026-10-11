import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';
import { validateCoursePack, type Block, type Citation, type CoursePack, type Question } from '../packages/course-pack/src/index.ts';

type LegacyLesson = {
  id: string; title: string; pages: [number, number]; prior: string[]; thesis: string; engineer: string;
  deep: string[]; objectives: string[]; traps: string[]; contrast: [string, string]; readings: string[];
  worked: { title: string; setup: string; steps: [string, string, string][]; result: string; limit: string };
  exercise: { prompt: string; rubric: string[]; answer: string }; cards: [string, string][];
};
type LegacyQuestion = { id: string; lesson: string; prompt: string; options: { text: string; correct: boolean; explanation: string }[] };
type LegacyWeek = {
  number: number; start: string; due: string; lessons: string[]; title: string; focus: string;
  deliverables: { key: string; title: string; kind: string; url?: string }[];
  prep: string[]; application: string; reflection: string; next: string; revisit: string[];
};
type LegacyGuide = { sections: [string, number, string | number][]; terms: [string, string, number][] };
type LegacyStep = { key: string; kind: string; heading: string; page: number; text?: string; index?: number };
type LegacyReading = { id: string; title: string; use: string; url?: string; tier: string };
type Baseline = {
  lessons: LegacyLesson[]; weeks: LegacyWeek[]; questions: LegacyQuestion[];
  guides: Record<string, LegacyGuide>; readings: LegacyReading[];
  snapshots: Record<string, LegacyQuestion[]>; focus: Record<string, LegacyStep[]>;
};
type Term = [term: string, definition: string, page: number, end?: number];
type Section = [title: string, page: number, end: number, explanation: string];
type Example = { title: string; problem: string; steps: string[]; conclusion: string };
type Diagram = {
  title: string; caption: string; alternative: string;
  nodes: [label: string, detail: string, column: number][];
  edges: [from: number, to: number, label: string][];
  steps: [title: string, explanation: string, active: number[]][];
};
type Depth = { terms: Term[]; sections: Section[]; assumptions: string[]; trace: Example; transfer: Example; diagram: Diagram };

const date = '2026-10-11T11:22:51.031Z';
const chapterId = (id: string) => `lesson-${id}`;
const slug = (term: string) => term.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const conceptId = (term: string) => `kbai-${slug(term)}`;
const ebook = (page: number, end = page, section = 'Lesson concepts'): Citation => ({
  sourceId: 'ebook-2016', pdfPage: page, pdfPageEnd: end, printedPage: page === end ? `${page}` : `${page}–${end}`, section, verification: 'verified',
});
const syllabus = (page: number, section: string): Citation => ({
  sourceId: 'syllabus-fa26', pdfPage: page, printedPage: `${page}`, section, verification: 'verified',
});
const original: Citation = { sourceId: 'original-handbook', section: 'Original teaching example, not source text or an assessed submission', verification: 'verified' };
const sourcePdfAssets: CoursePack['assets'] = [
  { id: 'asset-ebook-2016-pdf', sourceId: 'ebook-2016', mediaType: 'application/pdf', filename: 'kbai-2016-ebook.pdf', sha256: '9f8e120b152fcdee0e1f59ddec10e7c522c26d3578f594fea91ee69e52e1a6ff' },
  { id: 'asset-syllabus-fa26-pdf', sourceId: 'syllabus-fa26', mediaType: 'application/pdf', filename: 'kbai-fall2026-syllabus.pdf', sha256: 'fdf83711dde8bbe1bd51352d3d255c947ce17408f81d61454ff98f2595679d32' },
];

// Evaluation is restricted to these trusted baseline data files at conversion time.
export function readBaseline(): Baseline {
  const context = vm.createContext(Object.create(null), { codeGeneration: { strings: false, wasm: false } });
  for (const file of ['course.js', 'focus-content.js', 'practice.js']) {
    vm.runInContext(readFileSync(resolve('.inputs/baseline', file), 'utf8'), context, { filename: file, timeout: 2000 });
  }
  return JSON.parse(vm.runInContext(`JSON.stringify({
    lessons: LESSONS, weeks: WEEKS, questions: QUESTIONS, guides: EBOOK_GUIDES, readings: READINGS,
    snapshots: Object.fromEntries([1,2,3].map(revision => [revision, QUESTIONS.map(q => questionAtRevision(q, revision))])),
    focus: Object.fromEntries(LESSONS.map(lesson => [lesson.id, focusSteps(lesson.id)]))
  })`, context, { timeout: 2000 })) as Baseline;
}

const depth: Record<string, Depth> = {
  '01': {
    terms: [
      ['Knowledge representation', 'A language and its expressed knowledge content, structured so a reasoning method can use relevant objects, properties, and relations.', 28, 29],
      ['Reasoning', 'Using available knowledge to infer, decide, interpret, or solve a problem; it interacts with learning and memory rather than operating in isolation.', 7],
      ['Deliberation', 'The interacting processes of reasoning, learning, and memory that use knowledge to choose what to do, rather than mapping a percept directly to an action.', 7, 11],
      ['Reaction', 'A direct percept-to-action mapping that need not construct a plan. It is an architectural role, not a claim that the behavior is unintelligent.', 10],
      ['Metacognition', 'Reasoning about the agent’s own reasoning, learning, or reactive processes; monitoring a strategy and changing it is different from solving the external task.', 11],
      ['Learning', 'Changing available knowledge through experience or instruction, with what and when to learn constrained by the agent’s reasoning needs.', 7],
      ['Memory', 'Storing learned knowledge and making relevant knowledge available to reasoning; retrieval is as important as accumulation.', 7],
      ['Cognitive system', 'A system whose interacting components aim at human-like intelligence and are situated in a physical and potentially social environment.', 9, 10],
      ['Four schools of AI', 'The perspectives formed by thinking versus acting and human-like versus rational evaluation. A system can support more than one perspective.', 7, 9],
    ],
    sections: [
      ['The conundrums determine the design', 5, 5, 'Limited computational resources confront potentially intractable problems; local computation must respect global constraints; deductive computation must support tasks involving induction or abduction; static, limited knowledge must cope with a changing, open-ended world; and explaining a decision adds work to producing it. These are not five separate implementation bugs. They motivate representational choices, selective retrieval, heuristics, and monitoring. A dependency graph can expose a global constraint, but traversing a nearby edge is still a local computation. An agent must decide which local operations preserve the constraint and when its information is insufficient. A good benchmark score alone does not show that these tensions have been solved generally.'],
      ['Three layers, not three disconnected boxes', 7, 11, 'Reaction maps percepts to actions directly. Deliberation coordinates learning, memory, and reasoning about the external world. Metacognition reasons about these processes: it can recognize that a strategy lacks needed knowledge or repeatedly fails. The same observation can enter more than one layer. A warning signal may trigger a reaction while also being stored for later deliberation. Architecture specifies roles and connections, not necessarily separate threads or modules. Calling every feedback loop metacognition would erase an important distinction: changing a world-state estimate is object-level reasoning; changing how the estimate is produced is meta-level reasoning. The source’s three-layer account does not require every action to pass serially through all layers.'],
      ['Human-like and rational are evaluation questions', 7, 9, 'A thinking-humanly model asks whether its internal process resembles human cognition; an acting-humanly model asks about observed behavior. Rational thinking and acting ask whether inference or action meets an appropriate normative criterion. A system can produce the same action as a human by a different process. Conversely, a cognitive model can reproduce a human error without being a desirable controller. Evidence for human-like processing requires more than equal final answers: intermediate decisions, error patterns, or controlled predictions can discriminate mechanisms. Rationality also depends on available information and computational limits; it does not mean omniscience. These perspectives help state exactly what a demonstration supports.'],
    ],
    assumptions: ['Specify the percepts, action repertoire, goal, and knowledge actually available; do not secretly grant the agent the answer.', 'An explanation must distinguish observed facts, remembered episodes, and inferred hypotheses.', 'A direct reaction can succeed in a familiar context and fail when the context changes; deliberation is not automatically superior under a severe time limit.'],
    trace: {
      title: 'Original worked trace: a library-return assistant',
      problem: 'A paper assistant sees a returned book with no shelf label. Its goal is to propose a shelf, not to move the book autonomously. It remembers two evaluated returns and a catalogue relation.',
      steps: ['Percept: book B has a missing label. Reaction marks B for review; that action does not infer a subject.', 'Representation: CatalogueSubject(B, astronomy) and ShelfFor(astronomy, S4) are available. Memory retrieves an earlier astronomy return to S4.', 'Deliberation proposes S4 by combining the catalogue relation with the shelf rule. The episode is corroborating experience, not proof of the rule.', 'A new catalogue revision says astronomy is now on S7. Reasoning updates the proposal. Metacognition notices that relying on old return episodes without checking catalogue version caused the mismatch.', 'Learning records the evaluated S7 return with its catalogue version and changes the retrieval strategy to require compatible versions.'],
      conclusion: 'The external answer changes from S4 to S7; the meta-level change is the requirement to check version compatibility. These are original data and labels, not a textbook example.',
    },
    transfer: {
      title: 'Transfer exercise: separate world change from strategy change',
      problem: 'A museum guide sends a visitor to a room remembered from last month. The exhibition moved yesterday. Give one object-level repair and one meta-level repair, then state what evidence would distinguish human-like from merely successful behavior.',
      steps: ['Write the observed room change separately from the outdated memory.', 'Update the proposed destination using the current exhibition directory.', 'Change retrieval to prefer recent directory-backed episodes; explain why this is reasoning about the reasoning process.', 'Construct an unseen case in which the older episode remains valid, so recency alone is not treated as an infallible rule.'],
      conclusion: 'A strong answer updates the world model and the method independently, and proposes evidence about intermediate reasoning rather than only arrival success.',
    },
    diagram: {
      title: 'Three-layer architecture with a strategy-repair loop',
      nodes: [['Percepts', 'A missing label and a later catalogue revision enter the system.', 0], ['Reaction', 'Flag the unlabelled book for review without choosing a shelf.', 1], ['Deliberation', 'Combine catalogue knowledge, retrieved experience, and the shelf goal.', 1], ['Memory and learning', 'Retrieve versioned episodes and store the evaluated new return.', 2], ['Metacognition', 'Detect reliance on stale episodes and require version checks.', 2], ['Proposal', 'Offer shelf S7 with an explanation of the current evidence.', 3]],
      edges: [[0, 1, 'direct mapping'], [0, 2, 'represented evidence'], [2, 3, 'retrieve and retain'], [3, 2, 'available knowledge'], [2, 4, 'strategy mismatch'], [4, 2, 'repair retrieval control'], [2, 5, 'reasoned action']],
      steps: [['Observe', 'Input can support a direct reaction and deliberation; neither branch implies the other.', [0, 1, 2]], ['Deliberate', 'Memory supplies a candidate, while reasoning checks the current catalogue.', [2, 3]], ['Monitor and repair', 'The mismatch prompts a change to retrieval control, not merely a changed shelf fact.', [2, 4]], ['Act and learn', 'The corrected proposal and its evaluated context become usable experience.', [3, 5]]],
      caption: 'Original mechanism diagram: metacognition modifies deliberation, while reaction can bypass it. This is a teaching model, not a reproduced source figure.',
      alternative: 'Percepts branch to reaction and deliberation. Deliberation exchanges knowledge with memory, reports a strategy mismatch to metacognition, receives a control repair, and produces a shelf proposal.',
    },
  },
  '02': {
    terms: [
      ['Computational psychometrics', 'Building and evaluating computational models on intelligence-test tasks, using performance and mechanisms to investigate cognition rather than equating test success with general intelligence.', 18, 25],
      ['Represent and reason', 'Express a task and relevant knowledge in a representation, then apply a reasoning method whose operations use that representation.', 26],
      ['Generalizing knowledge', 'Reusing a regularity beyond the particular observations from which it was obtained; successful reuse depends on which structure is preserved.', 26, 27],
      ['Raven’s Progressive Matrices', 'The historical visual-analogy test used to discuss computational psychometrics in the 2016 ebook; it is not the Fall2026 ARC-AGI assignment specification.', 18, 25],
      ['Cognitive connection', 'Using hypotheses about human cognition to inform AI designs, and AI mechanisms to generate testable hypotheses about human cognition.', 17, 25],
    ],
    sections: [
      ['Goals, outcomes, and evidence are different', 16, 17, 'The course’s goals cover structured representation, memory, reasoning, learning, architectures, meta-reasoning, recurring tasks, and connections with cognitive science. Outcomes require designing, implementing, evaluating, and describing agents, applying methods to practical problems, and relating AI to cognition. Reading a lesson is an activity, not evidence that an outcome has been achieved. To evaluate a design, record the knowledge used, intermediate states, choice points, and conditions under which it fails. A final answer without its mechanism cannot distinguish a well-founded inference from a lucky guess. A description should identify a representation and an executable reasoning process, not just list method names.'],
      ['Psychometric tasks expose competing mechanisms', 18, 25, 'An analogy task may be addressed by inducing a relation from completed pairs and transferring it, or by inserting each candidate and testing global consistency. Both can yield the same answer. Computational psychometrics makes the mechanisms inspectable and encourages comparison with human behavior, but a test is a restricted task sample. A transformation that fits one pair may be underdetermined: object deletion and object scaling can both fit a simplified observation. Further pairs, prior knowledge, or explicit preferences are needed. A score supports claims about the tested task distribution, not a conclusion that an agent possesses every ability associated with intelligence.'],
      ['Administrative precedence is part of accurate studying', 16, 17, 'The 2016 ebook’s Raven assignments illustrate historical ideas; they do not specify current assessed work. The Fall2026 syllabus instead specifies ARC-AGI milestones and a final project, mini-projects, homeworks, participation, and two exams. This pack offers original paper exercises for learning, not generated assessed submissions. The weekly calendar is a planning aid; official announcements and current linked instructions can supersede it. Preserve this separation when transferring a method: understanding a generate-and-test mechanism is permitted learning, while asking an assistant to write the agent or report to submit is outside the stated AI policy. Exact exam scope and deadlines belong in the syllabus metadata, not inferred from old lecture assignments.'],
    ],
    assumptions: ['A benchmark samples a task family; state which unseen variations would test transfer.', 'Do not infer the internal human process uniquely from one correct answer.', 'Historical lecture examples are pedagogical evidence, not current administrative authority; live assignment details have not been inspected here.'],
    trace: {
      title: 'Original worked trace: distinguish induction from candidate testing',
      problem: 'On a paper pattern task, pair A changes [square, dot] into [square]; pair C changes [triangle, dot] into an unknown panel. Candidates are [triangle], [dot], and [triangle, dot].',
      steps: ['Represent each panel as a set of typed objects; do not rely on the arbitrary object names.', 'Mechanism I induces “delete the dot, preserve the other object” from A and applies it to C, yielding [triangle].', 'Mechanism II inserts [triangle], compares the completed pair with A, and accepts the shared deletion relation; it rejects the other candidates.', 'Both mechanisms choose the same candidate. Record their different intermediate actions rather than treating output agreement as process agreement.', 'Add an unseen pair with two dots and one square. Ask whether the induced rule deletes one dot or all dots; the original pair did not settle that question.'],
      conclusion: 'A discriminating follow-up exposes an unresolved generalization. This is an invented tiny task, not an actual intelligence-test item or course exam question.',
    },
    transfer: {
      title: 'Transfer exercise: design an evaluation without generating assessed work',
      problem: 'An assistant classifies invented archive labels correctly on three familiar examples. Write a paper evaluation plan that could reveal memorization, then connect it to the course’s design–evaluate–describe outcome.',
      steps: ['Change irrelevant names while preserving the intended relation.', 'Change the relation while retaining familiar names; specify the expected output before testing.', 'Log which evidence was retrieved and which rule was applied.', 'Explain which claim remains unsupported even if all tests pass, and do not produce a submission-ready project implementation.'],
      conclusion: 'Evaluation should discriminate mechanisms and test an explicit transfer claim. Three successes cannot establish general intelligence or predict an official exam grade.',
    },
    diagram: {
      title: 'Equal answers do not identify equal mechanisms',
      nodes: [['Observed pair', 'A set containing a square and dot becomes a set containing a square.', 0], ['Induce relation', 'Hypothesize dot deletion and preservation of the other object.', 1], ['Insert candidate', 'Try a triangle-only candidate and compare completed relations.', 1], ['Shared answer', 'Both mechanisms select the triangle-only panel.', 2], ['Discriminating test', 'Introduce two dots to distinguish one-dot deletion from all-dot deletion.', 3]],
      edges: [[0, 1, 'infer a transformation'], [0, 2, 'generate and test'], [1, 3, 'apply to target'], [2, 3, 'accept candidate'], [3, 4, 'test underdetermination']],
      steps: [['Record observations', 'Represent both panels as typed object sets before choosing a method.', [0]], ['Compare mechanisms', 'One branch induces before transfer; the other tests candidates against relations.', [1, 2]], ['Separate output from explanation', 'Agreement at the answer node does not collapse the two paths.', [3]], ['Test transfer', 'The two-dot follow-up asks what was really generalized.', [4]]],
      caption: 'Original diagram of a computational-psychometrics argument: process evidence matters, and new task variations can expose competing explanations.',
      alternative: 'One observed pair feeds an induction branch and a candidate-testing branch. Both join at the same answer, followed by a two-dot test that can distinguish the learned regularity.',
    },
  },
  '03': {
    terms: [
      ['Semantic network', 'A representation using nodes for entities and directed, labelled links for relations; meaning requires an interpretation of node types and link labels.', 29, 32],
      ['Lexicon', 'The vocabulary of symbols available in a representation, such as object nodes and relation labels.', 31],
      ['Structure', 'The rules for composing representation symbols, including the direction and connectivity of links.', 31],
      ['Semantics', 'The interpretation of a representation that makes some inferences legitimate; merely drawing an edge does not establish its meaning.', 31],
      ['Transformation', 'A represented change between situations, such as preserving, deleting, or scaling an object; it is different from a within-situation relation.', 30, 31],
      ['Weighted matching', 'Ranking alternative correspondences or transformations with a stated similarity preference; in the ebook’s scale larger weights indicate greater ease and similarity.', 39],
    ],
    sections: [
      ['Make objects, relations, and changes explicit', 29, 32, 'A semantic net needs a lexicon, a structural specification, and semantics. In an object diagram, a node can stand for an object and a directed edge labelled inside or left-of can describe a relation. A second graph can describe the next situation. Correspondence links then express identity or transformation across the two situations. Do not conflate “object X is inside Y” with “X was deleted”: the first relates objects within a state; the second relates a represented object to a change between states. Naming all nodes is not enough if the representation omits the relation that decides the problem. Likewise, an unlabelled connection offers no rule for inference.'],
      ['A good representation is task-relative', 31, 34, 'The source emphasizes explicit relationships, natural constraints, appropriate abstraction, transparency, concision, completeness for the task, and computability. Completeness here is not a demand to store every fact about the world. A queue-order problem needs order relations; knowing only each job’s colour can be concise but insufficient. A state-space representation must also include variables affecting legal transitions. If two states share object counts but differ in whose turn it is, merging them may be unsound. Semantic nets can expose constraints and possible transitions, but a reasoning method must still traverse, compare, or transform the net. Representation is not itself a complete solver.'],
      ['Competing matches need an explicit preference', 37, 40, 'The same observation can admit multiple object correspondences. A preserved outer object plus a deleted inner one may compete with a scaled inner object plus a deleted outer one. The ebook illustrates a similarity score whose larger weights mean easier transformations; preserve that direction when explaining its example. A custom cost metric could instead prefer lower values, but must be named as a different convention. Scores operationalize preferences rather than proving that only one interpretation is possible. Test whether reversing or changing a weight changes the selected correspondence, and report ties honestly. A hidden preference can make a matcher look more decisive than the evidence warrants.'],
    ],
    assumptions: ['Object identity across panels is a hypothesis to be justified, not a consequence of identical labels invented by the modeller.', 'Keep edge direction and relation semantics consistent; inside(A,B) does not imply inside(B,A).', 'A weighted preference is not an entailment. Under a different justified metric, an alternative correspondence may win.'],
    trace: {
      title: 'Original worked trace: represent a nested badge transformation',
      problem: 'Badge A has a large hexagon H containing a small circle C. Badge B has only a large hexagon. Badge P has a large pentagon containing a small star. Infer a candidate transformed P.',
      steps: ['Encode A with nodes H and C and edge inside(C,H). Encode B separately, without inventing an inside relation that has no second object.', 'Mapping M1 preserves H and deletes C. Mapping M2 deletes H and transforms C into a hexagon. Both can be described, but M2 needs a shape change and scaling.', 'Under the invented preference preserve=6, delete=1, shape-change=0, scale=2, M1 scores 7 and M2 scores 3. Larger scores mean preferred similarity in this teaching metric.', 'Transfer M1 by preserving the pentagon and deleting its contained star. The within-panel inside edge disappears because its inner endpoint was removed.', 'Check a target whose inner object is not contained; the structural correspondence supporting the transfer is then missing.'],
      conclusion: 'The proposed pentagon-only result depends on represented containment and the explicit preference. The weights and badges are original, not the ebook’s numbers or figures.',
    },
    transfer: {
      title: 'Transfer exercise: choose the right abstraction for job scheduling',
      problem: 'Two print jobs have identical owner and page count, but one waits for an approval and one does not. A semantic-net scheduler merges them. Explain the mistake and repair the representation on paper.',
      steps: ['Add a status or prerequisite relation that distinguishes approved from pending jobs.', 'Define which relation enables scheduling, keeping direction explicit.', 'Construct two states with identical visual properties but different legal successors.', 'Explain why storing printer serial numbers might be irrelevant while omitting approval is not.'],
      conclusion: 'A good repair preserves task-relevant distinctions and demonstrates different successor sets; it does not merely add more decorative nodes.',
    },
    diagram: {
      title: 'Within-state relations versus between-state transformations',
      nodes: [['H: large hexagon', 'Outer object in source badge A.', 0], ['C: small circle', 'Inner circle with an explicitly directed inside(C,H) relation.', 0], ['H′: large hexagon', 'Candidate corresponding outer object in badge B.', 1], ['Deleted C', 'No corresponding inner object remains in badge B.', 1], ['P: large pentagon', 'Outer object in the target badge.', 2], ['Target without star', 'Preserve P and delete its contained star under mapping M1.', 3]],
      edges: [[1, 0, 'inside: within state'], [0, 2, 'preserve: across states'], [1, 3, 'delete: across states'], [2, 4, 'align outer roles'], [4, 5, 'transfer chosen mapping']],
      steps: [['Represent', 'The containment edge points from inner C to outer H.', [0, 1]], ['Describe change', 'Preserve and delete connect the interpretation across states, not two objects in one state.', [2, 3]], ['Align', 'The target pentagon shares an outer role, not the source hexagon’s identity.', [4]], ['Transfer and qualify', 'The star is removed only if the structural match and preference are accepted.', [5]]],
      caption: 'Original semantic-network teaching diagram. Different edge labels carry different semantics; positions are for readability, not additional spatial facts.',
      alternative: 'The source circle points inside the hexagon. The hexagon is preserved into the next badge, the circle is deleted, and the chosen outer-object role is aligned with a target pentagon before transfer.',
    },
  },
  '04': {
    terms: [
      ['Generate and test', 'A problem-solving method that proposes candidate states or solutions and checks them against constraints and the goal.', 43, 48],
      ['Generator', 'The component that proposes candidates; knowledge can restrict generation to relevant, legal, or nonredundant possibilities.', 45, 47],
      ['Tester', 'The component that checks a proposed candidate; legality, duplication, and goal satisfaction are distinct possible tests.', 45, 47],
      ['Smart generator', 'A generator that incorporates useful knowledge before materializing candidates, while preserving alternatives needed by the task.', 47],
      ['Smart tester', 'A tester that uses additional knowledge, such as previously visited states, to reject redundant or unsuitable candidates.', 46, 47],
      ['Combinatorial explosion', 'Rapid growth in candidate sequences or states as alternatives multiply; repeated paths can enlarge the search even when distinct states are few.', 45, 46],
    ],
    sections: [
      ['Separate proposing from accepting', 43, 47, 'Generate-and-test makes two responsibilities visible. The generator proposes candidates; the tester decides whether they satisfy specified conditions. A candidate can be structurally well formed but illegal, legal but already visited, or legal and new but not a goal. Combining these cases into one “bad” label hides why the search behaves as it does. In iterative state search, an accepted non-goal candidate becomes a new state to expand. To recover a solution sequence rather than only a final state, store enough parent or path information. A domain representation supplies the features and relations needed by generation and testing, but does not choose the whole search procedure by itself.'],
      ['Place knowledge where it avoids waste', 45, 48, 'The ebook contrasts dumb generators and testers with smarter versions. A tester can reject a repeated state after it is generated. A generator can instead avoid proposing that state, saving construction and test effort. The knowledge has shifted location; the intended accepted state set need not change. Early checks are particularly useful for cheap constraints, while expensive checks may be deferred. This is an engineering trade-off rather than a universal command to push every test into generation. A complex generator can itself be costly or hard to verify. Measure proposed candidates, test work, and retained states separately before claiming an efficiency gain.'],
      ['Pruning requires a state-equivalence argument', 46, 49, 'Repeated-state elimination is safe only when the representation includes all information affecting future possibilities and costs relevant to the objective. If access depends on a collected token, “same room” is not a complete state. If one path is cheaper than another and the goal is minimum cost, a visited set that discards every later arrival can preserve reachability but lose optimality. The source’s merging example illustrates redundancy in its simplified domain, not a theorem for all tasks. Finite exhaustive generation with fair exploration and a correct tester can establish whether a represented solution exists; arbitrary pruning, incomplete candidates, or unbounded cycles remove that assurance.'],
    ],
    assumptions: ['A legal candidate is not automatically a goal; maintain independent legality and goal predicates.', 'Sound rejection means a discarded candidate cannot contribute a required solution under the stated representation and objective.', 'A finite candidate space does not make a cyclic path generator efficient or guarantee termination without suitable control.'],
    trace: {
      title: 'Original worked trace: choose a two-label archive code',
      problem: 'Choose an ordered code of length two from {A,B,C}. Symbols must differ, and C cannot be first. The goal additionally requires the second symbol to be C.',
      steps: ['A dumb generator proposes AA, AB, AC, BA, BB, BC, CA, CB, CC: nine candidates.', 'The legality tester rejects AA, BB, CC for repetition and CA, CB for the first-symbol rule. AB, AC, BA, BC remain legal.', 'The goal tester accepts AC and BC, not AB or BA. Reporting one solution is a different task from enumerating all solutions.', 'A smart generator chooses first from {A,B} and second from the remaining symbols, generating only AB, AC, BA, BC: four candidates.', 'The accepted goal set remains {AC,BC}; effort changes without changing the answer set. A generator that always starts with A would improperly omit BC if enumeration is required.'],
      conclusion: 'Legality knowledge reduces generation from nine candidates to four. The trace uses original labels and constraints, not a course project solution.',
    },
    transfer: {
      title: 'Transfer exercise: repair a faulty duplicate-state test',
      problem: 'A paper maze solver represents a state only by room name. A room can be revisited after collecting a key, and a door opens only with that key. Show how the “already visited room” tester loses a solution.',
      steps: ['Write separate states (room R, no key) and (room R, key held).', 'List a legal door transition available only in the second state.', 'Replace room-only equality with equality over room and inventory.', 'If path length matters, explain why arrival cost or search ordering also deserves attention.'],
      conclusion: 'The answer must exhibit a lost successor, not simply assert that more memory helps. Correct pruning depends on the state model and objective.',
    },
    diagram: {
      title: 'Knowledge can move from tester to generator',
      nodes: [['Nine codes', 'All ordered pairs over A, B, C are proposed by a dumb generator.', 0], ['Legality test', 'Reject repeated symbols and codes beginning with C.', 1], ['Four legal codes', 'AB, AC, BA, BC remain; legality is not the goal.', 2], ['Goal test', 'Keep codes ending in C: AC and BC.', 3], ['Smart generation', 'Choose first from A/B and a distinct second symbol.', 1]],
      edges: [[0, 1, 'late constraint checks'], [1, 2, 'retain legal candidates'], [2, 3, 'separate goal check'], [4, 2, 'same legal set, less generation']],
      steps: [['Count proposals', 'Nine candidates are materialized before legality testing in the first path.', [0]], ['Check legality', 'Five candidates fail the stated symbol constraints; four distinct legal codes survive.', [1, 2]], ['Check goal', 'Only AC and BC meet the final requirement.', [3]], ['Shift knowledge', 'Early constraint-aware generation reaches the same four legal candidates without the rejected five.', [4, 2]]],
      caption: 'Original comparison diagram: the shared legal-set node is the invariance claim that justifies this optimization, not a blanket proof that all pruning is safe.',
      alternative: 'A nine-code path passes through a legality tester to four legal codes and then a goal tester. A smarter generator enters directly at the same four-code node.',
    },
  },
  '05': {
    terms: [
      ['Means-ends analysis', 'Compare current and goal states, identify differences, and select an applicable operator intended to reduce a relevant difference.', 55, 59],
      ['State space', 'The represented states and possible transitions obtained by applying operators, with the chosen abstraction determining what counts as a state.', 54],
      ['Difference', 'A task-relevant mismatch between current and desired state, used to guide choice; it need not equal true remaining solution cost.', 55, 56],
      ['Operator', 'A represented action that changes a state when its applicability conditions hold.', 56],
      ['Problem reduction', 'Decompose a problem into subproblems whose solutions must be combined consistently; decomposition does not remove interactions automatically.', 59, 62],
      ['Preconditions', 'Assertions that must hold before an operator can be applied; this canonical planning term is a forward connection to Lesson13.', 175],
      ['Postconditions', 'Assertions that hold after application of an operator, including changed facts; this canonical planning term is a forward connection to Lesson13.', 175],
    ],
    sections: [
      ['A difference guides selection but is not a proof', 54, 56, 'A state space consists of represented configurations and transitions. Means-ends analysis compares the current configuration with the goal, identifies differences, and considers operators that reduce them. Counting mismatched predicates is one possible heuristic, not the true shortest-path distance. Two operators can remove the same number of differences and still have very different consequences. The source explicitly presents such a tie. Choosing the first tie by convention is a control decision, not a result justified by the difference measure. An operator that would fix a goal relation may also be inapplicable because an object is blocked. State representation and operator applicability must therefore be evaluated together.'],
      ['Temporary worsening can be necessary', 57, 59, 'The ebook’s block examples show that local difference reduction can fail, loop, or lead away from a useful solution. If every selected step must strictly lower a simplistic mismatch count, the method cannot perform a necessary preparatory action that temporarily breaks an already satisfied goal. Relaxing that condition permits detours, but then search control must prevent aimless cycling. Means-ends analysis is a broadly applicable heuristic method, not a universal guarantee of completeness, optimality, or efficiency. A counterexample should name both the current difference and the blocked operator; simply saying “greedy methods can fail” does not explain this particular mechanism.'],
      ['Reduce problems while preserving interactions', 59, 62, 'Problem reduction replaces a large goal with smaller goals and then composes their solutions. Some goals are alternatives; others all need to hold. In the latter case, independently solving each does not suffice if solving one undoes another. Use the planning vocabulary preconditions and postconditions precisely when checking composition: a later action may delete a fact needed by an earlier subsolution or require a fact not yet established. These terms are grounded in the Lesson13 operators section, not silently attributed to Lesson05’s wording. A useful decomposition exposes dependencies and shared resources; it does not promise that the subproblems are independent.'],
    ],
    assumptions: ['State the difference measure and explain whether lower values really indicate better prospects.', 'An action with a desirable postcondition is not legal unless its preconditions hold.', 'Avoid counting a temporarily broken goal as permanent failure; show why the preparatory move enables later progress.'],
    trace: {
      title: 'Original worked trace: clear a workspace before placing folders',
      problem: 'On a paper desk model, folder X is on Y, and Y is on the desk. Goal: Y on X and X on the desk. Only a clear folder can move, and only a clear folder can receive another.',
      steps: ['Initial goals: On(Y,X) is false and On(X,desk) is false, so mismatch count is 2. Move(Y,X) is attractive but illegal because Y is not clear.', 'Move X to the desk. On(X,desk) becomes true and Y becomes clear; mismatch count falls to 1.', 'Move Y onto X. Its preconditions Clear(Y) and Clear(X) hold; the final mismatch count is 0.', 'Now change the goal to preserve a labelled stack elsewhere whose top folder blocks the required support. Clearing that support may temporarily increase the count of unmet goals.', 'Record the difference measure, legal transitions, and the preparatory subgoal “make support clear”; do not mistake the easy first instance for a guarantee on the variant.'],
      conclusion: 'The worked instance illustrates legal difference reduction; its variant identifies why detours and subgoal interactions require more control than a mismatch count.',
    },
    transfer: {
      title: 'Transfer exercise: construct a plateau and a detour',
      problem: 'A paper puzzle has state (light on/off, latch open/closed). The latch opens only when the light is off. Goal: light on and latch open. Start: light on and latch closed. Trace why strict decrease fails.',
      steps: ['Count unmet goal predicates: initially 1.', 'Turn the light off: now 2 predicates are unmet, but the latch-opening operator becomes applicable.', 'Open the latch, then turn the light on; counts become 1 and then 0.', 'Explain the dependency and why rejecting the first move makes the represented goal unreachable under that controller.'],
      conclusion: 'A complete answer supplies the trace 1→2→1→0 and distinguishes legal reachability from what strict difference-reduction control can find.',
    },
    diagram: {
      title: 'The detour that a strict difference reducer rejects',
      nodes: [['On, closed: d=1', 'The light goal holds, but the latch-opening precondition fails.', 0], ['Off, closed: d=2', 'A preparatory action temporarily breaks the light goal.', 1], ['Off, open: d=1', 'Opening the latch is now legal.', 2], ['On, open: d=0', 'Restore the light goal to finish.', 3], ['Greedy rejection', 'A controller requiring strict decrease discards the necessary first move.', 1]],
      edges: [[0, 1, 'turn light off'], [1, 2, 'open latch'], [2, 3, 'turn light on'], [0, 4, 'reject increase in d']],
      steps: [['Compare', 'One goal is missing, but its direct operator is blocked.', [0]], ['Create a subgoal', 'Making the light off enables the latch action even though d increases.', [1]], ['Reduce the enabled difference', 'Open the latch once the light-off precondition holds in this state.', [2]], ['Restore and contrast', 'Restore the light and compare success with the rejected branch.', [3, 4]]],
      caption: 'Original counterexample diagram. The numeric difference is an invented goal-mismatch heuristic, not guaranteed remaining path cost.',
      alternative: 'A valid path goes from on/closed through off/closed and off/open to on/open, with mismatch counts 1,2,1,0. Strict greedy rejection blocks the first transition.',
    },
  },
  '06': {
    terms: [
      ['Production rule', 'Procedural knowledge expressed as a condition and a consequence or action, matched against current working memory.', 74, 77],
      ['Working memory', 'Rapidly changing current facts and goals used to activate productions; it is distinct from the more persistent rule store.', 74, 77],
      ['Procedural knowledge', 'Knowledge of how to act or infer, represented here by production rules.', 74],
      ['Semantic knowledge', 'Generalized knowledge such as concepts and models of the world, distinguished from specific event knowledge and knowledge of how to act.', 72],
      ['Declarative knowledge', 'Knowledge about entities, properties, or relations that can be available to the architecture, distinct from procedural rules.', 72, 74],
      ['Episodic knowledge', 'Knowledge of particular past events that can be consulted when current procedural knowledge cannot choose an action.', 78],
      ['Impasse', 'A state in which the architecture cannot select an action, for example because knowledge is missing or multiple proposed operators cannot be discriminated.', 77, 78],
      ['Chunking', 'Learning a production that captures knowledge useful for resolving an impasse, so a similar future choice can be made without repeating the full resolution.', 78, 79],
      ['Architecture plus content equals behavior', 'The source’s organizing claim that a fixed cognitive architecture can produce different behavior when its knowledge content changes.', 71],
    ],
    sections: [
      ['Architecture specifies control; rules supply content', 68, 74, 'The source separates task/knowledge, algorithm/symbol, and hardware levels, and proposes that architecture plus content determines behavior. A production architecture is not the particular rule bank placed inside it. The same cycle can run different knowledge content and yield different actions. Its cognitive assumptions include goal-directed agents, complex dynamic environments, symbolic abstraction, flexible behavior, use of knowledge, and learning from experience. They are modelling assumptions, not claims proved about every intelligent system. At the symbol level, a condition-action rule must match represented facts; at the task level, those facts must encode the information needed by the decision. Neither a fast matcher nor a large rule store compensates for omitted task knowledge.'],
      ['Match, select, and update are distinct operations', 74, 77, 'Working memory holds current percepts, goals, and intermediate consequences. Production conditions matching those facts become active; firing a production writes a consequence or proposes an operator. Those changes can activate other rules, creating a cycle between working and long-term memory. More than one rule may match. A controller needs an explicit way to select among proposals or determine that no choice can be made. “All true rules fire together” is not a sufficient account when their actions conflict. Rule matching can be correct while action selection remains unresolved. Record the match set, chosen production, and resulting facts separately when tracing the system.'],
      ['An impasse gives learning a concrete purpose', 77, 79, 'The SOAR example reaches an impasse because two operators are proposed and the current procedural knowledge cannot choose one. Episodic knowledge about a relevant past event supports a new production that rejects one proposal under specific conditions. That learned chunk changes long-term procedural content; merely changing a working-memory fact would not have the same persistence. The source connects what, when, why, and how to learn: a reasoning need defines the learning goal. One event does not justify an unrestricted rule for every future context. Preserve the conditions that actually supported the choice and consider a contrary event before accepting a broad generalization.'],
    ],
    assumptions: ['A matching rule may propose an operator without uniquely selecting it; distinguish activation, selection, and execution.', 'Conflict resolution and stopping conditions must be stated for a reproducible trace.', 'Chunking retains useful resolution knowledge; it does not prove that a remembered event is an exceptionless causal law.'],
    trace: {
      title: 'Original worked trace: resolve a paper catalogue-format impasse',
      problem: 'Working memory contains Goal(export), Recipient(archive), and Needs(searchable). Rule R1 proposes plain text for archive recipients; R2 proposes structured records for searchable output. Current control acts only when exactly one format remains.',
      steps: ['Match R1 and R2 against the three facts. Proposed formats are {plain, structured}; the selection rule cannot fire.', 'Record an impasse rather than choosing whichever rule was listed first. Architecture has no current preference resolving this context.', 'Retrieve an evaluated episode in which the archive needed searchable field names and accepted structured records; its relevance is the field-name requirement, not just the recipient label.', 'Learn a bounded chunk: if both formats are proposed and searchable field names are required, reject plain text. Add the field-name requirement to working memory only if observed.', 'Re-match with that requirement present. The new chunk removes plain; one format remains, so the controller selects structured records.'],
      conclusion: 'The learned production changes procedural content while the architecture stays fixed. Without the field-name fact, the bounded chunk should not resolve the impasse.',
    },
    transfer: {
      title: 'Transfer exercise: distinguish a temporary fact from a learned chunk',
      problem: 'A paper sorting assistant adds Chosen(blue-tray) to working memory to break a tie once. Compare this with learning a rule that chooses blue only when a verified material property holds.',
      steps: ['Trace the current decision with the temporary Chosen fact.', 'Clear working memory for a new item and show why the temporary choice is gone.', 'Re-match the learned conditional rule on an item with the verified property and one without it.', 'Construct an overgeneralized version “always choose blue” and identify a counterexample.'],
      conclusion: 'A good answer distinguishes persistence, trigger conditions, and evidence; repeating a successful action is not itself a complete chunking account.',
    },
    diagram: {
      title: 'Match–select cycle with an impasse-triggered chunk',
      nodes: [['Working memory', 'Goal, recipient, and requirement facts are current content.', 0], ['Match productions', 'R1 and R2 each propose a format.', 1], ['Selection impasse', 'Two candidates remain; control cannot choose.', 2], ['Episode and learning', 'A verified field-name episode supports a bounded rejection rule.', 3], ['New chunk', 'Reject plain only when the relevant field-name condition holds.', 2], ['Selected action', 'Structured remains as the sole candidate.', 3]],
      edges: [[0, 1, 'condition match'], [1, 2, 'multiple proposals'], [2, 3, 'reasoning need triggers learning'], [3, 4, 'retain procedural content'], [4, 1, 'next matching cycle'], [1, 5, 'unique candidate after chunk']],
      steps: [['Match', 'Identify active rules without pretending their consequences already settle selection.', [0, 1]], ['Detect impasse', 'No unique choice exists under current procedural content.', [2]], ['Learn for a reason', 'Use an episode to derive a condition-sensitive production.', [3, 4]], ['Re-enter control', 'The same architecture can now select when the chunk’s condition is present.', [1, 5]]],
      caption: 'Original production-system mechanism diagram, inspired by the source’s impasse/episodic-knowledge account rather than a reproduced SOAR figure.',
      alternative: 'Working memory feeds matching, which produces a two-format impasse. Episodic learning supplies a conditional chunk, returns it to matching, and permits a unique selected action.',
    },
  },
  '07': {
    terms: [
      ['Frame', 'A structured representation of a stereotypical object or event using named slots and fillers, often with defaults and inheritance.', 83, 87],
      ['Slot', 'A named attribute or relation in a frame; it specifies a role for a value rather than being that value.', 83, 86],
      ['Filler', 'The value occupying a slot, potentially a reference to another frame rather than an isolated scalar.', 84, 85],
      ['Default value', 'An expected filler used in the absence of more specific information; it can be overridden and must not be treated as an exceptionless fact.', 85, 87],
      ['Inheritance', 'Receiving slots and expected values from a more general frame while allowing more specific frames or instances to refine them.', 87],
      ['Stereotype', 'A structured expectation about a recurring object or situation; in this representation context, expectations can depend on culture or experience.', 86],
      ['Exception handling', 'Managing more specific information that overrides an expected frame value, including reconsidering conclusions dependent on that value.', 87],
    ],
    sections: [
      ['Slots organize role expectations', 83, 85, 'A frame expresses a recurring structure: an event can have an agent, object, time, location, or instrument. Incoming information fills some slots explicitly, while unstated slots may remain unknown or receive defaults. A slot is a role name; a filler is its value. The filler can point to another frame, letting event knowledge connect with knowledge of the participant or location. That pointer is important: the participant frame can supply preferences or other relevant context without duplicating all its contents in every event. A frame for an event and a frame for an object play different semantic roles even if both use the same data structure.'],
      ['Defaults support inference but invite revision', 85, 87, 'The three cardinal properties discussed in the source are stereotypes, default values, and inheritance. A default can make an interpretation useful before all information is stated, but its epistemic status must remain visible. “Not supplied” does not mean false, and “typical” does not mean necessary. An explicit contrary filler overrides a default; conclusions derived solely from that default may also need revision. Exception management becomes harder as instances accumulate. An object-oriented constructor analogy is helpful for initial values, but ordinary class initialization alone does not provide the full reasoning semantics of a defeasible default. State where a value came from before using it as evidence.'],
      ['Frame form is not the reasoning procedure', 88, 89, 'Frames can be related to semantic nets by interpreting slots as labelled relations, and productions can inspect frames to infer or choose actions. The stored form does not specify every control operation. A system still needs a procedure for selecting a candidate frame, matching input roles, finding inherited values, and resolving conflicting or missing information. A graph edge, slot lookup, and production firing can cooperate without becoming identical concepts. When an interpretation cannot fill important slots consistently, try a competing frame or ask for more context rather than forcing the input into the first stereotype. The original exercises here use simplified deterministic lookup rules, not a complete theory of language understanding.'],
    ],
    assumptions: ['Keep explicit, inherited, defaulted, and unknown fillers distinguishable.', 'A more specific override should defeat the relevant default, not erase unrelated inherited information.', 'If multiple inheritance produces competing fillers, require an explicit resolution policy or report ambiguity.'],
    trace: {
      title: 'Original worked trace: a borrowing-event frame',
      problem: 'Sentence: “Mina borrowed a telescope from the club for a night demonstration.” A paper frame expects borrower, item, lender, purpose, return time, and condition.',
      steps: ['Fill borrower=Mina, item=telescope, lender=club, purpose=night demonstration from explicit input. Do not infer the return time from the phrase “for a night demonstration”.', 'Let a general Borrowing frame default return-time=next day and condition=working. Mark both as defaults, not observations.', 'Point the item slot to a Telescope frame. Its class supplies optical-instrument information without replacing the borrowing-event roles.', 'A later sentence says the club permits a week-long loan. Override return-time with that explicit value; retain borrower, item, and lender.', 'A later condition report says the telescope is damaged. Retract any “ready for demonstration” conclusion based solely on the working-condition default.'],
      conclusion: 'Frames combine compact expectations with explicit exceptions. The example is original; the source licenses the mechanism, not these particular loan rules.',
    },
    transfer: {
      title: 'Transfer exercise: identify a misleading default',
      problem: 'An invented Delivery frame defaults transport=bicycle. A package report explicitly states transport=van, while arrival-time is absent. Explain what can and cannot be concluded.',
      steps: ['Override transport with van and keep its explicit provenance.', 'Leave arrival-time unknown unless a separately stated default or rule supplies it.', 'Identify a route-duration conclusion that depended on bicycle and must be reconsidered.', 'Explain why inheritance of a sender slot is independent of the transport override.'],
      conclusion: 'A strong answer does not infer “late” merely from missing arrival time and does not treat an overridden default as a second equally authoritative fact.',
    },
    diagram: {
      title: 'A frame value’s provenance determines its authority',
      nodes: [['General borrowing frame', 'Defaults: next-day return and working condition.', 0], ['Telescope frame', 'The item is an optical instrument; this is linked object knowledge.', 0], ['Mina’s event', 'Explicit borrower, item, lender, and purpose fill slots.', 1], ['Week-long permission', 'New explicit return information overrides the inherited default.', 2], ['Condition correction', 'Observed damage defeats the working-condition default.', 2], ['Revised interpretation', 'Preserve roles, replace return value, and withdraw unsupported readiness.', 3]],
      edges: [[0, 2, 'inherit expected fillers'], [1, 2, 'item-slot pointer'], [2, 3, 'resolve return-time'], [2, 4, 'check condition'], [3, 5, 'retain explicit value'], [4, 5, 'revise dependent inference']],
      steps: [['Instantiate', 'Fill observed roles and link the object frame.', [0, 1, 2]], ['Use a default cautiously', 'The next-day value is expected rather than asserted by the sentence.', [0, 2]], ['Override', 'Specific permission and damage information replace relevant defaults.', [3, 4]], ['Propagate revision', 'A dependent readiness inference is reconsidered without deleting unaffected roles.', [5]]],
      caption: 'Original frame diagram emphasizing authority of fillers. Inheritance arrows mean access to expected slots/values, not universal logical implication.',
      alternative: 'A general borrowing frame and telescope frame feed Mina’s event. Explicit week-long permission and damage information override two defaults, producing a revised interpretation with unchanged roles.',
    },
  },
  '08': {
    terms: [
      ['Case', 'An encapsulated past experience represented with information useful for comparing a new problem and reusing an earlier solution.', 94, 95],
      ['Learning by recording cases', 'Learning through retaining particular experiences and retrieving a similar one, without necessarily abstracting a general concept definition.', 94],
      ['Nearest neighbor', 'The stored case minimizing a declared distance to the query representation; proximity is a retrieval claim, not a guarantee of solution suitability.', 95, 98],
      ['Euclidean distance', 'The square root of the sum of squared coordinate differences in a chosen numerical feature space.', 96, 98],
      ['Similarity metric', 'The comparison rule that determines which differences matter in retrieval; feature choice and scaling shape the result.', 96, 98],
      ['k-dimensional space', 'A feature space with k coordinates. Here k counts representation dimensions; it should not silently be interpreted as a number of voting neighbors.', 98],
    ],
    sections: [
      ['Recording preserves experiences rather than an abstract definition', 94, 95, 'A case memory stores particular problems and their associated solutions. A new problem probes the memory; the agent retrieves a similar case and, in this elementary method, transfers the old answer directly. Learning can occur by adding an evaluated case without changing a general decision rule. This differs from incremental concept learning, which revises an abstract description of a class. Recording and retrieval still require design choices: what features are retained, how cases are compared, and whether the known outcome was reliable. An unlabelled log entry is not automatically a useful solved case. More stored experiences can help only if the representation and retrieval method make the relevant ones accessible.'],
      ['Distance is computed over a representation', 95, 98, 'The source uses widths and heights for block cases, then extends comparison to multiple dimensions for routes. Euclidean distance combines coordinate differences, so omitting destination from a route representation can retrieve the wrong experience even if origin matches well. The dimension count k belongs to the feature representation in this discussion; the worked retrieval chooses a closest case, not a majority vote over an unspecified set of k neighbors. Coordinates must have interpretable units. If one dimension is measured in large numerical units and another in small ones, the first can dominate an unscaled distance without being more relevant. Scaling and weighted-distance variants below are original extensions used to test this limitation.'],
      ['Closest is not necessarily close enough or reusable', 98, 100, 'The nearest stored case exists even when every case is a poor match. Retrieval should therefore distinguish a relative ranking from an acceptance decision. High-dimensional comparison can be computationally demanding and can make irrelevant features influential. The source also warns that a close case’s solution may not be directly applicable, motivating adaptation in Lesson09. A reusable route might depend on direction, road availability, or endpoints omitted from a coordinate vector. A nearest-neighbor trace should expose both the winning distance and the retained context. Ties deserve an explicit policy rather than a silent arbitrary answer, especially when tied cases carry different outcomes.'],
    ],
    assumptions: ['Numeric distance is meaningful only for stated features, units, and scaling.', 'The known case solution must be applicable before direct reuse; similarity alone is insufficient.', 'Distinguish the best stored match from an adequately supported match, and retain ambiguity for equal distances.'],
    trace: {
      title: 'Original worked trace: retrieve a paper display-layout case',
      problem: 'A query display has dimensions (width=6,height=4). Case A=(4,4) uses layout alpha, B=(7,7) uses beta, C=(6,2) uses gamma. Compare squared Euclidean distances.',
      steps: ['Represent all widths and heights in the same invented grid units. Compute A: (6−4)²+(4−4)²=4.', 'Compute B: (6−7)²+(4−7)²=10; C: (6−6)²+(4−2)²=4.', 'A and C tie for nearest at distance 2; do not claim that alpha is uniquely justified.', 'Now declare an original weighted comparison that gives height four times the squared contribution: A=4, B=37, C=16. A becomes uniquely nearest under this different metric.', 'Check whether alpha’s solution requires an unavailable font. Even a uniquely nearest geometric case can fail direct reuse for an omitted contextual reason.'],
      conclusion: 'The retrieval outcome changes with the metric, and a tie is preserved in the unweighted calculation. These dimensions and layouts are original examples.',
    },
    transfer: {
      title: 'Transfer exercise: a units change should not secretly change meaning',
      problem: 'A nearest-case matcher uses width in centimetres and height in metres. Changing height to centimetres reverses the winner. Explain why and propose a paper repair.',
      steps: ['Show how the squared height difference is multiplied by 10,000 when converted from metres to centimetres.', 'Convert both dimensions to comparable units or normalize against explicitly chosen reference scales.', 'Recompute the ranking and state what task relevance the scaling is intended to express.', 'Add a far-away query to distinguish relative nearest from a justified acceptance threshold.'],
      conclusion: 'A strong response makes the representation bias explicit; normalization is a modelling choice, not a magical proof that the retrieved solution is appropriate.',
    },
    diagram: {
      title: 'Retrieval ranking changes when feature importance changes',
      nodes: [['Query (6,4)', 'Width and height use the same grid unit.', 0], ['Case A (4,4)', 'Unweighted squared distance 4; height-weighted distance 4.', 1], ['Case B (7,7)', 'Unweighted squared distance is 10; height-weighted squared distance is 37.', 1], ['Case C (6,2)', 'Unweighted squared distance is 4; height-weighted squared distance is 16.', 1], ['Unweighted tie', 'A and C are equally near; alpha versus gamma remains unresolved.', 2], ['Weighted winner A', 'Height-weighting chooses A, but font context still needs checking.', 2]],
      edges: [[0, 1, 'compare features'], [0, 2, 'compare features'], [0, 3, 'compare features'], [1, 4, 'distance 4'], [3, 4, 'distance 4'], [1, 5, 'minimum weighted value']],
      steps: [['Represent', 'Use a shared coordinate system before calculating proximity.', [0, 1, 2, 3]], ['Calculate', 'Squared distances 4,10,4 yield a tie without square-root approximation.', [1, 2, 3, 4]], ['Declare a different metric', 'Giving height four times the contribution changes values to 4,37,16.', [5]], ['Qualify reuse', 'A winning geometric score does not check an omitted font requirement.', [5]]],
      caption: 'Original nearest-neighbor diagram with a deliberately meaningful tie and an explicitly labelled weighted extension, not a reproduced textbook plot.',
      alternative: 'The query compares with three cases. Unweighted distances tie A and C, whereas a height-weighted comparison chooses A; omitted applicability conditions remain unchecked.',
    },
  },
  '09': {
    terms: [
      ['Case-based reasoning', 'Retrieve a relevant prior case, adapt its solution to the new problem, evaluate the proposal, and store useful evaluated experience.', 102, 109],
      ['Case retrieval', 'Use the current problem as a probe to find relevant prior experience; relevance depends on how cases were represented and indexed.', 113, 114],
      ['Case adaptation', 'Change a retrieved solution to address differences between its original problem and the current problem.', 104, 107],
      ['Model-based adaptation', 'Use knowledge of how the world or artifact works to modify a retrieved solution.', 105],
      ['Recursive case-based adaptation', 'Treat an unsolved part as a new case-retrieval problem and compose compatible partial solutions.', 106, 107],
      ['Rule-based adaptation', 'Use a heuristic rule to modify a past solution; the rule needs its own applicability conditions and evaluation.', 107, 108],
      ['Case evaluation', 'Assess a proposed adapted solution against the new requirements, using suitable simulation, execution, or critique.', 108, 109],
      ['Case storage', 'Retain an evaluated problem–solution experience with useful context so it can support future retrieval.', 109, 111],
      ['Discrimination tree', 'A case-memory structure whose internal nodes ask discriminating feature questions and whose leaves contain cases.', 111],
    ],
    sections: [
      ['A cycle joins memory, reasoning, and learning', 102, 109, 'Case-based reasoning extends direct case reuse with adaptation and evaluation. Recurring problem patterns and the tendency of similar problems to have similar solutions motivate the method, but “often” is not “always”. Retrieval draws on memory; adaptation and evaluation reason about the current task; storing an evaluated case changes memory for future tasks. Failure during evaluation can return control to adaptation or retrieval. The case should include the new requirements and outcome, not simply the old solution with a new title. A growing case library is useful only when relevant contextual distinctions remain retrievable. This cycle makes the Lesson01 connection among learning, memory, and reasoning concrete.'],
      ['Three adaptation mechanisms use different knowledge', 104, 108, 'Model-based adaptation consults a model of the world, such as connectivity or artifact behavior, to bridge the old and new requirements. Recursive adaptation asks the case library to solve the remaining subproblem and composes the partial answers. Rule-based adaptation applies a heuristic, such as reversing a route, that can fail when assumptions like bidirectional travel do not hold. Naming the mechanism tells us what to inspect: model validity, subsolution compatibility, or rule applicability. A proposed change is not automatically an evaluated solution. Even when components work individually, their composition may violate an endpoint, resource, or ordering requirement.'],
      ['Storage and indexing should serve retrieval', 109, 114, 'An index is a retrieval-relevant tag or feature organization. Indexing routes only by origin can confuse cases with very different destinations. A discrimination tree asks questions at internal nodes and stores cases at leaves; adding a case may require a new question to distinguish it from an existing case. This is incremental memory organization, not necessarily learning an axiomatic class definition. Querying one leaf can be efficient but should not be misdescribed as automatically finding a globally nearest numerical case. Question ordering, missing query features, and the intended retrieval objective affect what the tree returns. Record evaluation context so a failed old adaptation does not become falsely authoritative future experience.'],
    ],
    assumptions: ['Similar problems often have related solutions, but a changed hard constraint can defeat the closest case.', 'Choose evaluation appropriate to the cost of action; a paper simulation is not equivalent to real-world validation.', 'Recursive subsolutions must connect consistently and terminate; combining remembered fragments does not automatically solve the whole task.'],
    trace: {
      title: 'Original worked trace: adapt an archive-retrieval route',
      problem: 'A paper archive map has directed links Entrance→Hall, Hall→ShelfA, Hall→ShelfB, ShelfB→Exit. A stored route retrieves an item at ShelfA. The new request needs an item at ShelfB and then exit.',
      steps: ['Retrieve the Entrance→Hall→ShelfA case using the shared origin and retrieval purpose. Its destination mismatch is explicit.', 'Model-based adaptation uses the map to replace Hall→ShelfA with Hall→ShelfB.', 'The exit requirement remains unsolved. Recursive retrieval finds a compatible ShelfB→Exit case and appends it.', 'Evaluate the full route: Entrance→Hall→ShelfB→Exit follows every directed link and satisfies both item and exit requirements.', 'Store the new requirements, route, map version, and successful paper simulation. For a reverse request, a rule that reverses every link would fail because the map is directed.'],
      conclusion: 'Different adaptation mechanisms can cooperate; evaluation checks the composed route. The archive map is invented and is not an assessed navigation or ARC solution.',
    },
    transfer: {
      title: 'Transfer exercise: repair an unsuitable index',
      problem: 'A case library indexes exhibition visits only by entrance door. Visits differ in destination, step-free access, and opening hours. Explain a false retrieval and design a small discrimination tree.',
      steps: ['Construct two cases with the same entrance but incompatible access requirements.', 'Choose an internal question that distinguishes step-free requirements, then one about destination.', 'Represent missing opening-hour information as unresolved rather than forcing a branch.', 'State why the tree narrows relevant cases but does not prove minimum geometric distance.'],
      conclusion: 'The index must discriminate features affecting reuse. A fast wrong retrieval is not an improvement over a slower well-grounded one.',
    },
    diagram: {
      title: 'Case reuse includes an evaluation gate and a retry loop',
      nodes: [['New requirements', 'ShelfB item and exit; origin is Entrance.', 0], ['Retrieve ShelfA case', 'Shared origin suggests a candidate with a visible destination mismatch.', 1], ['Adapt with model', 'Use Hall→ShelfB instead of Hall→ShelfA.', 2], ['Recursive remainder', 'Retrieve and append the compatible ShelfB→Exit fragment.', 2], ['Evaluate whole route', 'Check directed links, destination, exit, and map version.', 3], ['Store evaluated case', 'Retain new requirements, route, and outcome for later retrieval.', 4]],
      edges: [[0, 1, 'probe memory'], [1, 2, 'repair destination'], [2, 3, 'solve remaining requirement'], [3, 4, 'compose and check'], [4, 5, 'success'], [4, 1, 'failure: retrieve again'], [4, 2, 'failure: revise adaptation']],
      steps: [['Retrieve', 'Similarity identifies a starting case, not a completed answer.', [0, 1]], ['Adapt', 'Model knowledge handles one mismatch and recursive retrieval handles the remainder.', [2, 3]], ['Evaluate', 'The composed candidate must satisfy the entire new problem.', [4]], ['Learn or retry', 'Store evaluated success; on failure reconsider adaptation or retrieval.', [1, 2, 5]]],
      caption: 'Original CBR mechanism diagram. Failure edges are essential: the cycle does not label an untested adaptation as successful learning.',
      alternative: 'New requirements retrieve a ShelfA case, adapt it toward ShelfB, add a remembered exit fragment, and evaluate the combined route. Success leads to storage; failure returns to retrieval or adaptation.',
    },
  },
  '10': {
    terms: [
      ['Incremental concept learning', 'Revise a concept description one labelled example at a time; generalize for an uncovered positive and specialize for a covered negative.', 122, 123],
      ['Variabilization', 'Replace particular object identities with variables or roles while retaining relevant types and relations.', 123],
      ['Near miss', 'A negative example closely resembling a positive or current description, useful because a focused difference can reveal a required or forbidden relation.', 124, 126],
      ['Drop-link', 'Generalize by removing a relation from the concept description when a positive example shows that the relation is not required.', 124],
      ['Require-link', 'Specialize by making a relation mandatory when a negative example missing it would otherwise be covered.', 125],
      ['Forbid-link', 'Specialize by prohibiting a relation present in a covered negative example.', 126],
      ['Enlarge-set', 'Generalize a discrete allowed-value set by adding a new accepted alternative.', 127],
      ['Climb-tree', 'Generalize using background taxonomy knowledge to replace particular alternatives with an appropriate shared superclass.', 127, 128],
      ['Close-interval', 'Revise a numerical range to include a positive value outside the previous range; the source illustrates enlarging the accepted size interval.', 130],
      ['Background knowledge', 'Prior relational or taxonomic knowledge that constrains what to generalize and permits abstraction beyond observed alternatives.', 127, 130],
    ],
    sections: [
      ['The label and coverage jointly determine the update', 122, 123, 'Incremental learning receives labelled examples in sequence and maintains a concept description. A covered positive needs no change; an uncovered positive calls for generalization. An excluded negative needs no change; a covered negative calls for specialization. The first positive can be variabilized so identities become roles, but this alone does not reveal which observed properties are essential. Many descriptions fit a small example set. Examples, near misses, heuristic choices, and background knowledge constrain the path through the hypothesis space. This is not simply storing every case: the learned object is an abstract description. Label noise or a representation unable to express the distinction can make consistent refinement impossible.'],
      ['Link heuristics have distinct directions', 123, 126, 'Variabilization preserves relations while removing accidental identities. Drop-link removes a restriction to cover a positive that lacks it. Require-link makes a relation necessary to exclude a negative missing that relation; forbid-link instead rules out a relation present in a negative. Require and forbid are not interchangeable. The course’s representation allows distinctions between a merely represented relation and one marked as mandatory; in a strict logical conjunction every conjunct is already required, so requiring the same link again would do nothing. A faithful paper trace must state its match semantics. Near misses are useful because they make a focused change plausible, not because they mathematically prove a uniquely correct concept.'],
      ['Generalize values with different commitments', 127, 130, 'Enlarge-set enumerates observed discrete alternatives, such as allowing {rectangle, trapezoid}. Climb-tree uses a taxonomy to replace them with a superclass, potentially accepting types not yet observed. That is a stronger commitment whose justification depends on background knowledge and role suitability. Close-interval changes a continuous numerical bound: positive lengths 4 and 7 may lead to a closed interval [4,7], but sparse observations do not prove that every interior value is positive or every exterior value negative. These are heuristics, not universal guarantees. After every revision, recheck earlier labelled examples and identify any newly admitted negative. Preserve the exact course names even when translating the mechanism to an engineering analogy.'],
    ],
    assumptions: ['Labels are supplied and sufficiently reliable; a teacher’s near misses isolate differences rather than confounding many changes.', 'State whether unmarked links are optional during matching; otherwise require-link can become a meaningless no-op.', 'Climbing a taxonomy can overgeneralize to an unsuitable sibling. Recheck old examples and construct an unseen counterexample.'],
    trace: {
      title: 'Original worked trace: learn a paper display-support concept',
      problem: 'A labelled “display stand” has two separated supports carrying a top panel. The first positive also has a decorative marker above the panel. Relations are initially descriptive; support links can be marked mandatory.',
      steps: ['Variabilization replaces named pieces P1/P2/P3/P4 with support-left, support-right, panel, marker while retaining type and relational roles.', 'A second positive lacks the marker. Drop-link removes the decorative-marker relation rather than requiring every stand to have it.', 'A near-miss negative has a panel resting elsewhere. Require-link marks both supports-panel relations mandatory so the missing-support negative is excluded.', 'A covered negative has its supports touching. Forbid-link adds the prohibition touches(left,right).', 'A new positive has a trapezoid panel instead of a rectangle. Enlarge-set admits {rectangle,trapezoid}; a justified panel-shape taxonomy may permit climb-tree to polygon, which also admits unseen pentagons.', 'Positive support heights 4 and 7 motivate close-interval [4,7]. Recheck all prior labels, then test a curved fragile panel that a too-high taxonomy ancestor would wrongly admit.'],
      conclusion: 'Every named heuristic makes a different representational change. This original trace declares optional/mandatory link semantics instead of pretending require-link adds information to an already mandatory conjunct.',
    },
    transfer: {
      title: 'Transfer exercise: choose the update, not just its name',
      problem: 'An invented “reading nook” concept accepts a seat with lamp nearby. A positive has no rug; a negative has a lamp in another room; another negative has a blocked doorway. Specify three updates and their evidence.',
      steps: ['If rug is an unnecessary observed relation, drop-link it to cover the rug-free positive.', 'Require the same-room relation to exclude the first negative if that relation was not already mandatory.', 'Forbid a blocked-doorway relation to exclude the second negative.', 'Give a positive with a new lamp type and contrast enlarge-set with climb-tree; explain what extra instances each admits.'],
      conclusion: 'The answer must connect positive/negative coverage to a concrete before-and-after description, and check that accepted earlier examples remain accepted.',
    },
    diagram: {
      title: 'Update direction depends on both label and current coverage',
      nodes: [['Labelled example', 'Receive one positive or negative instance in a stated representation.', 0], ['Positive covered?', 'A positive that is not covered indicates excessive restriction.', 1], ['Negative covered?', 'A covered negative indicates a missing restriction.', 1], ['Generalize', 'Drop-link, enlarge-set, climb-tree, or close-interval can enlarge coverage.', 2], ['Specialize', 'Require-link or forbid-link can reduce coverage.', 2], ['Keep description', 'Covered positive or excluded negative needs no update.', 2], ['Recheck history', 'Confirm the revised description still handles previous labels.', 3]],
      edges: [[0, 1, 'positive label'], [0, 2, 'negative label'], [1, 3, 'no'], [1, 5, 'yes'], [2, 4, 'yes'], [2, 5, 'no'], [3, 6, 'test prior examples'], [4, 6, 'test prior examples'], [5, 6, 'retain evidence']],
      steps: [['Receive and match', 'The label alone does not determine a change; coverage must also be checked.', [0, 1, 2]], ['Choose direction', 'Uncovered positives lead to generalization; covered negatives lead to specialization.', [3, 4]], ['Choose a mechanism', 'Pick the relation, allowed set, taxonomy, or interval change justified by the difference.', [3, 4]], ['Preserve consistency', 'Recheck history and make newly admitted cases explicit.', [5, 6]]],
      caption: 'Original decision diagram for incremental concept learning. Variabilization initializes role-based description; the later branches refine coverage rather than memorize raw cases.',
      alternative: 'A positive goes to a coverage test and either generalizes or stays unchanged. A negative goes to a coverage test and either specializes or stays unchanged. Every branch ends by checking prior evidence.',
    },
  },
  '11': {
    terms: [
      ['Classification', 'Assign an instance to a concept or category under a stated membership representation and procedure.', 137, 143],
      ['Equivalence class', 'A grouping that treats items as equivalent with respect to a selected classification criterion, not identical in every property.', 139, 141],
      ['Concept hierarchy', 'An organization of more general and more specific concepts, whose links must preserve the intended category relation.', 141, 143],
      ['Establish-and-refine', 'Establish a plausible broader category, then test more specific candidates using discriminating knowledge.', 141, 142],
      ['Axiomatic concept', 'A concept characterized by necessary and sufficient membership conditions in its stated domain.', 143],
      ['Prototype concept', 'A concept represented through typical properties that can be overridden for particular members.', 144],
      ['Exemplar concept', 'A concept represented through examples where an agreed set of necessary or even typical conditions may be difficult to state.', 145],
      ['Bottom-up search', 'Reason from an instance’s observed features toward compatible concepts rather than starting only with a broad candidate and refining downward.', 146, 147],
    ],
    sections: [
      ['Classification uses a concept; learning changes it', 136, 143, 'Classification asks which class an instance belongs to using available conceptual knowledge. Concept learning asks how that knowledge is acquired or revised. The tasks interact, but a membership decision is not automatically a learning update. Equivalence classes group cases with respect to the distinctions relevant to the task: equal membership does not imply identical feature values. A hierarchy can organize broad and narrow concepts, enabling establish-and-refine search. If a superclass is defined by necessary conditions, each valid subclass must respect them. Choosing features merely because several visible examples share them can create an accidental rather than valid superclass definition.'],
      ['Axioms, prototypes, and exemplars support different claims', 143, 145, 'Axiomatic concepts have specified necessary and sufficient conditions, such as an ideal geometric definition in a declared domain. Prototype concepts use typical features with exceptions; a typical chair’s leg count is not a theorem about every chair. Exemplar concepts are communicated through remembered examples where even a shared typical description may be hard to agree on. The source uses a formality spectrum, not a claim that every category belongs forever in one rigid bucket. Frames naturally express prototype defaults, while case-based comparison can help with exemplar knowledge. The inference procedure and confidence claim should fit the representation: a strong similarity match is not the same justification as satisfying a biconditional definition.'],
      ['Search direction and uncertainty deserve explicit control', 141, 147, 'Establish-and-refine can start with a broad candidate and ask questions to distinguish subclasses. Bottom-up search instead begins with instance features and identifies compatible concepts. These strategies can meet in the middle, but neither removes missing information or conflicting evidence. Failing to establish a narrow class does not always exclude the broad class. Prototype exceptions require care because a missing typical feature may not be disqualifying. A hierarchy with overlapping categories may return multiple memberships rather than a single leaf. Decide whether the task permits overlap, demands a mutually exclusive answer, or allows “insufficient evidence”; do not obtain certainty by silently filling unknown properties with negative values.'],
    ],
    assumptions: ['Specify the membership semantics: necessary conditions, typical defaults, or exemplar similarity.', 'Unknown evidence is not equivalent to a negative property; ask a discriminating question when classification depends on it.', 'A class hierarchy needs a justified general-to-specific relation, not just a visually tidy grouping.'],
    trace: {
      title: 'Original worked trace: classify an invented reading-room seat',
      problem: 'Observation: object O supports one seated person, has a seat and back, and has one central pedestal rather than four legs. Compare an axiomatic task definition and a prototype.',
      steps: ['For this invented task, define Seat(O) iff O supports seated use for one person. The observed use satisfies that stipulated condition.', 'Establish the broad Seat category, then test narrower types using back, support, and intended-use features.', 'A prototype reading chair defaults to four legs and a back. O differs in leg structure but matches seated use and back; one atypical feature does not automatically exclude it.', 'An exemplar catalogue might retrieve a similar pedestal chair. That supplies analogy-based evidence rather than the same justification as the stipulative Seat definition.', 'If intended use is unknown, keep the broad or narrow classification provisional instead of substituting a guessed default into an axiomatic proof.'],
      conclusion: 'The instance can satisfy the broad task definition and be an atypical prototype match at once. These seat categories are original teaching choices, not universal furniture definitions.',
    },
    transfer: {
      title: 'Transfer exercise: classify without overclaiming',
      problem: 'A paper catalogue groups “quiet study spaces”. One group uses an exact decibel threshold, one uses a typical library-room description, and one uses remembered examples chosen by students. Compare their membership evidence.',
      steps: ['State the measurement domain and threshold for the axiomatic group.', 'Give a prototype exception that remains a usable study space.', 'Explain how an exemplar judgement can differ between people without violating a formal threshold.', 'Design a query with missing measurement data and distinguish unknown from above-threshold.'],
      conclusion: 'A strong answer selects a compatible method for each concept type and explains why similarity, defaults, and necessary/sufficient conditions are not interchangeable.',
    },
    diagram: {
      title: 'One object, three different membership justifications',
      nodes: [['Seat observation O', 'Seated use, seat, back, central pedestal are observed.', 0], ['Axiomatic definition', 'Check the stipulated necessary and sufficient seated-use condition.', 1], ['Prototype comparison', 'Compare typical chair properties, allowing a pedestal exception.', 1], ['Exemplar retrieval', 'Retrieve a similar remembered pedestal chair.', 1], ['Broad Seat established', 'The task-defined condition is satisfied.', 2], ['Narrow category provisional', 'Typicality or examples inform refinement; unknown use may remain unresolved.', 2]],
      edges: [[0, 1, 'test conditions'], [0, 2, 'compare defaults'], [0, 3, 'compare examples'], [1, 4, 'membership by definition'], [2, 5, 'defeasible typicality'], [3, 5, 'experience-based judgement']],
      steps: [['Observe', 'Write the features and their provenance before choosing a category.', [0]], ['Choose semantics', 'The three branches use formal conditions, typical defaults, or remembered examples respectively.', [1, 2, 3]], ['Establish', 'The broad task-defined class can be established directly.', [4]], ['Refine cautiously', 'A narrow judgement based on typicality or examples is not the same proof as the axiom branch.', [5]]],
      caption: 'Original classification diagram. Parallel branches compare justifications, not three compulsory stages that every classifier must execute.',
      alternative: 'One seat observation feeds formal-condition checking, prototype comparison, and exemplar retrieval. The formal branch establishes a broad task category; the other branches inform a potentially provisional narrower category.',
    },
  },
  '12': {
    terms: [
      ['Knowledge base', 'The explicitly stated sentences an agent uses as premises; logical inference preserves their consequences but does not establish their real-world truth.', 149, 151],
      ['Inference engine', 'The procedure applying licensed inference rules to a knowledge base; representation and proof search must be distinguished.', 149, 151],
      ['Predicate', 'An expression assigning truth to a property or relation of its arguments under an interpretation.', 151],
      ['Entailment', 'A sentence is entailed when it is true in every interpretation satisfying the knowledge base.', 149, 159],
      ['Soundness', 'The property that derived conclusions are entailed by the premises in the stated logical setting, not a guarantee that the premises describe reality accurately.', 149, 159],
      ['Completeness', 'The property that every entailed conclusion is derivable by the proof system in the stated setting; it does not make search cheap.', 149, 161],
      ['Modus ponens', 'From P and P implies Q, infer Q.', 159],
      ['Modus tollens', 'From not Q and P implies Q, infer not P.', 159],
      ['Conjunctive normal form', 'A conjunction of clauses, with each clause a disjunction of literals; a literal is an atom or its negation.', 163],
      ['Resolution theorem proving', 'Prove a query by adding its negation to clause-form premises and resolving complementary literals to derive a contradiction.', 162, 165],
      ['Universal quantifier', 'A quantifier stating that a condition applies for every value of a variable in the declared domain.', 161],
      ['Existential quantifier', 'A quantifier stating that at least one value in the declared domain satisfies the quantified condition.', 161],
    ],
    sections: [
      ['Syntax, interpretation, and entailment are separate', 149, 153, 'Logic provides a language for a knowledge base and rules for inference. Propositional atoms describe particular claims; predicates expose object arguments and relations. An interpretation gives expressions truth values. Entailment asks whether a conclusion holds in every interpretation satisfying the premises, not whether the conclusion sounds plausible. A rule “verified implies publishable” is a premise, not a causal discovery made by the inference engine. Sound inference can transmit a false or inappropriate premise into a wrong real-world decision. Keep the origin of each premise visible: supplied domain knowledge, observation, or a previously derived sentence. The source’s illustrative animal rules are simplified teaching premises rather than a complete biological ontology.'],
      ['Implication and equivalence prevent common reversals', 152, 159, 'P implies Q is equivalent to not P or Q. It is false only when P is true and Q false; a false antecedent does not make Q true or false by itself. Modus ponens derives Q from P and P implies Q. Modus tollens derives not P from not Q and the implication. Affirming Q does not justify P, and denying P does not justify not Q. Necessary and sufficient language must respect direction: P is sufficient for Q, while Q is necessary for P under this implication. A biconditional would additionally assert the reverse direction. Use a countermodel to diagnose an invalid inference rather than simply naming the fallacy.'],
      ['Quantifiers change the claim being represented', 161, 161, 'A universal statement about all x is different from a list of observed examples and different from an existential statement about some x. State the domain explicitly. From every registered item being catalogued and one registered item, universal instantiation followed by modus ponens can derive that item’s catalogue status. It does not prove that every catalogued item is registered. Existential statements assert a witness exists but need not identify it. Mixed quantifier order can change meaning: “each reader has some assigned desk” permits different desks, while “some desk is assigned to every reader” requires one shared witness. The latter contrast is an original extension used to test the source’s universal/existential distinction.'],
      ['Resolution proves by refuting the negated query', 162, 165, 'Convert premises to conjunctive normal form, eliminating implications and pushing negations inward with equivalences such as de Morgan’s laws. Add the negation of the desired query. Resolve clauses containing complementary literals, retaining the other literals in the resolvent. An empty clause is a contradiction and supports the query if the original premises are consistent. Propositional resolution is refutation-complete when search is fair, but this does not promise a cheap proof or termination for arbitrary first-order search. The source demonstrates propositional proofs; full first-order unification and quantifier normalization are not developed here. Failure to find a contradiction in a bounded attempt is not a proof of the query’s negation.'],
    ],
    assumptions: ['State the logic and premise consistency assumptions; an inconsistent classical knowledge base can entail arbitrary conclusions.', 'No closed-world assumption is supplied by classical logic: an unproved claim is not automatically false.', 'A truth-preserving inference rule differs from an efficient strategy for selecting which clauses to resolve next.'],
    trace: {
      title: 'Original worked trace: prove a catalogue-release claim by resolution',
      problem: 'Premises: Checked implies Tagged; Tagged implies Ready; Checked. Query: Ready. Use propositional atoms C, T, R for this invented workflow.',
      steps: ['Eliminate implications: clauses are ¬C∨T, ¬T∨R, and C. These are premises in CNF, not an assertion that unchecked items cannot be ready.', 'Negate the query and add ¬R. Keep this temporary assumption separate from the original knowledge base.', 'Resolve C with ¬C∨T to derive T.', 'Resolve T with ¬T∨R to derive R.', 'Resolve R with ¬R to derive the empty clause. The negated query is inconsistent with these premises, so Ready is entailed.', 'Countermodel to the converse: C=false, T=true, R=true satisfies both implications and Ready, but not Checked. Without the original Checked premise, Ready would not entail Checked.'],
      conclusion: 'The proof’s conclusion depends on its premises; it does not guarantee that a real item is safe to release. The clauses and countermodel are original.',
    },
    transfer: {
      title: 'Transfer exercise: construct a countermodel before claiming a proof',
      problem: 'A paper rule says Reserved(x) implies HasDesk(x). You observe HasDesk(Ari). Can you infer Reserved(Ari)? Then compare “every reader has some desk” with “one desk serves every reader”.',
      steps: ['Give Reserved(Ari)=false and HasDesk(Ari)=true; the implication and observation hold while the proposed conclusion fails.', 'Explain why modus ponens needs the antecedent, not the consequent.', 'For two readers assigned different desks, show the first quantified claim can hold while the shared-desk claim fails.', 'If asked to prove a different query by resolution, write its negation explicitly and identify what counts as a contradiction.'],
      conclusion: 'A complete response demonstrates invalidity with a satisfying countermodel and distinguishes quantifier scope from informal similarity of wording.',
    },
    diagram: {
      title: 'Resolution refutation has explicit premise dependencies',
      nodes: [['C', 'Premise: the item is Checked.', 0], ['¬C ∨ T', 'Clause from Checked implies Tagged.', 0], ['T', 'Resolvent of C and ¬C∨T.', 1], ['¬T ∨ R', 'Clause from Tagged implies Ready.', 1], ['R', 'Resolvent of T and ¬T∨R.', 2], ['¬R', 'Temporary assumption: negation of the query.', 2], ['Empty clause', 'R and ¬R cannot both hold in one model.', 3]],
      edges: [[0, 2, 'resolve on C'], [1, 2, 'resolve on C'], [2, 4, 'resolve on T'], [3, 4, 'resolve on T'], [4, 6, 'resolve on R'], [5, 6, 'resolve on R']],
      steps: [['Normalize', 'State premises as clauses and distinguish the negated query from given facts.', [0, 1, 3, 5]], ['First resolvent', 'Complementary C and ¬C literals disappear from the parent clauses, leaving T.', [0, 1, 2]], ['Second resolvent', 'Complementary T and ¬T literals disappear from the parent clauses, leaving R.', [2, 3, 4]], ['Refute', 'R and the assumed ¬R resolve to the empty clause.', [4, 5, 6]]],
      caption: 'Original dependency diagram for a propositional proof. The two incoming edges at each resolvent show that both parent clauses are required.',
      alternative: 'C and not-C-or-T derive T; T and not-T-or-R derive R; R and the negated query not-R derive contradiction, establishing R relative to the premises.',
    },
  },
};

const forwardTerms: Term[] = [
  ['Move-object', 'A primitive action describing a change in physical location of an object, including an agent moving itself.', 202, 205],
  ['Move-possession', 'A primitive action describing a transfer of possession, which need not be identical to physical movement.', 202, 205],
  ['Ingest', 'A primitive action for taking an object into an agent’s body, used to connect differently worded eating descriptions to a shared meaning.', 202, 205],
  ['Specific model', 'The specific side of the source’s version-space account; positive examples call for generalization of the specific model.', 253],
  ['General model', 'The general side of the source’s version-space account; negative examples call for specialization of the general model.', 253],
  ['Knowledge gap', 'A recognized absence of knowledge needed to connect or complete reasoning; detecting it can give rise to a learning goal.', 317],
  ['Learning goal', 'A goal to acquire knowledge needed to repair a detected gap, for example connecting two parts of an incomplete explanation.', 317],
];

const sourceSections: Record<string, string[]> = {
  '01': ['§03 Conundrums in AI; §04 Characteristics of AI Problems', '§10 What is Knowledge-Based AI; §17 Cognitive System Architecture', '§11 Foundations The Four Schools of AI; §§14–16 The Four Schools / Cognitive Systems'],
  '02': ['§02 Class Goals; §03 Class Outcomes', '§06 Introduction to Computational Psychometrics; §§21–27 Matrix examples / What is intelligence', '§04 Class Assignments (historical only)'],
  '03': ['§03 Introduction to Semantic Networks; §08 Structure of Semantic Networks; §09 Characteristics of Good Representations', '§09 Characteristics of Good Representations; §§12–14 Guards and Prisoners', '§21 Represent Reason for Analogy Problems; §26 Choosing Matches by Weights'],
  '04': ['§02 Guards and Prisoners; §§07–09 Dumb Generators, Dumb Testers / Smart Testers / Smart Generators', '§§07–11 Dumb Generators, Dumb Testers / Smart Testers / Smart Generators', '§§08–09 Smart Testers / Smart Generators; §13 Semantic Networks for Generate and Test'],
  '05': ['§04 State Spaces; §05 Differences in State Spaces; §06 Process of Means End Analysis', '§§07–16 Block Problem exercises and limitations', '§18 Problem Reduction; §19 Problem Reduction in the Block Problem'],
  '06': ['§04 Function of a Cognitive Architecture; §05 Levels of Cognitive Architectures; §08 Assumptions; §§09–14 Architecture / Action Selection / Bringing in Memory', '§14 Bringing in Memory; §§15–20 Production System in Action', '§21 Chunking; §24 Fundamentals of Learning'],
  '07': ['§04 How do we make sense of a sentence; §07 Complex Frame Systems', '§08 Properties of Frames', '§11 Frames and Semantic Nets; §14 Frames and Production Systems'],
  '08': ['§04 Learning by Recording Cases', '§05 Case Retrieval by Nearest Neighbor; §11 Nearest Neighbor in k-Dimensional Space', '§11 Nearest Neighbor in k-Dimensional Space; §13 Wrap Up'],
  '09': ['§04 Recording Cases to Case-Based Reasoning; §05 Assumptions of Case-Based Reasoning; §§10–11 Case Evaluation / Storage', '§§06–09 Case Adaptation / Model of the World / Recursive Reasoning / Rules', '§12 Case Storage by Index; §17 Case Storage by Discrimination Tree; §22 Case Retrieval Revisited'],
  '10': ['§08 Incremental Concept Learning; §09 Variabilization', '§§09–12 Variabilization / Generalization to Ignore Features / Specialization to Require Features / Specialization to Exclude Features', '§§13–16 Generalization to Abstract Features / Generalization with Background Knowledge / Heuristics for Concept Learning'],
  '11': ['§§02–05 Concept Learning Revisited / Classifying Birds / Challenge of Classification; §06 Equivalence Classes; §09 Concept Hierarchies', '§§12–15 Types of Concepts / Axiomatic Concepts / Prototype Concepts / Exemplar Concepts', '§09 Concept Hierarchies; §19 Bottom-Up Search'],
  '12': ['§02 Why do we need formal logic; §06 Predicates; §§07–09 Conjunctions / Implies / Notation', '§§07–08 Conjunctions and Disjunctions / Implies; §25 Truth of Implications; §26 Implication Elimination; §27 Rules of Inference', '§29 Universal Quantifiers', '§30 A Simple Proof; §31 A More Complex Proof'],
};

export function buildCoursePack(baseline = readBaseline()): { pack: CoursePack; legacyQuestions: Record<string, Record<string, Question>>; focusMap: Record<string, string[]> } {
  const concepts = new Map<string, CoursePack['concepts'][number]>();
  const addTerm = ([term, definition, page, end]: Term, verified = true) => {
    const id = conceptId(term);
    if (!concepts.has(id) || verified) concepts.set(id, {
      id, term, definition, aliases: [], prerequisiteIds: [], contrastIds: [],
      citations: [{ ...ebook(page, end, term), verification: verified ? 'verified' : 'unverified' }],
    });
    return id;
  };
  for (const guide of Object.values(baseline.guides)) for (const term of guide.terms) addTerm(term, false);
  for (const lesson of Object.values(depth)) lesson.terms.forEach(term => addTerm(term));
  forwardTerms.forEach(term => addTerm(term));
  const related = (term: string, prerequisites: string[] = [], contrasts: string[] = []) => {
    const concept = concepts.get(conceptId(term));
    if (concept) {
      concept.prerequisiteIds = prerequisites.map(conceptId);
      concept.contrastIds = contrasts.map(conceptId);
    }
  };
  related('Deliberation', [], ['Reaction', 'Metacognition']);
  related('Metacognition', ['Deliberation'], ['Reaction']);
  related('Semantic network', ['Lexicon', 'Structure', 'Semantics']);
  related('Means-ends analysis', ['State space', 'Difference', 'Operator']);
  related('Chunking', ['Impasse', 'Production rule', 'Episodic knowledge']);
  related('Default value', ['Slot', 'Filler']);
  related('Case-based reasoning', ['Case', 'Nearest neighbor']);
  related('Incremental concept learning', ['Semantic network']);
  related('Require-link', ['Incremental concept learning'], ['Forbid-link', 'Drop-link']);
  related('Climb-tree', ['Background knowledge'], ['Enlarge-set']);
  related('Axiomatic concept', [], ['Prototype concept', 'Exemplar concept']);
  related('Modus ponens', ['Knowledge base', 'Predicate'], ['Modus tollens']);
  related('Resolution theorem proving', ['Conjunctive normal form']);
  related('Specific model', [], ['General model']);
  related('Learning goal', ['Knowledge gap']);

  const focusMap: Record<string, string[]> = {};
  const outcomes: CoursePack['syllabus']['outcomes'] = [];
  const chapters: CoursePack['chapters'] = baseline.lessons.map(lesson => {
    const guide = baseline.guides[lesson.id];
    const detail = depth[lesson.id];
    const blockCounts: Partial<Record<Block['kind'], number>> = {};
    const blocks: Block[] = [];
    const terms = [...new Set([...guide.terms.map(term => conceptId(term[0])), ...(detail?.terms.map(term => conceptId(term[0])) ?? [])])];
    const locators = [ebook(lesson.pages[0], lesson.pages[1], `Lesson ${lesson.id}: ${lesson.title}`)];
    const make = (block: Omit<Block, 'id' | 'conceptIds' | 'citations'>, citations: Citation[] = locators, conceptIds: string[] = terms): string => {
      const index = (blockCounts[block.kind] ?? 0) + 1;
      blockCounts[block.kind] = index;
      const id = `${chapterId(lesson.id)}-${block.kind}-${index}`;
      blocks.push({ ...block, id, citations, conceptIds } as Block);
      return id;
    };
    // One block per baseline focus position preserves exact resume locations.
    focusMap[lesson.id] = baseline.focus[lesson.id].map(step => {
      if (step.kind === 'preview') return make({ kind: 'callout', tone: 'note', title: 'Preview', text: `${lesson.thesis}\n\nFor this lesson: ${lesson.objectives[0]}` } as Block, locators);
      if (step.kind === 'concept') return make({ kind: 'paragraph', text: `${step.heading}\n\n${step.text}` } as Block, [{ ...ebook(step.page, step.page, step.heading), verification: 'unverified' }]);
      if (step.kind === 'trace') {
        const row = lesson.worked.steps[step.index!];
        const last = step.index === lesson.worked.steps.length - 1;
        return make({ kind: 'example', title: `${lesson.worked.title} — step ${step.index! + 1}`,
          problem: lesson.worked.setup, steps: [`${row[0]}: ${row[1]}\n${row[2]}`],
          conclusion: last ? `${lesson.worked.result}\n${lesson.worked.limit}` : row[2],
        } as Block, [original]);
      }
      if (step.kind === 'attempt') return make({ kind: 'callout', tone: 'note', title: 'Your turn — original transfer exercise', text: lesson.exercise.prompt } as Block, [original]);
      if (step.kind === 'compare') return make({ kind: 'callout', tone: 'note', title: 'Compare your explanation', text: `${lesson.exercise.answer}\n\nCheck your explanation:\n${lesson.exercise.rubric.join('\n')}` } as Block, [original]);
      if (step.kind === 'recall') {
        const [prompt, answer] = lesson.cards[step.index!];
        return make({ kind: 'recall', prompt, answer } as Block, [original]);
      }
      if (step.kind === 'finish') return make({ kind: 'callout', tone: 'note', title: 'Keep your next step', text: 'Leave one useful starting point for your next visit. No need to write a full summary. Reaching the end of a study path records a visit, not mastery or an exam prediction.' } as Block, [original]);
      throw new Error(`Unmapped baseline focus step ${lesson.id}/${step.key}`);
    });
    make({ kind: 'list', title: 'Preserved foundation explanation', ordered: false, items: lesson.deep } as Block, locators);
    make({ kind: 'paragraph', text: `Engineering bridge — original analogy\n\n${lesson.engineer}` } as Block, [original]);
    make({ kind: 'callout', tone: 'misconception', title: `Contrast: ${lesson.contrast[0]}`, text: `${lesson.contrast[1]}\n\n${lesson.traps.join('\n')}` } as Block, locators);
    const outcomeIds = lesson.objectives.map((text, i) => {
      const id = `outcome-${lesson.id}-${i + 1}`;
      outcomes.push({ id, text, conceptIds: terms });
      return id;
    });
    make({ kind: 'list', title: 'Learning outcomes', ordered: false, items: lesson.objectives } as Block, locators);
    make({ kind: 'table', title: 'Canonical course vocabulary', columns: ['Term', 'Meaning', 'Source locator'], rows: terms.map(id => {
      const term = concepts.get(id)!;
      const cite = term.citations[0];
      return [term.term, term.definition, `2016 ebook PDF p. ${cite.pdfPage}${cite.pdfPageEnd !== cite.pdfPage ? `–${cite.pdfPageEnd}` : ''}; ${cite.verification === 'verified' ? 'checked source concept' : 'baseline locator; exact pairing not fully reverified'}`];
    }) } as Block, terms.map(id => concepts.get(id)!.citations[0]));
    if (detail) {
      detail.sections.forEach(([title, page, end, text], index) => {
        const citations = [ebook(page, end, sourceSections[lesson.id][index])];
        if (lesson.id === '02' && index === 2) citations.push(syllabus(3, 'Course Calendar At-A-Glance'), syllabus(4, 'Course Assessments'), syllabus(6, 'AI Collaboration Policy'));
        if (lesson.id === '05' && index === 2) citations.push(ebook(175, 175, 'Lesson13 §09 Operators'));
        make({ kind: 'paragraph', text: `${title}\n\n${text}` } as Block, citations);
      });
      make({ kind: 'list', title: 'Mechanism assumptions and counterexample checks', ordered: false, items: detail.assumptions } as Block, [original, ...locators]);
      make({ kind: 'example', ...detail.trace } as Block, [original, ...locators]);
      make({ kind: 'example', ...detail.transfer } as Block, [original, ...locators]);
      const d = detail.diagram;
      make({
        kind: 'diagram', title: d.title, caption: d.caption, alternative: d.alternative,
        nodes: d.nodes.map(([label, detail, column], i) => ({ id: `n${i + 1}`, label, detail, column })),
        edges: d.edges.map(([from, to, label]) => ({ from: `n${from + 1}`, to: `n${to + 1}`, label })),
        steps: d.steps.map(([title, explanation, active]) => ({ title, explanation, activeNodeIds: active.map(i => `n${i + 1}`) })),
      } as Block, [original, ...locators]);
      make({ kind: 'callout', tone: 'note', title: 'Benchmark depth and source boundary', text: 'This lesson has benchmark-depth mechanism explanations, declared assumptions, original worked examples, counterexamples, transfer exercises, and a declarative diagram. Source citations support concepts; invented labels, numbers, traces, and diagrams are original teaching material. No lecture timestamps are asserted, and no actual exam content or assessed submission is included.' } as Block, [original, ...locators]);
    } else {
      make({ kind: 'callout', tone: 'note', title: 'Preserved foundation — not benchmark depth', text: 'The baseline lesson, original exercise, recall cards, and vocabulary remain available. This chapter has not received the same source-grounded expansion as Lessons01–12. Its broad chapter range is known, but detailed baseline heading/definition pairings and linked external readings have not all been independently rechecked.' } as Block, locators);
    }
    if (lesson.id === '05') make({ kind: 'callout', tone: 'note', title: 'Forward connection: preconditions and postconditions', text: 'The Lesson13 operators section names preconditions and postconditions. Preconditions must hold before application; postconditions describe what becomes true after it. In this pack these canonical terms clarify operator applicability and subgoal composition without claiming they were introduced in Lesson05.' } as Block, [ebook(175, 175, 'Lesson13 §09 Operators')], ['Preconditions', 'Postconditions'].map(conceptId));
    if (lesson.id === '15') make({ kind: 'table', title: 'Canonical primitive actions — limited verified correction', columns: ['Primitive', 'Meaning', 'Original contrast'], rows: [
      ['move-object', 'Physical location change.', 'An invented box changes shelves; possession can stay the same.'],
      ['move-possession', 'Possession changes.', 'An invented loan is reassigned on paper while the box stays put.'],
      ['ingest', 'An object is taken into an agent’s body.', 'An eating interpretation differs from a metaphorical “consume time” interpretation.'],
    ] } as Block, [ebook(202, 205, 'Lesson15 §§03–08 Primitive Actions / Thematic Roles and Primitive Actions'), original], ['Move-object', 'Move-possession', 'Ingest'].map(conceptId));
    if (lesson.id === '19') make({ kind: 'paragraph', text: 'Verified canonical terminology: the ebook uses specific model and general model. A positive example calls for generalizing the specific model; a negative example calls for specializing the general model. S and G are conventional boundary notation, not a replacement for the course’s words. Boundary sets, noise, and arbitrary hypothesis languages need more treatment than this preserved foundation supplies.' } as Block, [ebook(253, 253, 'Lesson19 §03 Abstract Version Spaces')], ['Specific model', 'General model'].map(conceptId));
    if (lesson.id === '24') make({ kind: 'paragraph', text: 'Verified canonical mechanism: knowledge gap → learning goal. The agent recognizes that it lacks knowledge connecting parts of an explanation, then sets a goal to acquire the missing connection. It can seek memory or a teacher to satisfy that goal. Detecting a gap, generating a learning goal, and satisfying it are distinct steps; this limited correction does not claim full benchmark-depth coverage of meta-reasoning.' } as Block, [ebook(317, 317, 'Lesson24 §03 Beyond Mistakes Knowledge Gaps')], ['Knowledge gap', 'Learning goal'].map(conceptId));
    if (lesson.id === '02') make({ kind: 'callout', tone: 'warning', title: 'Fall2026 overrides historical project instructions', text: 'The current semester-long assignment is ARC-AGI, not the 2016 Raven project. AI discussion for understanding is allowed; AI-generated assessed code, reports, and direct submission content are prohibited. Do not copy actual proctored exam content into this learning tool or retain it after an exam. Original diagnostic practice is not an official partial-credit grade.' } as Block, [syllabus(4, 'Course Assessments'), syllabus(6, 'Academic Honesty / AI Collaboration Policy')]);
    const readings = baseline.readings.filter(reading => lesson.readings.includes(reading.id));
    if (readings.length) make({ kind: 'list', title: 'Linked readings — retained, not independently verified', ordered: false, items: readings.map(reading => `${reading.title}. ${reading.use} ${reading.url && reading.url.startsWith('https://') ? reading.url : 'Consult the course reading list; no local input file is published.'} Status: unverified; neither the full text nor its exact page-level claims was independently inspected for this pack.`) } as Block, readings.map(reading => ({ sourceId: `reading-${reading.id}`, section: reading.title, verification: 'unverified' })));
    return { id: chapterId(lesson.id), number: Number(lesson.id), title: lesson.title, summary: lesson.thesis, outcomeIds, prerequisiteIds: lesson.prior.map(chapterId), depth: detail ? 'benchmark' : 'foundation', blocks };
  });

  const convertQuestion = (question: LegacyQuestion, revision: number): Question => ({
    id: question.id, revision, chapterId: chapterId(question.lesson),
    conceptIds: chapters.find(chapter => chapter.id === chapterId(question.lesson))!.blocks.find(block => block.kind === 'table')!.conceptIds,
    prompt: question.prompt, original: true,
    options: question.options.map((option, i) => ({ id: `option-${i + 1}`, ...option })),
    explanation: question.options.map(option => `${option.correct ? 'Correct' : 'Incorrect'}: ${option.explanation}`).join('\n'),
    citations: [original],
  });
  const legacyQuestions = Object.fromEntries(Object.entries(baseline.snapshots).map(([revision, questions]) => [revision, Object.fromEntries(questions.map(question => [question.id, convertQuestion(question, Number(revision))]))]));
  const policies: CoursePack['syllabus']['policies'] = [
    { id: 'policy-authority', title: 'Administrative source precedence', text: 'Fall2026 syllabus and current official announcements override historical 2016 Raven assignments. Current linked assignment and exam instructions may change; these live pages were not independently reviewed. The supplied syllabus p.3 calendar is the authority for this pack’s Sunday dates.', citations: [syllabus(3, 'Course Calendar At-A-Glance'), syllabus(4, 'Official Course Communication')] },
    { id: 'policy-aoe', title: 'Deadlines are Anywhere on Earth', text: 'The Fall2026 calendar states Sundays at 23:59 Anywhere on Earth (UTC−12). Stored timezone is the IANA identifier Etc/GMT+12, whose sign convention means UTC−12. The exported summary’s local display differs; do not read that display as an additional AoE deadline.', citations: [syllabus(3, 'Course Calendar At-A-Glance')] },
    { id: 'policy-ai', title: 'AI supports learning, not assessed submissions', text: 'Discussion with an AI learning assistant is allowed to develop understanding. Do not copy AI output into assessed documents or let AI generate assessed code or reports. Disable integrated assistance beyond a grammar checker in the assessed workspace. This original learning pack is not a homework-answer generator.', citations: [syllabus(6, 'AI Collaboration Policy')] },
    { id: 'policy-exam', title: 'Proctored exam content cannot leave the exam', text: 'Do not seek live external input on exam material, use a second device, retain or share exam questions/screenshots, or transcribe actual questions into a tool that preserves access after the exam. This pack contains only original practice; it must not be used to store actual exam content.', citations: [syllabus(6, 'Academic Honesty: proctored assessments')] },
    { id: 'policy-diagnostic', title: 'Original practice is diagnostic, not an official grade', text: 'The 66 questions are original learning questions, not released course exams. Exact option-set agreement and decision-level feedback diagnose misconceptions; neither implements the official partial-credit algorithm nor predicts a course grade. The syllabus confirms partial credit but does not specify its formula.', citations: [original, syllabus(4, 'Exams (15%)')] },
    { id: 'policy-submission', title: 'Protect assessed work and verify submission', text: 'Do not publish assessed code or actual submissions during or after the semester. Submit to the correct Canvas or Gradescope destination, then download and inspect the submitted file. Borrowed project-agnostic code needs clear attribution; course-project solutions and other students’ code cannot be copied.', citations: [syllabus(3, 'Course Assessments'), syllabus(6, 'Academic Honesty')] },
    { id: 'policy-grading', title: 'Fall2026 grade components', text: 'Homework 15% (three at 5%); mini-projects 30% (five at 6%); ARC-AGI milestones 15% and final project 15%, with performance/report splits; exams 15% (two at 7.5%); participation 10%. These weights do not turn the pack’s original practice into assessed work.', citations: [syllabus(3, 'Course Assessments'), syllabus(4, 'Homework / Mini-Projects / ARC-AGI / Exams / Participation')] },
  ];
  const assessments: CoursePack['syllabus']['assessments'] = [];
  const weeks = baseline.weeks.map(week => {
    const chapterIds = week.lessons.map(chapterId);
    const assessmentIds = week.deliverables.map(deliverable => {
      const exam = deliverable.key === 'exam-1' ? 1 : deliverable.key === 'exam-2' ? 2 : 0;
      const id = exam ? `exam-${exam}` : `assessment-${deliverable.key}`;
      const scope = exam ? chapters.filter(chapter => chapter.number >= (exam === 1 ? 1 : 13) && chapter.number <= (exam === 1 ? 12 : 25)).map(chapter => chapter.id) : chapterIds;
      assessments.push({
        id, title: deliverable.title, kind: exam ? 'exam' : /project|milestone/i.test(deliverable.title) ? 'project' : 'assignment',
        dueAt: `${week.due}T23:59:00-12:00`, timezone: 'Etc/GMT+12', chapterIds: scope,
        policyIds: exam ? ['policy-aoe', 'policy-exam', 'policy-diagnostic', 'policy-authority'] : ['policy-aoe', 'policy-ai', 'policy-submission', 'policy-authority'],
        description: exam ? `Exam ${exam} covers Lessons${exam === 1 ? '01–12' : '13–25'}. 90 minutes, 22 multiple-correct questions, five options, between one and four correct. Proctored; official partial credit is not reproduced by this pack. Earlier concepts may appear in Exam2’s later-lesson contexts.`
          : `${deliverable.title} — ${deliverable.kind === 'participation' ? 'participation activity' : 'course deliverable'}. Consult current official instructions${deliverable.url ? `: ${deliverable.url}` : '.'} This entry preserves the p.3 planning-calendar deadline, not a generated solution or independently verified live specification.`,
        ...(exam ? { mock: { durationMinutes: 90, questionCount: 22, optionCount: 5, minCorrect: 1, maxCorrect: 4 } } : {}),
        citations: exam ? [syllabus(3, 'Course Calendar At-A-Glance'), syllabus(4, 'Exams (15%)')] : [syllabus(3, 'Course Calendar At-A-Glance')],
      });
      return id;
    });
    return {
      id: `week-${String(week.number).padStart(2, '0')}`, number: week.number, title: week.title, chapterIds, assessmentIds,
      notes: `Week of ${week.start}; planning deadline ${week.due} at 23:59 AoE (UTC−12).\nFocus: ${week.focus}\nPreparation:\n${week.prep.join('\n')}\nOriginal application: ${week.application}\nReflection: ${week.reflection}\nNext: ${week.next}${week.revisit.length ? `\nRevisit: ${week.revisit.join(', ')}` : ''}`,
    };
  });
  const pack: CoursePack = {
    schemaVersion: '1.0', id: 'kbai', contentRevision: 4,
    metadata: {
      title: 'Knowledge-Based AI', subtitle: 'CS7637 · Fall2026 · a source-grounded course pack',
      description: 'All 26 course lessons and the 17-week Fall2026 plan. Lessons01–12 have expanded benchmark-depth explanations and original diagrams; Lessons13–26 retain the foundation with explicitly limited corrections. Includes 66 original practice questions and 78 preserved recall cards. Not an official course text, assessed submission, or live-exam assistant.',
      language: 'en', educationLevel: 'masters', levelInference: { evidence: ['The supplied Fall2026 syllabus identifies OMS CS7637 and distinguishes graduate from undergraduate evaluation on p.3.', 'Designing and evaluating symbolic agents and relating their mechanisms to cognitive science matches postgraduate course expectations.'], confidence: 'high', confirmed: false, unknowns: ['This is a course-level inference, not a confirmation of the individual learner’s age, enrollment, or prior knowledge.'] },
      institution: 'Georgia Institute of Technology', courseCode: 'CS7637', cover: 'cube', depth: 'deep', createdAt: date, updatedAt: '2026-10-11T11:54:11.547Z',
    },
    sources: [
      { id: 'ebook-2016', assetId: 'asset-ebook-2016-pdf', title: 'KBAI Ebook: Knowledge-based Artificial Intelligence', author: 'Ashok Goel and David Joyner; ebook design Bhavin Thaker, David Joyner, Ashok Goel', edition: 'Updated October 6, 2016', kind: 'ebook', pageCount: 357, verification: 'verified', rights: 'Source copyright ©2016 Ashok Goel and David Joyner; all rights reserved. Only original paraphrases and bibliographic locators are distributed; no PDF, source figure, or transcript is bundled.' },
      { id: 'syllabus-fa26', assetId: 'asset-syllabus-fa26-pdf', title: 'CS7637: Knowledge-Based AI (FA26)', author: 'Georgia Institute of Technology course staff', edition: 'Fall2026; supplied August 24, 2026 export', kind: 'syllabus', pageCount: 9, verification: 'verified', url: 'https://gatech.instructure.com/courses/536204/assignments/syllabus', rights: 'Administrative facts are summarized with locators. The supplied PDF and authenticated input context are not published.' },
      { id: 'original-handbook', title: 'Original KBAI learning explanations, diagrams, and practice', author: 'Handbook contributors', edition: 'Course pack revision 4', kind: 'original', verification: 'original', rights: 'Original teaching material and trusted baseline practice retained for this learning pack; not official exams, source transcripts, or assessed student work.' },
      ...baseline.readings.map(reading => ({
        id: `reading-${reading.id}`, title: reading.title, author: 'See the official course reading list', edition: 'Baseline linked-reading entry; full source not independently verified',
        kind: 'reading' as const, verification: 'unverified' as const, ...(reading.url?.startsWith('https://') ? { url: reading.url } : {}),
        rights: 'Bibliographic pointer only. No linked reading PDF or local filename is bundled or published.',
      })),
    ],
    assets: sourcePdfAssets, concepts: [...concepts.values()], chapters,
    syllabus: { outcomes, weeks, assessments, policies },
    practice: baseline.questions.map(question => convertQuestion(question, 3)),
    coverage: {
      summary: 'Benchmark expansion covers Lessons01–12 with mechanisms, assumptions, original traces, transfer, vocabulary, and 12 original declarative diagrams. All 26 baseline lessons, 17 syllabus weeks, 66 current original questions, and 78 recall cards are preserved. Exact current practice and three historical answer-key revisions are stored independently of private inputs. Later lessons are foundation, not equivalently deep.',
      gaps: [
        { id: 'gap-foundation-depth', description: 'Lessons13–26 are preserved foundation, not full benchmark-depth reconstructions. Verified terminology corrections at pp.175, 202–205, 253, and 317 do not close this depth gap.', status: 'partial', chapterIds: chapters.slice(12).map(chapter => chapter.id), sourceIds: ['ebook-2016'] },
        { id: 'gap-external-readings', description: 'Linked readings remain bibliographic learning pointers. Full texts, editions, exact reading-page claims, and availability were not independently inspected; do not treat them as verified evidence for the new explanations.', status: 'unverified', chapterIds: chapters.map(chapter => chapter.id), sourceIds: baseline.readings.map(reading => `reading-${reading.id}`) },
        { id: 'gap-baseline-locators', description: 'Some preserved baseline guide heading/page pairings point to where a heading begins near a page boundary rather than where its substantive explanation appears (for example drop-link begins at p.123 and is explained at p.124). They are marked unverified; new mechanism blocks cite the inspected substantive ranges.', status: 'unverified', chapterIds: chapters.map(chapter => chapter.id), sourceIds: ['ebook-2016'] },
        { id: 'gap-transcripts', description: 'The ebook itself flags correspondence problems for Lessons02,04,14,25 and incomplete transcripts in Lessons03,05,24,25 on p.3. New explanations use inspectable PDF sections; video-link correspondence, precise timestamps, and missing transcript material were not verified or reconstructed.', status: 'partial', chapterIds: ['02', '03', '04', '05', '14', '24', '25'].map(chapterId), sourceIds: ['ebook-2016'] },
        { id: 'gap-live-administration', description: 'Authenticated live Canvas pages, assignment rubrics, opening dates, and exam partial-credit formula were not independently reviewed. The supplied Fall2026 syllabus is the snapshot authority; current official announcements can supersede it.', status: 'unverified', chapterIds: chapters.map(chapter => chapter.id), sourceIds: ['syllabus-fa26'] },
        { id: 'gap-calendar-display', description: 'The syllabus p.3 weekly table specifies Sunday 23:59 AoE; pp.7–9 render local summary times and the end-of-course survey differs from the week17 planning date. This pack uses the p.3 calendar for planning, flags the discrepancy, and makes no invented reconciliation of the survey deadline.', status: 'partial', chapterIds: ['lesson-26'], sourceIds: ['syllabus-fa26'] },
        { id: 'gap-full-first-order-logic', description: 'Lesson12 includes predicate/quantifier concepts and original scope counterexamples, but not a complete first-order resolution implementation, unification algorithm, Skolemization treatment, or exhaustive proof-search complexity account. The worked refutation is propositional.', status: 'partial', chapterIds: ['lesson-12'], sourceIds: ['ebook-2016'] },
      ],
    },
    provenance: {
      generatedAt: '2026-10-11T11:54:11.547Z', generator: 'scripts/build-kbai.ts', contentLicense: 'MIT for original pack material; source rights reserved',
      method: 'Trusted baseline data evaluated with Node vm at conversion time only. New source-grounded explanations were authored after local PyMuPDF inspection of substantive ebook sections and the Fall2026 syllabus. Production consumes persistent validated JSON; no source PDF, transcript, private path, or input executable is required.',
      sourceRights: 'The 2016 ebook and supplied syllabus retain their original rights. Original examples are labelled and are not official course questions or assessed submissions.', originalExplanations: true,
    },
  };
  const validated = validateCoursePack(pack);
  if (!validated.ok) throw new Error(JSON.stringify(validated.issues, null, 2));
  return { pack: validated.pack, legacyQuestions, focusMap };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { pack, legacyQuestions, focusMap } = buildCoursePack();
  mkdirSync('src/content', { recursive: true });
  writeFileSync('src/content/kbai.json', `${JSON.stringify(pack, null, 2)}\n`);
  writeFileSync('src/content/legacy-questions.json', `${JSON.stringify(legacyQuestions, null, 2)}\n`);
  writeFileSync('src/content/legacy-focus-map.json', `${JSON.stringify(focusMap, null, 2)}\n`);
  console.log(`Validated ${pack.chapters.length} lessons, ${pack.syllabus.weeks.length} weeks, ${pack.practice.length} questions, ${pack.chapters.flatMap(chapter => chapter.blocks).filter(block => block.kind === 'recall').length} recall cards.`);
}
