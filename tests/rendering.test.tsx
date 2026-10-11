import { render, screen, fireEvent } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import type { CoursePack } from '../packages/course-pack/src';
import { ContentBlock, LinkedText } from '../src/components/CourseContent';
import { NoteEditor } from '../src/components/Notebook';
import { emptyProgress } from '../src/domain';
import { samplePack } from '../src/content/sample';
import { Library } from '../src/storage';

it('renders untrusted script-like text literally, never as markup', async () => {
  const library = await Library.open('rendering');
  const block = { ...samplePack.chapters[0].blocks[0], kind: 'paragraph' as const, text: '<script>window.HACKED=true</script><img src=x onerror=alert(1)>', conceptIds: [], citations: [] };
  const view = render(<ContentBlock block={block} pack={samplePack} library={library} onError={vi.fn()} onConcept={vi.fn()} position={0} onPosition={vi.fn()} revealed={false} onReveal={vi.fn()}/>);
  expect(view.container.querySelector('script')).toBeNull(); expect(view.container.querySelector('img')).toBeNull();
  expect(screen.getByText(/window.HACKED/)).toBeInTheDocument(); library.close();
});
it('links canonical vocabulary and preserves boundaries and React-safe text', () => {
  const onConcept = vi.fn();
  render(<LinkedText text="An Observation differs from observationary text." concepts={samplePack.concepts} onConcept={onConcept}/>);
  fireEvent.click(screen.getByRole('button', { name: 'Observation' }));
  expect(onConcept).toHaveBeenCalledWith('observation');
  expect(screen.queryByRole('button', { name: 'observationary' })).toBeNull();
});
it('renders declarative diagrams with text alternatives and controlled steps', async () => {
  const library = await Library.open('diagram-render');
  const diagram = samplePack.chapters[0].blocks.find(block => block.kind === 'diagram')!;
  const onPosition = vi.fn();
  render(<ContentBlock block={diagram} pack={samplePack} library={library} onError={vi.fn()} onConcept={vi.fn()} position={0} onPosition={onPosition} revealed={false} onReveal={vi.fn()}/>);
  expect(screen.getByRole('img')).toHaveAccessibleName(/Wet pavement/);
  fireEvent.click(screen.getByRole('button', { name: 'Next trace step' }));
  expect(onPosition).toHaveBeenCalledWith(1);
  expect(screen.getByText('Text alternative and relation details')).toBeInTheDocument(); library.close();
});
it('edits plain notes and preserves selection highlights on save', async () => {
  const progress = emptyProgress('note-fixture');
  const save = vi.fn(async () => undefined);
  render(<NoteEditor noteKey="scratch" progress={progress} onSave={save} onError={vi.fn()} registerDraft={vi.fn()}/>);
  const area = screen.getByRole('textbox') as HTMLTextAreaElement;
  fireEvent.change(area, { target: { value: 'my original note' } }); area.setSelectionRange(0, 2);
  fireEvent.click(screen.getByRole('button', { name: 'Highlight selection' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save note' }));
  expect(save).toHaveBeenCalledWith(expect.objectContaining({ notes: { scratch: 'my original note' }, noteHighlights: { scratch: [{ start: 0, end: 2 }] } }));
});
it('supports a generic imported course without KBAI-specific rendering', async () => {
  const library = await Library.open('same-renderer');
  const imported: CoursePack = structuredClone(samplePack); imported.id = 'imported-course';
  render(<ContentBlock block={imported.chapters[0].blocks[0]} pack={imported} library={library} onError={vi.fn()} onConcept={vi.fn()} position={0} onPosition={vi.fn()} revealed={false} onReveal={vi.fn()}/>);
  expect(screen.getByRole('button', { name: 'hypothesis' })).toBeInTheDocument(); library.close();
});
