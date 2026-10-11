import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { Library, storageMessage, ConflictError } from '../src/storage';
import { defaultProfile } from '../packages/course-pack/src';
import { samplePack } from '../src/content/sample';
import { emptyProgress, MAX_COURSES, validateBackup } from '../src/domain';

beforeEach(() => { vi.stubGlobal('indexedDB', new IDBFactory()); });
async function seeded() { const library = await Library.open(); await library.initialize([samplePack], null); return library; }
describe('transactional local-first library', () => {
  it('stores courses independently and preserves private notes across export/restore', async () => {
    const library = await seeded();
    const next = structuredClone(samplePack); next.id = 'other-course';
    await library.install(next, 0);
    const snapshot = await library.snapshot();
    await library.saveProgress({ ...snapshot.progress.find(progress => progress.courseId === samplePack.id)!, notes: { scratch: 'private note' } });
    const current = await library.snapshot();
    expect(current.progress.find(progress => progress.courseId === next.id)?.notes).toEqual({});
    const backup = await library.privateBackup();
    expect(JSON.stringify(backup.packs)).not.toContain('private note');
    await library.restore(JSON.stringify(backup), current.revision);
    expect((await library.snapshot()).progress.find(progress => progress.courseId === samplePack.id)?.notes.scratch).toBe('private note');
    library.close();
  });
  it('never mutates the library for invalid import, stale update, or corrupt backup', async () => {
    const library = await seeded(); const before = await library.snapshot();
    const bad = structuredClone(samplePack); bad.schemaVersion = 'unsupported' as '1.0';
    await expect(library.install(bad, 0)).rejects.toThrow();
    await expect(library.install(samplePack, 0)).rejects.toThrow('increase');
    await expect(library.install({ ...samplePack, id: 'constructor' }, 0)).rejects.toThrow();
    await expect(library.restore('{"bad":true}', 0)).rejects.toThrow();
    expect(await library.snapshot()).toEqual(before); library.close();
  });
  it('detects multi-tab progress and pack races instead of losing edits', async () => {
    const first = await seeded(); const second = await Library.open();
    const progress = (await first.snapshot()).progress[0];
    await first.saveProgress({ ...progress, notes: { scratch: 'first tab' } });
    await expect(second.saveProgress({ ...progress, notes: { scratch: 'second tab' } })).rejects.toBeInstanceOf(ConflictError);
    const update = structuredClone(samplePack); update.contentRevision++;
    await first.install(update, 0);
    await expect(second.install({ ...update, contentRevision: 3 }, 0)).rejects.toBeInstanceOf(ConflictError);
    first.close(); second.close();
  });
  it('reports quota errors explicitly and leaves stored pack unchanged', async () => {
    const library = await seeded(); const before = await library.snapshot();
    const next = structuredClone(samplePack); next.contentRevision++;
    const original = IDBObjectStore.prototype.put;
    const mock = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(() => { throw new DOMException('Quota', 'QuotaExceededError'); });
    await expect(library.install(next, 0)).rejects.toThrow('Quota');
    mock.mockRestore(); IDBObjectStore.prototype.put = original;
    expect((await library.snapshot()).packs).toEqual(before.packs);
    expect(storageMessage(new DOMException('Quota', 'QuotaExceededError'))).toContain('storage is full');
    library.close();
  });
  it('keeps profile private and enforces confirmation revision for profile updates', async () => {
    const library = await seeded();
    await library.saveProfile({ ...defaultProfile, ageBand: '13-15' }, 0);
    expect((await library.snapshot()).profile.ageBand).toBe('13-15');
    expect(JSON.stringify((await library.snapshot()).packs)).not.toContain('"ageBand"');
    await expect(library.saveProfile(defaultProfile, 0)).rejects.toBeInstanceOf(ConflictError);
    library.close();
  });
  it('rejects fake source PDFs and stores fingerprint-bound local blobs', async () => {
    const library = await seeded();
    const pack = structuredClone(samplePack); pack.sources[0].kind = 'ebook';
    const file = new File(['%PDF-1.4\noriginal fixture'], 'original.pdf', { type: 'application/pdf' });
    Object.defineProperty(file, 'arrayBuffer', { value: async () => new TextEncoder().encode('%PDF-1.4\noriginal fixture').buffer });
    const fingerprint = await library.bindSource(pack, pack.sources[0].id, file);
    expect(fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect((await library.getSource(pack.id, pack.sources[0].id))?.blob).toBeDefined();
    pack.assets = [{ id: 'source-asset', sourceId: pack.sources[0].id, mediaType: 'application/pdf', filename: 'original.pdf', sha256: '0'.repeat(64) }];
    await expect(library.bindSource(pack, pack.sources[0].id, file)).rejects.toThrow('fingerprint');
    const bad = new File(['HTML'], 'fake.pdf');
    Object.defineProperty(bad, 'arrayBuffer', { value: async () => new TextEncoder().encode('HTML').buffer });
    await expect(library.bindSource(pack, pack.sources[0].id, bad)).rejects.toThrow('not a PDF');
    await library.removeSource(pack.id, pack.sources[0].id);
    expect(await library.getSource(pack.id, pack.sources[0].id)).toBeUndefined();
    library.close();
  });
  it('restoring a backup invalidates stale progress even when imported revision is older', async () => {
    const library = await seeded(); const backup = await library.privateBackup();
    let progress = (await library.snapshot()).progress[0];
    for (let i = 0; i < 5; i++) progress = await library.saveProgress(progress);
    await library.restore(JSON.stringify(backup), 0);
    await expect(library.saveProgress(progress)).rejects.toBeInstanceOf(ConflictError);
    expect((await library.snapshot()).progress[0].revision).toBeGreaterThan(progress.revision);
    library.close();
  });
  it('initialization is idempotent and does not replace local changes', async () => {
    const library = await seeded();
    const progress = (await library.snapshot()).progress[0];
    await library.saveProgress({ ...progress, notes: { scratch: 'keep me' } });
    await library.initialize([samplePack], null);
    expect((await library.snapshot()).progress[0].notes.scratch).toBe('keep me');
    expect(emptyProgress('sample').revision).toBe(0); library.close();
  });
  it('round-trips a full 32-course library and rejects the next install without truncation', async () => {
    const library = await seeded();
    for (let i = 1; i < MAX_COURSES; i++) await library.install({ ...samplePack, id: `course-${i}` }, i - 1);
    const backup = await library.privateBackup();
    expect(validateBackup(JSON.stringify(backup)).packs).toHaveLength(MAX_COURSES);
    await expect(library.install({ ...samplePack, id: 'overflow' }, MAX_COURSES - 1)).rejects.toThrow('Library limit');
    expect((await library.snapshot()).packs).toHaveLength(MAX_COURSES);
    expect((await library.privateBackup('course-1')).packs).toHaveLength(1);
    library.close();
  });
  it('merges private course backups without dropping other courses or current profile', async () => {
    const library = await seeded();
    const backup = await library.privateBackup(samplePack.id);
    await library.install({ ...samplePack, id: 'keep-other' }, 0);
    await library.saveProfile({ ...defaultProfile, goals: 'keep profile' }, 1);
    await library.restore(JSON.stringify(backup), 2, 'merge');
    const snapshot = await library.snapshot();
    expect(snapshot.packs).toHaveLength(2);
    expect(snapshot.profile.goals).toBe('keep profile');
    library.close();
  });
});
