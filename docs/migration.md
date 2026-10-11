# Migration, concurrency and portability

Storage is origin-bound at `https://lab.fatmaali.dev`. Data on an older host does
not silently move; use a private backup to transfer it. On the same origin, the
first initialization parses a prior `kbai-study-companion-v1` localStorage key
before writes and transactionally stores converted personal courses, the
**entire original snapshot**, and a migration marker. Failure does not delete
the old key or install a half-migrated library.

New libraries start empty. Existing IndexedDB courses, private progress and
source attachments remain intact. When legacy KBAI progress exists without a
local KBAI course, it stays in the private archive until that course is explicitly
imported. The import connects its old notes and snapshots without downloading a
public seed or guessing unmatched anchors.

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

The prior public standalone course reader is no longer distributed. V1 is a PWA
plus private portable JSON, not a single-file snapshot with somebody else's
curriculum. To move devices/browsers, export a **private v1 backup**, restore it
with explicit confirmation, and reattach local source PDFs. Empty libraries
and their preferences can also be backed up and restored.

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
Focus's explicit block ID is retained when it still exists; removed blocks need
a deliberately chosen new anchor. No invented nearest-text match occurs.
Revision 6 replaces the old KBAI explanatory blocks with `lesson-XX-notes-*` IDs
and preserves the old focus map unchanged. Both a v5 update and an initial legacy
migration retain unmatched anchors with explicit warnings.

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
