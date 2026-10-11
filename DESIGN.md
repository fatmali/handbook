# Handbook design system

Handbook preserves its notebook-folio identity: tangible original course covers,
a sculpted slate rail, mint supporting tabs, and quiet reading pages.
The library carries the expression; Focus carries one thought at a time.

An empty personal library opens with the same folio identity and two clear paths:
import generated course notes, or use the course-builder skill with the learner's
sources. No personal course is preinstalled or used as a public landing page.
Existing local courses keep their shelf and reading experience.

| Role | Light | Dark |
|---|---|---|
| Workspace | `#f3f4f9` | `#181d2d` |
| Page | `#ffffff` | `#252c40` |
| Ink | `#25263e` | `#edf0fb` |
| Muted ink | `#63677d` | `#b6bfd4` |
| Primary | `#424eb8` | `#c0cbff` |
| Mint ink | `#256c58` | `#a5dfc6` |
| Rail | `#252b45` | `#232a40` |

Locally served variable Hanken Grotesk carries both interface and display text.
Its OFL license remains beside the font. Prose measures no more than 73 characters.
Radii vary by role: 11px controls, 18px volumes, 22px reading pages, 23px rail.
Only book objects use stronger offset shadows and page-edge depth.

Desktop places the floating 224px rail at a 20px inset. Below 780px, a compact
labeled navigation replaces it. Both are stable app-level navigation: library,
import, and settings/backups. Opening or switching a course never changes their
labels, destinations, or layout.

The current course and its tools belong inside the workspace. Desktop shows
contextual course tabs; mobile uses a labeled Course tools disclosure with the
same destinations. Change course returns to the library instead of silently
changing the meaning of global links. The course shelf reduces to one column
before mobile; controls wrap without hiding their names. Focus intentionally
omits both global navigation and course tools.

Focus removes the rail, search, and library shelf. It has explicit Save & stop,
exact block/diagram resume, and optional thought parking. No study countdown,
automatic break, streak, or decorative motion is introduced. Separate original
practice mocks have a clearly opted-in deadline.

Imported content is plain text and typed blocks, never executable markup.
Learning diagrams have interpreted relations, user-controlled trace steps, and
text alternatives; cover artwork is decorative and never counted as a lesson.
