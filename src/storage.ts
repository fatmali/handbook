import { openDB, type DBSchema, type IDBPDatabase, type IDBPTransaction, type StoreNames } from 'idb';
import { type CoursePack, type PrivateProfile, defaultProfile, privateProfileSchema, validateCoursePack } from '../packages/course-pack/src';
import { type Progress, emptyProgress, progressSchema, reconcileProgress, validateBackup, MAX_COURSES } from './domain';
import { migrateLegacy } from './migration';
import { correctStockCourseCopy } from './content/kbai-copy';

type LocalAsset = { id: string; courseId: string; sourceId: string; fingerprint: string; name: string; blob: Blob };
interface HandbookDB extends DBSchema {
  packs: { key: string; value: CoursePack };
  progress: { key: string; value: Progress };
  profile: { key: string; value: PrivateProfile };
  assets: { key: string; value: LocalAsset };
  meta: { key: string; value: unknown };
}
export class ConflictError extends Error {
  constructor() { super('Another tab changed this course. Reload the latest data before saving again. Your unsaved text is still visible.'); }
}
export const storageMessage = (error: unknown) => error instanceof DOMException && error.name === 'QuotaExceededError'
  ? 'Browser storage is full. Export a private backup, free device storage, then try again. Nothing was installed.'
  : error instanceof Error ? error.message : 'Browser storage failed. Export your work before trying again.';
