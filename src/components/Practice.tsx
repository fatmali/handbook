import { useEffect, useRef, useState } from 'react';
import type { CoursePack } from '../../packages/course-pack/src';
import { exactMatch, finishSession, makeSession, type Progress, type PracticeSession } from '../domain';

export type Mutate = (update: (latest: Progress) => Progress) => Promise<void>;
export function Practice({ pack, progress, mutate, onError, selectedAssessment }: { pack: CoursePack; progress: Progress; mutate: Mutate; onError: (error: unknown) => void; selectedAssessment?: string }) {
  const [revealed, setRevealed] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [resultId, setResultId] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const expiring = useRef(false);
  const active = progress.active;
  const finish = async () => {
    const id = active?.id;
    setFinishing(true);
    try {
      await mutate(latest => {
        if (!latest.active) return latest;
        const finished = finishSession(latest.active);
        return { ...latest, active: null, history: [finished, ...latest.history].slice(0, 100) };
      });
      if (id) setResultId(id);
    } finally { setFinishing(false); }
  };
  useEffect(() => {
    if (active?.deadline === null || !active) return;
    const tick = () => setNow(Date.now());
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [active?.deadline, active?.id]);
  useEffect(() => {
    if (active?.deadline && now >= active.deadline && !expiring.current) {
      expiring.current = true;
      void finish().catch(onError).finally(() => { expiring.current = false; });
    }
  });
  async function start(assessmentId: string | null, mode: 'practice' | 'mock' = assessmentId ? 'mock' : 'practice') {
    const session = makeSession(pack, assessmentId, Date.now(), mode);
    setRevealed(null); setResultId(null);
    await mutate(latest => ({ ...latest, active: session }));
  }
  const completed = progress.history.find(session => session.id === resultId);
  if (finishing) return <section aria-busy="true"><h1>Saving your practice result…</h1><p>Wait for the local transaction to finish before leaving.</p></section>;
  if (completed) return <><h1>Practice results</h1><Results session={completed}/><button onClick={() => setResultId(null)}>Back to practice</button></>;
  if (!active) return <>
    <h1>Practice your reasoning</h1>
    <p className="lead">Original teaching questions, not official or predicted exam items. Select every supported statement.</p>
    <p>No official partial-credit formula is available. Handbook reports exact matches and skipped questions, never a predicted grade.</p>
    <div className="button-row"><button className="primary" disabled={!pack.practice.length} onClick={() => void start(null).catch(onError)}>Start untimed practice</button></div>
    <h2>Untimed assessment preparation</h2>
    {pack.syllabus.assessments.filter(assessment => assessment.kind === 'exam').map(assessment => <section className="assessment" key={assessment.id}><h3>{assessment.title}{selectedAssessment === assessment.id ? ' — selected scope' : ''}</h3><p>Practice only the declared lesson scope, with no study timer.</p><button onClick={() => void start(assessment.id, 'practice').catch(onError)}>Practice {assessment.title} untimed</button></section>)}
    <h2>Separate timed mocks</h2>
    {pack.syllabus.assessments.filter(assessment => assessment.mock).map(assessment => <section className="assessment" key={assessment.id}><h3>{assessment.title}{selectedAssessment === assessment.id ? ' — selected' : ''}</h3><p>{assessment.mock!.durationMinutes} minutes, {assessment.mock!.questionCount} original questions. Scope: {assessment.chapterIds.map(id => pack.chapters.find(chapter => chapter.id === id)?.number).join(', ')}. The timer begins only when you choose this button.</p><button onClick={() => void start(assessment.id).catch(onError)}>Start {assessment.title} mock</button></section>)}
    {!pack.syllabus.assessments.some(assessment => assessment.mock) && <p className="muted">This course does not declare a timed mock.</p>}
    <h2>Revisioned history</h2>
    {!progress.history.length && <p className="muted">Your results will stay private in this browser.</p>}
    {progress.history.map(session => <button className="history-row" key={session.id} onClick={() => setResultId(session.id)}>{new Date(session.startedAt).toLocaleString()} — {session.mode}, content revision {session.contentRevision}, {session.questions.filter(question => exactMatch(question, session.answers[question.id] ?? [])).length} exact matches</button>)}
  </>;
  const question = active.questions[active.index];
  const selected = active.answers[question.id] ?? [];
  const expired = active.deadline !== null && now >= active.deadline;
  const remaining = active.deadline === null ? null : Math.max(0, Math.ceil((active.deadline - now) / 1000));
  async function updateSession(update: (session: PracticeSession) => PracticeSession) {
    await mutate(latest => {
      if (latest.active?.deadline !== null && latest.active?.deadline !== undefined && Date.now() >= latest.active.deadline) throw new Error('The mock deadline expired. No later answer change was recorded.');
      return { ...latest, active: latest.active ? update(latest.active) : null };
    });
  }
  return <section className="practice-session">
    <h1>{active.mode === 'mock' ? 'Original practice mock' : 'Untimed practice'}</h1>
    <div className="session-context"><span>Question {active.index + 1} / {active.questions.length}</span>{remaining !== null && <strong role="timer" aria-label="Mock time remaining">{Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}</strong>}</div>
    <fieldset disabled={expired}><legend>{question.prompt}</legend>
      <p className="small muted">Select all that apply. An unchecked question can be skipped without inventing an answer.</p>
      {question.options.map(option => <label className="practice-option" key={option.id}><input type="checkbox" checked={selected.includes(option.id)} onChange={event => {
        const checked = event.target.checked;
        void updateSession(session => {
          const current = session.answers[question.id] ?? [];
          return { ...session, answers: { ...session.answers, [question.id]: checked ? [...new Set([...current, option.id])] : current.filter(id => id !== option.id) } };
        }).catch(onError);
      }}/><span>{option.text}</span></label>)}
      <label>Confidence <select value={active.confidence[question.id] ?? ''} onChange={event => {
        const confidence = event.target.value;
        if (confidence !== '' && confidence !== 'low' && confidence !== 'medium' && confidence !== 'high') return;
        void updateSession(session => ({ ...session, confidence: { ...session.confidence, [question.id]: confidence } })).catch(onError);
      }}><option value="">Not rated</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
      <label className="inline"><input type="checkbox" checked={active.flagged[question.id] ?? false} onChange={event => { const checked = event.target.checked; void updateSession(session => ({ ...session, flagged: { ...session.flagged, [question.id]: checked } })).catch(onError); }}/>Flag for review</label>
    </fieldset>
    {active.mode === 'practice' && <button onClick={() => setRevealed(revealed === question.id ? null : question.id)}>Check answer</button>}
    {revealed === question.id && active.mode === 'practice' && <div className="answer"><p><strong>{selected.length ? exactMatch(question, selected) ? 'Exact match' : 'Review your reasoning' : 'Skipped, not scored as an answer'}</strong></p><p>{question.explanation}</p><ul>{question.options.map(option => <li key={option.id}><strong>{option.correct ? 'Supported' : 'Not supported'}:</strong> {option.text} — {option.explanation}</li>)}</ul></div>}
    <div className="button-row">
      <button disabled={active.index === 0 || expired} onClick={() => void updateSession(session => ({ ...session, index: session.index - 1 })).catch(onError)}>Previous question</button>
      <button disabled={active.index === active.questions.length - 1 || expired} onClick={() => { setRevealed(null); void updateSession(session => ({ ...session, index: session.index + 1 })).catch(onError); }}>Next / skip</button>
      <button className="primary" onClick={() => void finish().catch(onError)}>Finish practice</button>
    </div><p className="small muted">Answers and the original question revision are saved after each change. Returning to a mock does not restart its deadline.</p>
  </section>;
}
function Results({ session }: { session: PracticeSession }) {
  const skipped = session.questions.filter(question => !(session.answers[question.id]?.length)).length;
  const exact = session.questions.filter(question => exactMatch(question, session.answers[question.id] ?? [])).length;
  return <><p className="lead">{exact} / {session.questions.length} exact matches; {skipped} skipped. {session.reason === 'expired' ? 'The mock deadline expired.' : 'Practice submitted.'}</p><p className="muted">Diagnostic feedback only, not an official grade. Historical questions below retain revision {session.contentRevision} content snapshots.</p>{session.questions.map(question => <details key={question.id}><summary>{question.prompt} — {!session.answers[question.id]?.length ? 'skipped' : exactMatch(question, session.answers[question.id]) ? 'exact match' : 'review'}</summary><p>Question revision {question.revision}. {question.explanation}</p><ul>{question.options.map(option => <li key={option.id}><strong>{session.answers[question.id]?.includes(option.id) ? 'Selected' : 'Not selected'}; {option.correct ? 'supported' : 'unsupported'}:</strong> {option.text} — {option.explanation}</li>)}</ul></details>)}</>;
}
