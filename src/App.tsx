import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { defaultProfile, privateProfileSchema, type Block, type CoursePack, type PrivateProfile } from '../packages/course-pack/src';
import { emptyProgress, latestResume, type Progress, type Annotation } from './domain';
import { Library, storageMessage } from './storage';
import { LEGACY_KEY } from './migration';
import { registerPWA } from './pwa';
import { ContentBlock, Cover, CitationList } from './components/CourseContent';
import { NoteEditor } from './components/Notebook';
import { Practice, type Mutate } from './components/Practice';
import { ImportCourse } from './components/ImportCourse';
import { UtilityIcon } from './components/UtilityIcon';
import { CoverageDetails } from './components/CoverageDetails';
import { Onboarding } from './components/Onboarding';

type Snapshot = Awaited<ReturnType<Library['snapshot']>>;
type Route = { page: string; courseId?: string; chapterId?: string; detail?: string };
const initial: Snapshot = { packs: [], progress: [], profile: defaultProfile, revision: 0, warnings: [] };
export function routeFromHash(hash: string, snapshot: Snapshot): Route {
  const value = hash.replace(/^#\/?/, '');
  const selected = snapshot.packs.find(pack => pack.id === 'kbai') ?? snapshot.packs[0];
  if (/^week-\d+$/.test(value)) {
    const week = selected?.syllabus.weeks.find(week => week.number === Number(value.slice(5)));
    return { page: 'weekly', courseId: selected?.id, chapterId: week?.id ?? value };
  }
  if (/^exam-\d+$/.test(value)) return { page: 'practice', courseId: selected?.id, detail: value };
  if (/^chapter-\d+$/.test(value)) return { page: 'chapter', courseId: selected?.id, chapterId: `lesson-${value.slice(8).padStart(2, '0')}` };
  if (value === 'focus') {
    const progress = snapshot.progress.find(progress => progress.courseId === selected?.id);
    return { page: 'focus', courseId: selected?.id, chapterId: progress?.last?.chapterId ?? selected?.chapters[0]?.id };
  }
  if (value === 'main-content') return { page: 'library' };
  const parts = value.split('/').map(part => { try { return decodeURIComponent(part); } catch { return ''; } });
  return { page: parts[0] || 'library', courseId: parts[1], chapterId: parts[2], detail: parts[3] };
}
const hashFor = (page: string, courseId?: string, chapterId?: string) => `#/${[page, courseId, chapterId].filter(Boolean).map(value => encodeURIComponent(value!)).join('/')}`;
export function download(data: unknown, name: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([typeof data === 'string' ? data : JSON.stringify(data)], { type }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
class Boundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(error: Error) { return { error: error.message }; }
  render() { return this.state.error ? <main className="boot error" role="alert"><h1>Handbook could not display this page</h1><p>{this.state.error}</p><p>Your saved files remain in browser storage. Reload to return to the library.</p><button onClick={() => location.reload()}>Reload Handbook</button></main> : this.props.children; }
}
export function App() { return <Boundary><Handbook/></Boundary>; }
function Handbook() {
  const [library, setLibrary] = useState<Library | null>(null);
  const [snapshot, setSnapshot] = useState(initial);
  const latest = useRef(snapshot);
  const [route, setRoute] = useState<Route>({ page: 'library' });
  const routeRef = useRef(route);
  routeRef.current = route;
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [externalChange, setExternalChange] = useState(false);
  const [loading, setLoading] = useState(true);
  const [candidate, setCandidate] = useState<CoursePack | null>(null);
  const [query, setQuery] = useState('');
  const [concept, setConcept] = useState<string | null>(null);
  const [theme, setTheme] = useState('system');
  const [update, setUpdate] = useState<ServiceWorkerRegistration | null>(null);
  const queues = useRef(new Map<string, Promise<void>>());
  const committed = useRef(new Map<string, Progress>());
  const writing = useRef(new Map<string, number>());
  const pendingDraft = useRef(new Map<string, () => Promise<void>>());
  const reloadRequested = useRef(false);
  const channel = useRef<BroadcastChannel | null>(null);
  const onError = useCallback((error: unknown) => setError(storageMessage(error)), []);
  const publish = useCallback((value: Snapshot) => { latest.current = value; setSnapshot(value); }, []);
  const refresh = useCallback(async () => { if (library) { const value = await library.snapshot(); committed.current = new Map(value.progress.map(progress => [progress.courseId, progress])); publish(value); setExternalChange(false); } }, [library, publish]);
  useEffect(() => {
    let cancelled = false; let local: Library | null = null;
    void (async () => {
      local = await Library.open();
      const legacy = await local.initialize([], localStorage.getItem(LEGACY_KEY));
      const value = await local.snapshot();
      if (cancelled) { local.close(); return; }
      const storedTheme = localStorage.getItem('handbook-theme') ?? legacy?.theme ?? 'system';
      setTheme(['system', 'light', 'dark'].includes(storedTheme) ? storedTheme : 'system');
      committed.current = new Map(value.progress.map(progress => [progress.courseId, progress]));
      setLibrary(local); publish(value); setRoute(routeFromHash(location.hash, value)); setLoading(false);
    })().catch(error => { if (!cancelled) { onError(error); setLoading(false); local?.close(); } });
    return () => { cancelled = true; local?.close(); };
  }, [onError, publish]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    if (!library) return;
    try { localStorage.setItem('handbook-theme', theme); } catch (error) { onError(error); }
  }, [theme, library, onError]);
  useEffect(() => {
    const hashChanged = () => {
      if (location.hash === '#main-content') return;
      void (async () => {
        for (const save of pendingDraft.current.values()) await save();
        pendingDraft.current.clear();
        setConcept(null); setQuery(''); setRoute(routeFromHash(location.hash, latest.current)); window.scrollTo(0, 0);
      })().catch(onError);
    };
    window.addEventListener('hashchange', hashChanged);
    const beforeUnload = (event: BeforeUnloadEvent) => { if (pendingDraft.current.size || [...writing.current.values()].some(count => count > 0)) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', beforeUnload);
    return () => { window.removeEventListener('hashchange', hashChanged); window.removeEventListener('beforeunload', beforeUnload); };
  }, [onError]);
  useEffect(() => {
    if (route.page !== 'syllabus' || !route.detail?.startsWith('week-')) return;
    const pack = snapshot.packs.find(pack => pack.id === route.courseId);
    const week = pack?.syllabus.weeks.find(week => week.number === Number(route.detail?.slice(5)));
    const frame = requestAnimationFrame(() => { if (week) document.getElementById(week.id)?.scrollIntoView(); });
    return () => cancelAnimationFrame(frame);
  }, [route.page, route.detail, route.courseId, snapshot.packs]);
  useEffect(() => {
    if ('BroadcastChannel' in window) {
      channel.current = new BroadcastChannel('handbook-library-v1');
      channel.current.onmessage = () => setExternalChange(true);
    }
    const saved = () => channel.current?.postMessage({ changed: true });
    const blocked = () => onError(new Error('Another tab is upgrading the database. Close older Handbook tabs, then reload.'));
    window.addEventListener('handbook-saved', saved); window.addEventListener('handbook-database-blocked', blocked);
    return () => { channel.current?.close(); window.removeEventListener('handbook-saved', saved); window.removeEventListener('handbook-database-blocked', blocked); };
  }, [onError]);
  useEffect(() => {
    void registerPWA(setUpdate, onError);
    const activated = () => {
      const studying = routeRef.current.page === 'focus' || latest.current.progress.some(progress => progress.active?.mode === 'mock');
      if (reloadRequested.current && !studying) location.reload();
      else reloadRequested.current = false;
    };
    navigator.serviceWorker?.addEventListener('controllerchange', activated);
    return () => navigator.serviceWorker?.removeEventListener('controllerchange', activated);
  }, [onError]);
  const registerDraft = useCallback((key: string, save: (() => Promise<void>) | null) => { if (save) pendingDraft.current.set(key, save); else pendingDraft.current.delete(key); }, []);
  const go = async (page: string, courseId?: string, chapterId?: string) => {
    try {
      for (const save of pendingDraft.current.values()) await save();
      pendingDraft.current.clear();
      location.hash = hashFor(page, courseId, chapterId);
      setQuery(''); setConcept(null);
    } catch (error) { onError(error); }
  };
  const Link = ({ page, courseId, chapterId, children, className = '', current = false }: { page: string; courseId?: string; chapterId?: string; children: ReactNode; className?: string; current?: boolean }) => <a className={className} aria-current={current ? 'page' : undefined} href={hashFor(page, courseId, chapterId)} onClick={event => { event.preventDefault(); void go(page, courseId, chapterId); }}>{children}</a>;
  const mutateFor = (courseId: string): Mutate => async update => {
    if (!library) throw new Error('Library is not ready.');
    const currentView = latest.current.progress.find(progress => progress.courseId === courseId);
    if (!currentView) throw new Error('Course progress unavailable. Reload the library.');
    const optimistic = update(currentView);
    publish({ ...latest.current, progress: latest.current.progress.map(progress => progress.courseId === courseId ? optimistic : progress) });
    writing.current.set(courseId, (writing.current.get(courseId) ?? 0) + 1);
    const previous = queues.current.get(courseId) ?? Promise.resolve();
    const next = previous.then(async () => {
      const current = committed.current.get(courseId);
      if (!current) throw new Error('Course progress unavailable. Reload the library.');
      const saved = await library.saveProgress(update(current));
      committed.current.set(courseId, saved);
    }).then(() => {
      const count = (writing.current.get(courseId) ?? 1) - 1;
      writing.current.set(courseId, count);
      const saved = committed.current.get(courseId)!;
      publish({ ...latest.current, progress: latest.current.progress.map(progress => progress.courseId === courseId ? count ? { ...progress, revision: saved.revision, updatedAt: saved.updatedAt } : saved : progress) });
    }, error => {
      const count = (writing.current.get(courseId) ?? 1) - 1;
      writing.current.set(courseId, count);
      const saved = committed.current.get(courseId);
      if (!count && saved) publish({ ...latest.current, progress: latest.current.progress.map(progress => progress.courseId === courseId ? saved : progress) });
      throw error;
    });
    queues.current.set(courseId, next);
    try { await next; }
    finally { if (queues.current.get(courseId) === next) queues.current.delete(courseId); }
  };
  if (loading) return <main className="boot" aria-busy="true"><h1>Opening your handbook…</h1><p>Loading courses and private notes from this browser.</p></main>;
  if (!library) return <main className="boot error" role="alert"><h1>Local library could not open</h1><p>{error}</p><p>Existing data is untouched. A corrupt legacy migration is not replaced by an empty library.</p><button onClick={() => location.reload()}>Try opening again</button><button onClick={() => download(localStorage.getItem(LEGACY_KEY) ?? '', 'handbook-legacy-state.json')}>Save original legacy state</button></main>;
  const pack = route.courseId ? snapshot.packs.find(pack => pack.id === route.courseId) : snapshot.packs[0];
  const progress = pack ? snapshot.progress.find(progress => progress.courseId === pack.id) ?? emptyProgress(pack.id) : undefined;
  const chapter = pack?.chapters.find(chapter => chapter.id === route.chapterId) ?? pack?.chapters[0];
  const requiresCourse = ['course', 'weekly', 'chapter', 'focus', 'syllabus', 'vocabulary', 'practice', 'recall', 'notes', 'sources', 'edit'].includes(route.page);
  const missingRoute = (requiresCourse && !pack) || (route.chapterId && ['chapter', 'focus'].includes(route.page) && !pack?.chapters.some(chapter => chapter.id === route.chapterId));
  const mutate: Mutate = async update => {
    if (!pack) throw new Error('Choose an installed course before saving course progress.');
    await mutateFor(pack.id)(update);
  };
  const focus = route.page === 'focus' && !!pack;
  const activeStudy = focus || snapshot.progress.some(progress => progress.active?.mode === 'mock');
  const activateUpdate = () => {
    if (routeRef.current.page === 'focus' || latest.current.progress.some(progress => progress.active?.mode === 'mock') || pendingDraft.current.size) {
      setNotice('Save and stop your current study session before updating.'); return;
    }
    reloadRequested.current = true;
    if (update?.waiting) update.waiting.postMessage({ type: 'ACTIVATE_UPDATE' });
    else location.reload();
  };
  const nav = [['course', 'Chapters'], ['weekly', 'Weekly notes'], ['syllabus', 'Syllabus'], ['vocabulary', 'Vocabulary'], ['practice', 'Practice'], ['recall', 'Recall'], ['notes', 'Notebook'], ['sources', 'Sources']] as const;
  const coursePage = nav.some(([page]) => page === route.page) || ['chapter', 'edit'].includes(route.page);
  const courseTab = ['chapter', 'edit'].includes(route.page) ? 'course' : route.page;
  const libraryPage = route.page === 'library' || coursePage;
  const blockPosition = chapter && progress ? Math.min(progress.focusPositions[chapter.id] ?? 0, chapter.blocks.length - 1) : 0;
  const currentBlock = chapter?.blocks[blockPosition];
  const unresolvedFocus = focus && progress?.anchorWarnings.some(warning => warning.kind === 'focus' && warning.chapterId === chapter?.id);
  const week = pack?.syllabus.weeks.find(week => week.id === route.chapterId);
  async function saveLocation(mode: 'chapter' | 'focus', position = blockPosition) {
    if (!chapter) throw new Error('Choose a chapter before saving a reading position.');
    await mutate(latest => ({ ...latest, focusPositions: { ...latest.focusPositions, [chapter.id]: position }, last: { chapterId: chapter.id, mode, blockId: chapter.blocks[position]?.id ?? null } }));
  }
  const blockProps = (block: Block) => {
    if (!pack || !progress) throw new Error('Choose an installed course before reading its content.');
    return {
    block, pack, library, onError, onConcept: setConcept,
    position: progress.diagramPositions[block.id] ?? 0,
    onPosition: (index: number) => void mutate(latest => ({ ...latest, diagramPositions: { ...latest.diagramPositions, [block.id]: index } })).catch(onError),
    revealed: progress.revealed[block.id] ?? false,
    continuous: route.page === 'weekly' || route.page === 'chapter',
    onReveal: () => void mutate(latest => ({ ...latest, revealed: { ...latest.revealed, [block.id]: !latest.revealed[block.id] } })).catch(onError),
    };
  };
  const note = (key: string) => {
    if (!pack || !progress) throw new Error('Choose an installed course before editing its notes.');
    return <NoteEditor key={`${pack.id}:${key}`} noteKey={key} progress={progress} registerDraft={registerDraft} onError={onError} onSave={async update => {
    await mutate(latest => ({ ...latest, notes: { ...latest.notes, [key]: update.notes[key] }, noteHighlights: { ...latest.noteHighlights, [key]: update.noteHighlights[key] } }));
    }}/>;
  };
  const openConcept = pack?.concepts.find(item => item.id === concept);
  const alert = <>{error && <div className="error banner" role="alert"><p>{error}</p><button onClick={() => setError('')}>Dismiss message</button></div>}{notice && <div className="notice banner" role="status"><p>{notice}</p><button onClick={() => setNotice('')}>Dismiss</button></div>}{externalChange && <div className="warning banner" role="status"><p>Another tab saved changes. Reload local data before your next edit; unsaved text remains visible.</p><button onClick={() => void refresh().catch(onError)}>Reload local data</button></div>}{update && <div className="notice banner"><p>{activeStudy ? 'An update is ready. Finish or save and stop before updating.' : 'A new Handbook version is ready. Your local courses and notes will remain.'}</p><button disabled={activeStudy || pendingDraft.current.size > 0} onClick={activateUpdate}>Update and reload</button></div>}</>;
  return <div className={focus ? 'app focus-mode' : 'app'}>
    <a className="skip" href="#main-content">Skip to content</a>
    {!focus && <><aside className="rail"><Link page="library" className="rail-brand"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M3 7h11v23H3" fill="#a9b8f7"/><path d="M18 3h11v23H18" fill="#d5efdf"/></svg>Handbook</Link><nav aria-label="Library"><Link page="library" current={route.page === 'library'} className={libraryPage ? 'active' : ''}>Course library</Link><Link page="import" current={route.page === 'import'} className={route.page === 'import' ? 'active' : ''}>Import course</Link><Link page="settings" current={route.page === 'settings'} className={route.page === 'settings' ? 'active' : ''}>Settings & backups</Link></nav><div className="rail-foot"><p>One thought at a time.<br/>Your notes stay here.</p></div></aside>
      <header className="masthead"><label className="search-label"><span>Search handbooks</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="A concept, chapter, or question"/></label><label className="theme-label"><span>Appearance</span><select aria-label="Appearance" value={theme} onChange={event => setTheme(event.target.value)}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label></header>
      <nav className="mobile-nav" aria-label="Mobile navigation"><Link page="library" current={route.page === 'library'} className={libraryPage ? 'active' : ''}>Library</Link><Link page="import" current={route.page === 'import'}>Import course</Link><Link page="settings" current={route.page === 'settings'}>Settings</Link></nav></>}
    <main id="main-content" tabIndex={-1} className={focus ? 'focus-paper' : 'workspace'}>{alert}
      {!focus && coursePage && pack && !missingRoute && !query.trim() && <div className="course-context" aria-label="Current course">
        <div className="course-context-heading"><Link page="course" courseId={pack.id}>{pack.metadata.title}</Link><Link page="library">Change course</Link></div>
        <nav className="course-tabs" aria-label="Course">{nav.map(([page, label]) => <Link key={page} page={page} courseId={pack.id} current={courseTab === page}>{label}</Link>)}</nav>
        <details className="mobile-tools"><summary>Course tools</summary><nav aria-label="Mobile course tools">{nav.map(([page, label]) => <Link key={page} page={page} courseId={pack.id} current={courseTab === page}>{label}</Link>)}</nav></details>
      </div>}
      {query.trim() ? <section className="paper"><h1>Search results</h1>{snapshot.packs.flatMap(course => course.chapters.filter(chapter => `${chapter.title} ${chapter.summary} ${JSON.stringify(chapter.blocks)}`.toLowerCase().includes(query.toLowerCase())).map(chapter => <article key={`${course.id}:${chapter.id}`} className="search-result"><h2><Link page="chapter" courseId={course.id} chapterId={chapter.id}>{chapter.title}</Link></h2><p>{course.metadata.title} — {chapter.summary}</p></article>))}{snapshot.packs.flatMap(course => course.concepts.filter(concept => `${concept.term} ${concept.aliases.join(' ')} ${concept.definition}`.toLowerCase().includes(query.toLowerCase())).map(concept => <article className="search-result" key={`${course.id}:${concept.id}`}><h2><Link page="vocabulary" courseId={course.id}>{concept.term}</Link></h2><p>{concept.definition}</p></article>))}</section> : missingRoute ? <section className="paper"><h1>Saved course or chapter is unavailable</h1><p>This link does not match an installed course. No replacement chapter was guessed.</p><Link page="library">Choose a course deliberately</Link></section> : <>
      {route.page === 'library' && !pack && <Onboarding onImport={() => void go('import')}/>}
      {route.page === 'library' && pack && progress && <><section className="resume-folio"><div><h1>Make room for understanding.</h1><p className="lead">A course is more than a pile of material. Open its vocabulary, trace an idea, and keep the next thought.</p>{latestResume(snapshot.progress) ? (() => {
        const saved = latestResume(snapshot.progress)!;
        const course = snapshot.packs.find(pack => pack.id === saved.courseId);
        if (!course) return null;
        const chapter = course.chapters.find(chapter => chapter.id === saved.last!.chapterId);
        return chapter ? <><p className="resume-label">Saved in {course.metadata.title}<br/><strong>{chapter.title}</strong></p><Link className="button primary" page={saved.last!.mode} courseId={course.id} chapterId={chapter.id}>Continue where I stopped</Link></> : null;
      })() : <Link className="button primary" page="course" courseId={pack.id}>Open {pack.metadata.title}</Link>}</div><div className="hero-volume"><Cover kind="cube"/><span>Knowledge<br/>takes shape.</span></div></section>
        <div className="shelf-heading"><h2>Your course shelf</h2><Link page="import" className="button">Import course</Link></div><div className="course-shelf">{snapshot.packs.map(course => <article className="course-volume" key={course.id}><div className={`book-object ${course.metadata.cover}`}><Cover kind={course.metadata.cover}/></div><div className="volume-copy"><h3><Link page="course" courseId={course.id}>{course.metadata.title}</Link></h3><p className="small muted">{course.metadata.subtitle}</p><p>{course.metadata.description}</p><Link className="button" page="course" courseId={course.id}>Open handbook</Link></div></article>)}</div></>}
      {route.page === 'import' && <section className="paper"><ImportCourse packs={snapshot.packs} candidate={candidate} onCandidate={setCandidate} onCancel={() => { setCandidate(null); void go('library'); }} onInstall={async () => { if (!candidate) return; await library.install(candidate, snapshot.revision); await refresh(); setCandidate(null); setNotice('Course installed locally. No source files or personal answers were uploaded.'); void go('course', candidate.id); }}/></section>}
      {pack && progress && <>
      {route.page === 'course' && pack.syllabus.weeks.length > 0 && <div className="button-row"><Link className="button primary" page="weekly" courseId={pack.id}>Read weekly course notes</Link></div>}
      {route.page === 'course' && pack && <section className="paper"><p className="breadcrumb"><Link page="library">Handbook</Link> / {pack.metadata.subtitle}</p><h1>{pack.metadata.title}</h1><p className="lead">{pack.metadata.description}</p><div className="button-row"><Link className="button primary" page="focus" courseId={pack.id} chapterId={progress.last?.chapterId ?? pack.chapters[0].id}>Start / resume Focus</Link><button onClick={() => download(pack, `${pack.id}.course.json`)}>Export course JSON</button><Link className="button" page="edit" courseId={pack.id}>Edit course details</Link><Link className="button" page="syllabus" courseId={pack.id}>See syllabus</Link></div><CoverageDetails pack={pack}/><ol className="chapter-list">{pack.chapters.map(chapter => <li key={chapter.id}><span className="chapter-number">{String(chapter.number).padStart(2, '0')}</span><div><h2><Link page="chapter" courseId={pack.id} chapterId={chapter.id}>{chapter.title}</Link></h2><p>{chapter.summary}</p></div><button aria-label={`${progress.bookmarks[chapter.id] ? 'Remove bookmark from' : 'Bookmark'} ${chapter.title}`} aria-pressed={progress.bookmarks[chapter.id] ?? false} onClick={() => void mutate(latest => ({ ...latest, bookmarks: { ...latest.bookmarks, [chapter.id]: !latest.bookmarks[chapter.id] } })).catch(onError)}>{progress.bookmarks[chapter.id] ? 'Saved' : 'Save'}</button></li>)}</ol></section>}
      {route.page === 'weekly' && pack && <section className="paper reader weekly-reader"><h1>Weekly course notes</h1><details open={!week}><summary>Choose a week</summary><nav aria-label="Choose a week"><ol className="week-index">{pack.syllabus.weeks.map(item => <li key={item.id}><Link page="weekly" courseId={pack.id} chapterId={item.id}>Week {item.number}: {item.title}</Link></li>)}</ol></nav></details>{route.chapterId && !week ? <p role="alert">This week is not in the installed course. Choose a week above; no replacement week was guessed.</p> : week && <article aria-label={`Week ${week.number} notes`}><h2>Week {week.number}: {week.title}</h2><p className="lead">{week.notes.split(/\n\s*\n/)[0]}</p>{week.chapterIds.map(id => {
        const chapter = pack.chapters.find(chapter => chapter.id === id)!;
        return <section className="weekly-lesson" key={id}><h2>Lesson {chapter.number}: {chapter.title}</h2><div className="button-row"><Link page="chapter" courseId={pack.id} chapterId={id}>Chapter reader & private notes</Link><Link page="focus" courseId={pack.id} chapterId={id}>Focus</Link></div>{chapter.blocks.filter(block => block.kind !== 'recall').map(block => <ContentBlock key={block.id} {...blockProps(block)}/>)}{chapter.blocks.some(block => block.kind === 'recall') && <details><summary>Optional recall</summary>{chapter.blocks.filter(block => block.kind === 'recall').map(block => <ContentBlock key={block.id} {...blockProps(block)}/>)}</details>}</section>;
      })}<section className="week-synthesis"><h2>What this week adds</h2>{week.notes.split(/\n\s*\n/).slice(1).map((paragraph, i) => <p key={i}>{paragraph}</p>)}</section><details><summary>Schedule and assessed work</summary><p>Follow current official instructions; these notes do not provide assessed-work solutions.</p><ul>{week.assessmentIds.map(id => <li key={id}>{pack.syllabus.assessments.find(assessment => assessment.id === id)?.title}</li>)}</ul><Link page="syllabus" courseId={pack.id}>Open syllabus & deadlines</Link></details><nav className="button-row" aria-label="Adjacent weeks">{pack.syllabus.weeks.filter(item => Math.abs(item.number - week.number) === 1).map(item => <Link key={item.id} className="button" page="weekly" courseId={pack.id} chapterId={item.id}>{item.number < week.number ? 'Previous' : 'Next'}: Week {item.number}</Link>)}</nav></article>}</section>}
      {unresolvedFocus && pack && chapter && <section><h1>Choose a new study anchor</h1><p>The saved block in {chapter.title} was removed or moved. Your old anchor remains in the private notebook; no numeric position is being treated as a match.</p><button onClick={() => void mutate(latest => ({ ...latest, focusPositions: { ...latest.focusPositions, [chapter.id]: 0 }, last: { chapterId: chapter.id, mode: 'focus', blockId: chapter.blocks[0].id }, anchorWarnings: latest.anchorWarnings.filter(warning => warning.kind !== 'focus' || warning.chapterId !== chapter.id) })).catch(onError)}>Start this chapter from its beginning</button><button onClick={() => void go('notes', pack.id)}>Review preserved anchors</button></section>}
      {(route.page === 'chapter' || focus) && pack && chapter && currentBlock && !unresolvedFocus && <section className={focus ? '' : 'paper reader'}><div className="reader-heading"><div><p className="breadcrumb">{pack.metadata.courseCode ?? pack.metadata.title} / Lesson {chapter.number}</p><h1>{chapter.title}</h1>{!focus && <p>{chapter.summary}</p>}</div><div className="button-row">{focus ? <button onClick={() => void (async () => { for (const save of pendingDraft.current.values()) await save(); pendingDraft.current.clear(); await saveLocation('focus'); await go('course', pack.id); })().catch(onError)}>Save & stop</button> : <button className="primary" onClick={() => void (async () => { await saveLocation('focus'); await go('focus', pack.id, chapter.id); })().catch(onError)}>Study one step</button>}</div></div>
        {focus ? <><div className="focus-context"><span>Step {blockPosition + 1} / {chapter.blocks.length}</span><span>Untimed by default</span>{snapshot.profile.studyTimers && <FocusClock/>}</div>{snapshot.profile.depth === 'introductory' && blockPosition === 0 && <aside className="callout"><h3>A starting point</h3><p>Read one explanation, name its inputs and assumptions, then say why the next step follows. Open a linked term if its meaning is unclear.</p></aside>}<ContentBlock {...blockProps(currentBlock)}/><div className="button-row focus-controls"><button disabled={blockPosition === 0} onClick={() => void saveLocation('focus', blockPosition - 1).catch(onError)}>Previous step</button><button className="primary" disabled={blockPosition === chapter.blocks.length - 1} onClick={() => void saveLocation('focus', blockPosition + 1).catch(onError)}>Next step</button><button onClick={() => void go('chapter', pack.id, chapter.id)}>Read whole chapter</button></div>{blockPosition === chapter.blocks.length - 1 && <p className="notice">You reached the end of this chapter. Save & stop, or return to the course when ready.</p>}<details className="optional-notes"><summary>Park a thought (optional)</summary>{note('parking')}</details></> : <><div className="outcomes"><h2>Understand and use</h2>{chapter.outcomeIds.map(id => {
          const outcome = pack.syllabus.outcomes.find(outcome => outcome.id === id);
          return <label key={id} className="inline"><input type="checkbox" checked={progress.checks[id] ?? false} onChange={event => { const checked = event.target.checked; void mutate(latest => ({ ...latest, checks: { ...latest.checks, [id]: checked } })).catch(onError); }}/>{outcome?.text}</label>;
        })}</div>{chapter.blocks.map(block => <div key={block.id}><ContentBlock {...blockProps(block)}/><div className="block-tools"><button aria-label="Save selected quote or bookmark this block" title="Save selected quote or bookmark this block" onClick={() => {
          const selection = window.getSelection();
          const root = document.getElementById(block.id);
          const selected = selection?.anchorNode && selection.focusNode && root?.contains(selection.anchorNode) && root.contains(selection.focusNode) ? selection.toString().trim() : '';
          const annotation: Annotation = { id: `annotation-${crypto.randomUUID()}`, chapterId: chapter.id, blockId: block.id, quote: selected.slice(0, 20000), note: '', status: 'current', createdAt: Date.now() };
          void mutate(latest => ({ ...latest, annotations: [...latest.annotations, annotation] })).then(() => setNotice(selected ? 'Selected text saved to your private notebook.' : 'Block bookmarked in your private notebook. Select text first to save a quote.')).catch(onError);
        }}><UtilityIcon name="quote"/></button><button aria-label="Resume from this block next time" title="Resume from this block next time" onClick={() => void saveLocation('chapter', chapter.blocks.indexOf(block)).then(() => setNotice('Reading position saved.')).catch(onError)}><UtilityIcon name="resume"/></button></div></div>)}{note(`chapter:${chapter.id}`)}<div className="button-row"><Link className="button" page="practice" courseId={pack.id}>Practice this course</Link><Link className="button" page="course" courseId={pack.id}>Back to chapters</Link></div></>}
      </section>}
      {route.page === 'syllabus' && <section className="paper"><h1>Syllabus & schedule</h1><p>Deadlines show your device timezone. The declared official timezone remains visible. Follow current official instructions for assessed work.</p><h2>Assessment scope</h2>{pack.syllabus.assessments.map(assessment => <article id={assessment.id} className="assessment" key={assessment.id}><h3>{assessment.title}</h3><p><time dateTime={assessment.dueAt}>{new Date(assessment.dueAt).toLocaleString(undefined, { timeZoneName: 'short' })}</time><br/><span className="small muted">Official: {assessment.dueAt} ({assessment.timezone})</span></p><p>{assessment.description}</p><p>Lessons: {assessment.chapterIds.map(id => pack.chapters.find(chapter => chapter.id === id)?.number).join(', ') || 'No lesson scope declared'}</p><CitationList citations={assessment.citations} pack={pack} library={library} onError={onError}/>{assessment.mock && <Link className="button" page="practice" courseId={pack.id}>Open original practice mocks</Link>}</article>)}<h2>Weekly learning path</h2>{pack.syllabus.weeks.map(week => <article id={week.id} className="week" key={week.id}><h3>Week {week.number}: {week.title}</h3><p>{week.notes}</p><div className="button-row">{week.chapterIds.map(id => <Link key={id} page="chapter" courseId={pack.id} chapterId={id}>{pack.chapters.find(chapter => chapter.id === id)?.title}</Link>)}</div><ul>{week.assessmentIds.map(id => <li key={id}><a href={`#${id}`}>{pack.syllabus.assessments.find(assessment => assessment.id === id)?.title}</a></li>)}</ul></article>)}<h2>Policies</h2>{pack.syllabus.policies.map(policy => <section className="callout" key={policy.id}><h3>{policy.title}</h3><p>{policy.text}</p><CitationList citations={policy.citations} pack={pack} library={library} onError={onError}/></section>)}</section>}
      {route.page === 'vocabulary' && <section className="paper"><h1>Vocabulary & source crosswalk</h1><p className="lead">Use the course's language, then follow it back to the reading. Canonical terms are also linked inside each chapter.</p>{pack.concepts.map(concept => <article className="concept-entry" id={concept.id} key={concept.id}><h2>{concept.term}</h2>{concept.aliases.length > 0 && <p className="small muted">Also called: {concept.aliases.join(', ')}</p>}{concept.notation && <p><code>{concept.notation}</code></p>}<p>{concept.definition}</p><p className="small">Prerequisites: {concept.prerequisiteIds.map(id => pack.concepts.find(concept => concept.id === id)?.term).join(', ') || 'None declared'}. Contrast: {concept.contrastIds.map(id => pack.concepts.find(concept => concept.id === id)?.term).join(', ') || 'None declared'}.</p><div className="button-row">{pack.chapters.filter(chapter => chapter.blocks.some(block => block.conceptIds.includes(concept.id))).map(chapter => <Link key={chapter.id} page="chapter" courseId={pack.id} chapterId={chapter.id}>Lesson {chapter.number}</Link>)}</div><CitationList citations={concept.citations} pack={pack} library={library} onError={onError}/></article>)}</section>}
      {route.page === 'practice' && <section className="paper"><Practice pack={pack} progress={progress} mutate={mutate} onError={onError} selectedAssessment={route.detail}/></section>}
      {route.page === 'recall' && <section className="paper"><h1>Retrieve, then compare</h1><p>No countdown or streak. Try an answer before revealing the explanation. Ratings schedule a later revisit; skip does not pretend success.</p>{pack.chapters.flatMap(chapter => chapter.blocks.filter(block => block.kind === 'recall').map(block => ({ chapter, block }))).filter(({ block }) => (progress.recall[block.id]?.due ?? 0) <= Date.now()).slice(0, 10).map(({ chapter, block }) => <article key={block.id}><h2>{chapter.title}</h2><ContentBlock {...blockProps(block)}/>{progress.revealed[block.id] && <div className="button-row">{(['again', 'hard', 'good', 'easy'] as const).map((rating, i) => <button key={rating} onClick={() => void mutate(latest => ({ ...latest, recall: { ...latest.recall, [block.id]: { rating, stage: Math.min(4, Math.max(0, (latest.recall[block.id]?.stage ?? 0) + (i > 1 ? 1 : -1))), due: Date.now() + [0.1, 1, 3, 7][i] * 86400000 } }, revealed: { ...latest.revealed, [block.id]: false } })).catch(onError)}>{rating}</button>)}</div>}</article>)}<p className="small muted">Up to ten due prompts shown. No due prompts means you can return to a chapter for open review.</p></section>}
      {route.page === 'notes' && <section className="paper"><h1>Your private notebook</h1><p>Notes, quotes, highlights and bookmarks never enter a shared course export.</p>{note('scratch')}<h2>Saved quotes & anchors</h2>{progress.anchorWarnings.map((warning, i) => <div className="warning" key={i}><p>{warning.chapterId} / {warning.blockId ?? 'chapter'}: {warning.message}</p>{pack.chapters.some(chapter => chapter.id === warning.chapterId) && <Link page="chapter" courseId={pack.id} chapterId={warning.chapterId}>Review this chapter</Link>}</div>)}{progress.annotations.map(annotation => <AnnotationEditor key={annotation.id} annotation={annotation} pack={pack} mutate={mutate} onError={onError} registerDraft={registerDraft}/>)}{!progress.annotations.length && <p className="muted">Select a passage in the reader and use its quote/bookmark utility. The neighboring resume utility saves your exact reading location.</p>}<h2>Course notes</h2>{Object.keys(progress.notes).filter(key => key !== 'scratch').map(key => <details key={key}><summary>{key}</summary>{note(key)}</details>)}<h2>Bookmarks</h2>{Object.entries(progress.bookmarks).filter(([, marked]) => marked).map(([id]) => <p key={id}><Link page="chapter" courseId={pack.id} chapterId={id}>{pack.chapters.find(chapter => chapter.id === id)?.title ?? `${id} (removed from current course)`}</Link></p>)}<button onClick={() => download(Object.entries(progress.notes).map(([key, text]) => `${key}\n${text}`).join('\n\n'), `${pack.id}-private-notes.txt`, 'text/plain')}>Export private notes as text</button></section>}
      {route.page === 'sources' && <section className="paper"><h1>Sources & coverage</h1><CoverageDetails pack={pack}/>{pack.sources.map(source => <SourceCard key={source.id} source={source} pack={pack} library={library} onError={onError} onNotice={setNotice}/>)}<h2>Source rights</h2><p>{pack.provenance.sourceRights}</p><p>Course explanations: {pack.provenance.contentLicense}. Source material retains its own rights. An attached PDF is private, not included in course or backup exports.</p></section>}
      {route.page === 'edit' && <section className="paper"><EditCourse pack={pack} onPreview={updated => { setCandidate(updated); void go('import'); }}/></section>}
      </>}
      {route.page === 'settings' && <section className="paper"><h1>Settings & private backups</h1><ProfileEditor profile={snapshot.profile} onSave={async profile => { await library.saveProfile(profile, snapshot.revision); await refresh(); setNotice('Private learner preferences saved.'); }} onError={onError}/><h2>Backups that travel</h2><p>A course JSON contains course content. A private backup also includes your learner profile, notes, answers and history. Keep it private. Local PDFs are excluded; reattach them on the destination browser.</p><div className="button-row"><button onClick={() => void library.privateBackup().then(backup => download(backup, 'handbook-private-backup.json')).catch(onError)}>Export private backup</button><button onClick={() => void library.legacyBackup().then(backup => { if (backup) download(backup, 'handbook-legacy-backup.json'); else setNotice('No legacy state has been migrated in this browser.'); }).catch(onError)}>Export preserved legacy state</button></div><RestoreBackup library={library} revision={snapshot.revision} onRestored={refresh} onError={onError}/><h2>Migration & portability</h2>{snapshot.warnings.map((warning, i) => <p className="warning" key={i}>{warning}</p>)}<p>Courses already installed in this browser remain here. New libraries start empty; no personal course is fetched or installed automatically. Legacy localStorage is never deleted automatically.</p><p>Browser storage can be cleared or evicted. Export a private backup before changing browsers or devices; there is no automatic sync.</p><p><a href="https://github.com/fatmali/handbook">Open-source code and documentation</a> · <a href={`${import.meta.env.BASE_URL}downloads/handbook-course-builder.zip`}>Portable course-builder skill</a></p></section>}
      {!['library', 'import', 'course', 'chapter', 'focus', 'weekly', 'syllabus', 'vocabulary', 'practice', 'recall', 'notes', 'sources', 'settings', 'edit'].includes(route.page) && <section className="paper"><h1>This link has moved</h1><p>The library and your saved data are still available.</p><Link page="library">Open course library</Link></section>}
      {route.page === 'settings' && <section className="paper course-backup"><CourseBackup library={library} packs={snapshot.packs} onError={onError}/></section>}
      </>}
      {pack && openConcept && <aside className="concept-panel" aria-label={`Definition: ${openConcept.term}`}><button className="close-panel" onClick={() => setConcept(null)}>Close definition</button><h2>{openConcept.term}</h2><p>{openConcept.definition}</p>{openConcept.notation && <code>{openConcept.notation}</code>}<CitationList citations={openConcept.citations} pack={pack} library={library} onError={onError}/><Link page="vocabulary" courseId={pack.id}>Open source crosswalk</Link></aside>}
    </main>
  </div>;
}
function FocusClock() {
  const [start] = useState(Date.now); const [now, setNow] = useState(Date.now);
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  return <span>Optional elapsed time: {Math.floor((now - start) / 60000)} min (this visit only)</span>;
}
function EditCourse({ pack, onPreview }: { pack: CoursePack; onPreview: (pack: CoursePack) => void }) {
  const [title, setTitle] = useState(pack.metadata.title); const [description, setDescription] = useState(pack.metadata.description);
  const [level, setLevel] = useState(pack.metadata.educationLevel);
  return <form onSubmit={event => { event.preventDefault(); onPreview({ ...pack, contentRevision: pack.contentRevision + 1, metadata: { ...pack.metadata, title, description, educationLevel: level, levelInference: { ...pack.metadata.levelInference, confirmed: true, evidence: [...pack.metadata.levelInference.evidence.slice(0, 19), 'Course level explicitly confirmed or overridden in the course editor.'] }, updatedAt: new Date().toISOString() } }); }}><h1>Edit course details</h1><label>Course title<input required maxLength={300} value={title} onChange={event => setTitle(event.target.value)}/></label><label>Description<textarea required maxLength={20000} value={description} onChange={event => setDescription(event.target.value)}/></label><label>Confirm or override course level<select value={level} onChange={event => { const value = event.target.value; if (value === 'middle-school' || value === 'high-school' || value === 'bachelors' || value === 'masters' || value === 'other' || value === 'unknown') setLevel(value); }}>{['middle-school', 'high-school', 'bachelors', 'masters', 'other', 'unknown'].map(value => <option key={value} value={value}>{value}</option>)}</select></label><p className="small muted">Source evidence: {pack.metadata.levelInference.evidence.join(' ') || 'None declared'}. Course level does not determine age, ability, or preferred explanation depth.</p><p>Content changes are agent-led: export this course, retain stable IDs, revise the explanations and sources, then import the new revision. Details edited here use the same update preview.</p><button className="primary" type="submit">Preview updated course</button></form>;
}
function AnnotationEditor({ annotation, pack, mutate, onError, registerDraft }: { annotation: Annotation; pack: CoursePack; mutate: Mutate; onError: (error: unknown) => void; registerDraft: (key: string, save: (() => Promise<void>) | null) => void }) {
  const [note, setNote] = useState(annotation.note);
  const [anchor, setAnchor] = useState(`${annotation.chapterId}:${annotation.blockId ?? ''}`);
  const [reviewed, setReviewed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  async function save() {
    const [chapterId, blockId] = anchor.split(':');
    const valid = pack.chapters.some(chapter => chapter.id === chapterId && chapter.blocks.some(block => block.id === blockId));
    if (reviewed && !valid) throw new Error('Choose an existing block before confirming the anchor.');
    setSaving(true); setSaved(false);
    try {
      await mutate(latest => ({ ...latest, annotations: latest.annotations.map(value => value.id === annotation.id ? { ...value, note, ...(anchor !== `${annotation.chapterId}:${annotation.blockId ?? ''}` || reviewed ? { chapterId, blockId, status: valid ? 'current' as const : 'orphaned' as const } : {}) } : value) }));
      setSaved(true);
    } finally { setSaving(false); }
  }
  useEffect(() => {
    const key = `${pack.id}:annotation:${annotation.id}`;
    const dirty = note !== annotation.note || anchor !== `${annotation.chapterId}:${annotation.blockId ?? ''}` || (reviewed && annotation.status !== 'current');
    registerDraft(key, dirty ? save : null);
    return () => registerDraft(key, null);
  });
  return <article className="annotation"><p className={annotation.status === 'current' ? 'small muted' : 'warning'}>{annotation.status === 'current' ? 'Current anchor' : annotation.status === 'changed' ? 'Anchor content changed. Review before reattaching.' : 'Original anchor removed. Quote and note are preserved.'} — {annotation.chapterId}</p>{annotation.quote && <blockquote><mark>{annotation.quote}</mark></blockquote>}<label>Note about this passage<textarea value={note} maxLength={20000} onChange={event => { setNote(event.target.value); setSaved(false); }}/></label><label>Reattach deliberately<select value={anchor} onChange={event => setAnchor(event.target.value)}><option value={`${annotation.chapterId}:${annotation.blockId ?? ''}`}>Keep original anchor</option>{pack.chapters.flatMap(chapter => chapter.blocks.map(block => <option key={block.id} value={`${chapter.id}:${block.id}`}>{chapter.title} / {block.id}</option>))}</select></label>{annotation.status !== 'current' && <label className="inline"><input type="checkbox" checked={reviewed} onChange={event => setReviewed(event.target.checked)}/>I reviewed the selected anchor and want to mark it current</label>}<div className="button-row"><button disabled={saving} onClick={() => void save().catch(onError)}>{saving ? 'Saving annotation…' : 'Save annotation'}</button><button onClick={() => void mutate(latest => ({ ...latest, annotations: latest.annotations.filter(value => value.id !== annotation.id) })).catch(onError)}>Remove annotation</button></div>{saved && <p className="small muted" role="status">Annotation saved locally.</p>}</article>;
}
function SourceCard({ source, pack, library, onError, onNotice }: { source: CoursePack['sources'][number]; pack: CoursePack; library: Library; onError: (error: unknown) => void; onNotice: (notice: string) => void }) {
  const [attached, setAttached] = useState<{ name: string; fingerprint: string } | null>(null);
  useEffect(() => { void library.getSource(pack.id, source.id).then(asset => setAttached(asset ? { name: asset.name, fingerprint: asset.fingerprint } : null)).catch(onError); }, [pack.id, source.id, library, onError]);
  return <article className="source-card"><h2>{source.title}</h2><p>{source.author}, {source.edition}. {source.pageCount ? `${source.pageCount} PDF pages.` : ''} {source.verification}.</p><p>{source.rights}</p>{source.url && <a href={source.url} target="_blank" rel="noopener noreferrer">Open official source</a>}
    {source.kind !== 'original' && <><p className="small muted">Optionally attach your own matching PDF. Confirm the edition and page numbering yourself. It stays in IndexedDB on this device; no upload or redistribution.</p><label className="file-label">Attach matching local PDF<input type="file" accept=".pdf,application/pdf" onChange={event => { const file = event.target.files?.[0]; if (file) void library.bindSource(pack, source.id, file).then(fingerprint => { setAttached({ name: file.name, fingerprint }); onNotice('PDF attached locally. Citation links can open it offline.'); }).catch(onError); }}/></label>{attached && <><p className="small">Attached: {attached.name}<br/>SHA-256: <code>{attached.fingerprint}</code></p><button onClick={() => void library.removeSource(pack.id, source.id).then(() => setAttached(null)).catch(onError)}>Detach local PDF</button></>}</>}
  </article>;
}
function ProfileEditor({ profile, onSave, onError }: { profile: PrivateProfile; onSave: (profile: PrivateProfile) => Promise<void>; onError: (error: unknown) => void }) {
  const [draft, setDraft] = useState(profile);
  return <form onSubmit={event => { event.preventDefault(); void onSave(privateProfileSchema.parse(draft)).catch(onError); }}><h2>Optional private learner profile</h2><p>No birthdate, account, name, or diagnosis is needed. Age does not determine your course level or ability. These answers never enter a shared course export.</p><label>Age band (optional)<select value={draft.ageBand} onChange={event => setDraft(privateProfileSchema.parse({ ...draft, ageBand: event.target.value }))}>{['prefer-not-to-say', 'under-13', '13-15', '16-17', '18-24', '25-plus'].map(band => <option key={band} value={band}>{band === 'prefer-not-to-say' ? 'Prefer not to say' : band}</option>)}</select></label>{(['goals', 'priorKnowledge', 'scaffolding'] as const).map(key => <label key={key}>{key === 'goals' ? 'What do you want to understand or do?' : key === 'priorKnowledge' ? 'Prior knowledge' : 'Scaffolding or accessibility needs (no diagnosis required)'}<textarea maxLength={2000} value={draft[key]} onChange={event => setDraft({ ...draft, [key]: event.target.value })}/></label>)}<label>Preferred explanation depth<select value={draft.depth} onChange={event => setDraft(privateProfileSchema.parse({ ...draft, depth: event.target.value }))}><option value="introductory">Introductory</option><option value="standard">Standard</option><option value="deep">Deep</option></select></label><label className="inline"><input type="checkbox" checked={draft.studyTimers} onChange={event => setDraft({ ...draft, studyTimers: event.target.checked })}/>Show optional elapsed time in Focus (off by default; no break cues)</label><p className="small muted">Preferences inform your agent's scaffolding; Handbook does not infer a fixed “learning style” or claim automatic personalization. Elapsed time is for the current visit only, not a persistent time log.</p><button className="primary" type="submit">Save private preferences</button></form>;
}
function RestoreBackup({ library, revision, onRestored, onError }: { library: Library; revision: number; onRestored: () => Promise<void>; onError: (error: unknown) => void }) {
  const [raw, setRaw] = useState<string | null>(null);
  return <section className="restore"><label className="file-label">Choose private backup to restore<input type="file" accept=".json,application/json" onChange={event => { const file = event.target.files?.[0]; if (file) { if (file.size > 64_000_000) { onError(new Error('Backup exceeds 64 MB.')); return; } void file.text().then(setRaw).catch(onError); } }}/></label>{raw && <div className="warning"><p>Replace restores the entire library/profile. Merge preserves other courses and your current profile, but replaces matching courses and their private progress. Back up first. Local PDFs for restored courses are detached. Invalid files make no changes.</p><button onClick={() => void library.restore(raw, revision).then(onRestored).then(() => setRaw(null)).catch(onError)}>Confirm replace from private backup</button><button onClick={() => void library.restore(raw, revision, 'merge').then(onRestored).then(() => setRaw(null)).catch(onError)}>Confirm merge private course backups</button><button onClick={() => setRaw(null)}>Cancel restore</button></div>}</section>;
}
function CourseBackup({ library, packs, onError }: { library: Library; packs: CoursePack[]; onError: (error: unknown) => void }) {
  const [courseId, setCourseId] = useState(packs[0]?.id ?? '');
  if (!packs.length) return <><h2>Separate private course backups</h2><p>Import a course before exporting a per-course backup. You can still back up this empty library and its private preferences above.</p></>;
  const selected = packs.some(pack => pack.id === courseId) ? courseId : packs[0].id;
  return <><h2>Separate private course backups</h2><p>For a library above the 64 MB whole-backup limit, export each course separately, then merge those backups on the destination browser. Each file contains that course's notes/history and the private profile; keep it private.</p><label>Course to back up<select value={selected} onChange={event => setCourseId(event.target.value)}>{packs.map(pack => <option value={pack.id} key={pack.id}>{pack.metadata.title}</option>)}</select></label><button onClick={() => void library.privateBackup(selected).then(backup => download(backup, `${selected}-private-backup.json`)).catch(onError)}>Export selected private course backup</button></>;
}
