import { useEffect, useRef, useState } from 'react';
import { adjustNoteHighlights, type Progress } from '../domain';

export function NoteEditor({ noteKey, progress, onSave, onError, registerDraft }: { noteKey: string; progress: Progress; onSave: (update: Progress) => Promise<void>; onError: (error: unknown) => void; registerDraft: (key: string, save: (() => Promise<void>) | null) => void }) {
  const saved = progress.notes[noteKey] ?? '';
  const [text, setText] = useState(saved);
  const [ranges, setRanges] = useState(progress.noteHighlights[noteKey] ?? []);
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  async function save() {
    setSaving(true);
    try { await onSave({ ...progress, notes: { ...progress.notes, [noteKey]: text }, noteHighlights: { ...progress.noteHighlights, [noteKey]: ranges } }); }
    finally { setSaving(false); }
  }
  useEffect(() => {
    const dirty = text !== saved || JSON.stringify(ranges) !== JSON.stringify(progress.noteHighlights[noteKey] ?? []);
    const key = `${progress.courseId}:${noteKey}`;
    registerDraft(key, dirty ? save : null);
    return () => registerDraft(key, null);
  });
  function highlight() {
    const start = area.current?.selectionStart ?? 0; const end = area.current?.selectionEnd ?? 0;
    if (start === end) return;
    const sorted = [...ranges, { start, end }].sort((a, b) => a.start - b.start);
    const merged: typeof ranges = [];
    for (const range of sorted) {
      const last = merged.at(-1);
      if (last && range.start <= last.end) last.end = Math.max(last.end, range.end);
      else merged.push({ ...range });
    }
    if (merged.length > 200) { onError(new Error('At most 200 highlights per note.')); return; }
    setRanges(merged);
  }
  const parts = [];
  let previous = 0;
  for (const range of ranges) { parts.push(text.slice(previous, range.start), <mark key={range.start}>{text.slice(range.start, range.end)}</mark>); previous = range.end; }
  parts.push(text.slice(previous));
  return <section className="note-editor"><label htmlFor={`note-${noteKey}`}>Private note</label>
    {preview ? <div className="note-preview">{parts.length && text ? parts : 'Your note is empty.'}</div> : <textarea id={`note-${noteKey}`} ref={area} maxLength={20000} value={text} onChange={event => { setRanges(adjustNoteHighlights(text, event.target.value, ranges)); setText(event.target.value); }} placeholder="Explain it in your words, or park a question for later."/>}
    <div className="button-row">
      <button className="primary" disabled={saving} onClick={() => void save().catch(onError)}>{saving ? 'Saving…' : 'Save note'}</button>
      {!preview && <button onClick={highlight}>Highlight selection</button>}
      <button onClick={() => setRanges([])} disabled={!ranges.length}>Clear highlights</button>
      <button onClick={() => setPreview(!preview)}>{preview ? 'Edit note' : 'Read note'}</button>
    </div><p className="small muted">{text !== saved ? 'Unsaved changes. Save before leaving this page.' : 'Saved text is private to this browser. Highlights overlapping an edit are removed; unaffected highlights stay anchored.'}</p>
  </section>;
}