export class Library {
  private db: IDBPDatabase<HandbookDB>;
  constructor(db: IDBPDatabase<HandbookDB>) { this.db = db; }
  static async open(name = 'handbook-v1') {
    const db = await openDB<HandbookDB>(name, 1, {
      upgrade(db) { for (const name of ['packs', 'progress', 'profile', 'assets', 'meta'] as const) db.createObjectStore(name); },
      blocking() { db.close(); window.dispatchEvent(new Event('handbook-database-blocked')); },
    });
    return new Library(db);
  }
  close() { this.db.close(); }
  private async write<T, S extends StoreNames<HandbookDB>[]>(stores: S, operation: (tx: IDBPTransaction<HandbookDB, S, 'readwrite'>) => Promise<T>): Promise<T> {
    const tx = this.db.transaction(stores, 'readwrite');
    // Observe completion immediately, including intentional aborts, without hiding the operation's error.
    const completion = tx.done.then(() => ({ ok: true as const }), error => ({ ok: false as const, error }));
    try {
      const value = await operation(tx);
      const result = await completion;
      if (!result.ok) throw result.error;
      return value;
    } catch (error) {
      try { tx.abort(); }
      catch (abortError) {
        if (!(abortError instanceof DOMException && abortError.name === 'InvalidStateError')) throw abortError;
      }
      await completion;
      throw error;
    }
  }
  async initialize(seeds: CoursePack[], legacyRaw: string | null) {
    let copyCorrected = false;
    const alreadyMigrated = await this.db.get('meta', 'legacyMigrated');
    const installedKBAI = await this.db.get('packs', 'kbai');
    const legacy = legacyRaw && !alreadyMigrated ? migrateLegacy(legacyRaw, installedKBAI ?? seeds.find(pack => pack.id === 'kbai')) : null;
    await this.write(['packs', 'progress', 'profile', 'meta'], async tx => {
    const initialized = await tx.objectStore('meta').get('initialized');
    if (!initialized) {
      for (const pack of seeds) {
        const checked = validateCoursePack(pack);
        if (!checked.ok) throw new Error(`Bundled course invalid: ${checked.issues.map(issue => `${issue.path}: ${issue.message}`).join('; ')}`);
        await tx.objectStore('packs').put(checked.pack, pack.id);
        await tx.objectStore('progress').put(emptyProgress(pack.id), pack.id);
      }
      await tx.objectStore('profile').put(defaultProfile, 'learner');
      await tx.objectStore('meta').put(true, 'initialized');
      await tx.objectStore('meta').put(0, 'libraryRevision');
    }
    if (legacy && !await tx.objectStore('meta').get('legacyMigrated')) {
      await tx.objectStore('meta').put(JSON.parse(legacyRaw!), 'legacyBackup');
      for (const pack of legacy.packs) await tx.objectStore('packs').put(pack, pack.id);
      for (const progress of legacy.progress) await tx.objectStore('progress').put(progressSchema.parse(progress), progress.courseId);
      await tx.objectStore('meta').put(true, 'legacyMigrated');
      await tx.objectStore('meta').put(legacy.warnings, 'migrationWarnings');
      await tx.objectStore('meta').put(legacy.pendingKBAI, 'legacyPendingKBAI');
    }
    if (await tx.objectStore('packs').count() > MAX_COURSES) throw new Error(`A library supports ${MAX_COURSES} courses. Legacy data is untouched; export it before selecting courses to migrate.`);
    for (const id of ['kbai', 'everyday-evidence']) {
      const installedCourse = await tx.objectStore('packs').get(id);
      if (!installedCourse) continue;
      const corrected = correctStockCourseCopy(installedCourse);
      if (corrected !== installedCourse) {
        copyCorrected = true;
        await tx.objectStore('packs').put(corrected, corrected.id);
        const revision = await tx.objectStore('meta').get('libraryRevision');
        if (typeof revision !== 'number') throw new Error('Library revision is unavailable. Course copy was not changed.');
        await tx.objectStore('meta').put(revision + 1, 'libraryRevision');
      }
    }
    });
    if (copyCorrected) this.notify();
    return legacy;
  }
  async snapshot() {
    const tx = this.db.transaction(['packs', 'progress', 'profile', 'meta']);
    const [packs, progress, profile, revision, warnings] = await Promise.all([
      tx.objectStore('packs').getAll(), tx.objectStore('progress').getAll(), tx.objectStore('profile').get('learner'),
      tx.objectStore('meta').get('libraryRevision'), tx.objectStore('meta').get('migrationWarnings'),
    ]);
    return { packs, progress, profile: profile ?? defaultProfile, revision: typeof revision === 'number' ? revision : 0, warnings: Array.isArray(warnings) ? warnings.filter((value): value is string => typeof value === 'string') : [] };
  }
  private notify() { window.dispatchEvent(new Event('handbook-saved')); }
  async saveProgress(progress: Progress) {
    const parsed = progressSchema.parse(progress);
    const next = await this.write(['progress'], async tx => {
    const current = await tx.objectStore('progress').get(progress.courseId);
    if (!current || current.revision !== progress.revision) throw new ConflictError();
    const next = { ...parsed, revision: parsed.revision + 1, updatedAt: Date.now() };
    await tx.objectStore('progress').put(next, next.courseId);
    return next;
    });
    this.notify();
    return next;
  }
  async install(input: unknown, expectedLibraryRevision: number) {
    const result = validateCoursePack(input);
    if (!result.ok) throw new Error(result.issues.map(issue => `${issue.path}: ${issue.message}`).join('\n'));
    const pack = result.pack;
    await this.write(['packs', 'progress', 'meta'], async tx => {
    const revision = await tx.objectStore('meta').get('libraryRevision');
    if (revision !== expectedLibraryRevision) throw new ConflictError();
    const old = await tx.objectStore('packs').get(pack.id);
    if (!old && await tx.objectStore('packs').count() >= MAX_COURSES) throw new Error(`Library limit: ${MAX_COURSES} courses. Export a private backup before reducing the library; no course was installed.`);
    let progress = await tx.objectStore('progress').get(pack.id) ?? emptyProgress(pack.id);
    if (old) {
      if (pack.contentRevision <= old.contentRevision) throw new Error('An update must increase contentRevision. Existing course and notes are untouched.');
      progress = reconcileProgress(progress, old, pack);
    } else if (pack.id === 'kbai' && await tx.objectStore('meta').get('legacyPendingKBAI')) {
      const archive = await tx.objectStore('meta').get('legacyBackup');
      if (!archive) throw new Error('The pending legacy archive is unavailable. No course was installed.');
      const migrated = migrateLegacy(JSON.stringify(archive), pack);
      const restored = migrated.progress.find(progress => progress.courseId === pack.id);
      if (!restored) throw new Error('Legacy course progress could not be connected. The original archive is unchanged.');
      progress = progressSchema.parse(restored);
      await tx.objectStore('meta').put(false, 'legacyPendingKBAI');
      await tx.objectStore('meta').put(migrated.warnings, 'migrationWarnings');
    }
    await tx.objectStore('packs').put(pack, pack.id);
    await tx.objectStore('progress').put({ ...progress, revision: progress.revision + 1 }, pack.id);
    await tx.objectStore('meta').put(expectedLibraryRevision + 1, 'libraryRevision');
    });
    this.notify();
  }
  async saveProfile(profile: PrivateProfile, expectedRevision: number) {
    const parsed = privateProfileSchema.parse(profile);
    await this.write(['profile', 'meta'], async tx => {
    if (await tx.objectStore('meta').get('libraryRevision') !== expectedRevision) throw new ConflictError();
    await tx.objectStore('profile').put(parsed, 'learner');
    await tx.objectStore('meta').put(expectedRevision + 1, 'libraryRevision');
    });
    this.notify();
  }
  async privateBackup(courseId?: string) {
    const tx = this.db.transaction(['packs', 'progress', 'profile', 'meta']);
    const [packs, progress, profile, legacy] = await Promise.all([
      tx.objectStore('packs').getAll(), tx.objectStore('progress').getAll(),
      tx.objectStore('profile').get('learner'), tx.objectStore('meta').get('legacyBackup'),
    ]);
    if (!profile) throw new Error('Private profile store is unavailable. No incomplete backup was produced.');
    const snapshot = { packs, progress, profile };
    if (courseId && !snapshot.packs.some(pack => pack.id === courseId)) throw new Error('Unknown course for private backup.');
    const backup = { format: 'handbook-private-backup' as const, version: 1 as const, exportedAt: new Date().toISOString(), packs: courseId ? snapshot.packs.filter(pack => pack.id === courseId) : snapshot.packs, progress: courseId ? snapshot.progress.filter(progress => progress.courseId === courseId) : snapshot.progress, profile: snapshot.profile, ...(legacy ? { legacy } : {}) };
    const raw = JSON.stringify(backup);
    if (new TextEncoder().encode(raw).length > 64_000_000) throw new Error('Complete private backup exceeds 64 MB. Export each course as a separate private backup; no private data was dropped or truncated.');
    return validateBackup(raw);
  }
  async restore(raw: string, expectedRevision: number, mode: 'replace' | 'merge' = 'replace') {
    const backup = validateBackup(raw);
    await this.write(['packs', 'progress', 'profile', 'meta', 'assets'], async tx => {
    if (await tx.objectStore('meta').get('libraryRevision') !== expectedRevision) throw new ConflictError();
    const oldProgress = await tx.objectStore('progress').getAll();
    if (mode === 'replace') {
      for (const name of ['packs', 'progress', 'assets'] as const) await tx.objectStore(name).clear();
    } else {
      const assets = await tx.objectStore('assets').getAll();
      for (const asset of assets) if (backup.packs.some(pack => pack.id === asset.courseId)) await tx.objectStore('assets').delete(asset.id);
    }
    for (const pack of backup.packs) await tx.objectStore('packs').put(pack, pack.id);
    for (const pack of backup.packs) {
      const current = backup.progress.find(progress => progress.courseId === pack.id) ?? emptyProgress(pack.id);
      const oldRevision = oldProgress.find(progress => progress.courseId === pack.id)?.revision ?? 0;
      await tx.objectStore('progress').put({ ...current, revision: Math.max(oldRevision, current.revision) + 1 }, pack.id);
    }
    if (mode === 'replace') await tx.objectStore('profile').put(backup.profile, 'learner');
    if (backup.legacy && (mode === 'replace' || !await tx.objectStore('meta').get('legacyBackup'))) {
      await tx.objectStore('meta').put(backup.legacy, 'legacyBackup');
      await tx.objectStore('meta').put(true, 'legacyMigrated');
      await tx.objectStore('meta').put(!await tx.objectStore('packs').get('kbai'), 'legacyPendingKBAI');
    }
    if (await tx.objectStore('packs').count() > MAX_COURSES) throw new Error(`Merged backup exceeds the ${MAX_COURSES}-course limit. No records were changed.`);
    await tx.objectStore('meta').put(expectedRevision + 1, 'libraryRevision');
    });
    this.notify();
  }
  async bindSource(pack: CoursePack, sourceId: string, file: File) {
    if (!pack.sources.some(source => source.id === sourceId)) throw new Error('Unknown source.');
    if (file.size > 80_000_000) throw new Error('Local PDF exceeds 80 MB. Keep it in your PDF reader instead.');
    const bytes = await file.arrayBuffer();
    const magic = new TextDecoder().decode(bytes.slice(0, 5));
    if (magic !== '%PDF-') throw new Error('Select a PDF file. The file content is not a PDF.');
    const fingerprint = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(byte => byte.toString(16).padStart(2, '0')).join('');
    const expected = pack.assets.find(asset => asset.sourceId === sourceId)?.sha256;
    if (expected && fingerprint !== expected) throw new Error('This PDF fingerprint does not match the course source. No file was attached.');
    await this.db.put('assets', { id: `${pack.id}:${sourceId}`, courseId: pack.id, sourceId, fingerprint, name: file.name, blob: new Blob([bytes], { type: 'application/pdf' }) }, `${pack.id}:${sourceId}`);
    this.notify(); return fingerprint;
  }
  async getSource(courseId: string, sourceId: string) { return this.db.get('assets', `${courseId}:${sourceId}`); }
  async removeSource(courseId: string, sourceId: string) { await this.db.delete('assets', `${courseId}:${sourceId}`); this.notify(); }
  async legacyBackup() { return this.db.get('meta', 'legacyBackup'); }
}
