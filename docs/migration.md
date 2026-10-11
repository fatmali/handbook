# Migration, concurrency and portability

The Pages rename remains on `https://fatmali.github.io`, so a browser can read
the prior `kbai-study-companion-v1` localStorage key despite the new path.
The first v1 initialization parses it before writes and transactionally stores:
bundled packs, converted personal courses, private progress, the **entire original
snapshot**, and a migration marker. Failure does not delete the old key or
install a half-migrated library.

Repeated initialization is idempotent and never reapplies an old snapshot over
new work. The original localStorage key is retained. A private backup includes
the legacy archive; **Export preserved legacy state** also downloads it.

Notes/highlights, recall drafts/schedules, bookmarks, checks, active practice,
revisioned answer keys and Focus positions are preserved. All 26 baseline Focus
sequences have explicit canonical block maps. Old question-bank revisions 1–3
have persistent snapshots; historical results are never regraded using a newer
answer key. Weekly task labels, old review logs and administrative view metadata
remain in the original private archive when they have no generic v1 view.

Private notes and recall drafts support up to 30,000 characters independently
of the course-content text limit. Long legacy text and end-of-note highlights
are validated before migration writes and remain editable, saveable and
round-trip safe in private backups; no truncation is performed.

Personal course text becomes strict typed paragraph blocks. Unsupported source
links remain in the archive rather than being trusted as verified citations.
Empty personal courses remain archived, with a visible warning.

The prior standalone [Handbook-v0.html](https://fatmali.github.io/handbook/legacy/Handbook-v0.html)
remains downloadable. V1 is a PWA plus portable JSON, not a new single-file HTML
snapshot. To move devices/browsers, export a **private v1 backup**, restore it
with explicit confirmation, and reattach local source PDFs. To open a historical
v0 backup in the prior reader, use that reader's validated restore function.

For large libraries, export separate private course backups. **Merge** restores
their course/progress records without deleting other courses or replacing the
current private profile. Matching course records are replaced only after that
explicit choice. **Replace** restores the entire library and profile. Every
export is checked against the same count/64 MB limits as restore.

IndexedDB writes use atomic transactions and compare stored revisions. A stale
tab is refused rather than merged by guessing. BroadcastChannel reports remote
saves; reload local data before reapplying your still-visible unsaved text.
Backup restore increments progress revisions beyond both imported and current
values, invalidating pre-restore writers.

Course updates preserve private notes and historical snapshots. Removed or
changed annotation anchors remain visible with a warning and manual reattachment.
Focus's explicit block ID is retained; no invented nearest-text match occurs.

Browser quota, persistence denial and invalid imports show actionable errors.
Browsers may still evict origin storage; backups are essential. PDF blobs never
enter course exports, private JSON backups, Git, or the service-worker cache.
No cross-device sync, model inference, analytics or unattended upload is shipped.

The student-facing KBAI introduction was corrected after v4 shipped. On opening
an existing v3/v4 stock course, only exact known stock subtitle, description and
coverage strings are replaced. Edited fields and other imported courses are not
rewritten. This cosmetic correction does not change content revisions, lessons,
source anchors or any private progress. Course coverage remains available through
the closed **Coverage & limitations** disclosure and Sources; implementation
audits and source-verification detail remain in the developer coverage report.
