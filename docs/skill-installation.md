# Install the portable course-builder skill

Download [handbook-course-builder.zip](https://fatmali.github.io/handbook/downloads/handbook-course-builder.zip)
from the app's Import screen, or use the directory
`skills/handbook-course-builder/` in this repository after `npm run build`.

The ZIP contains `SKILL.md`, interview/quality references, generated course and
private-profile schemas, an original valid example, licenses, and a bundled
Node 20+ validator. No npm install or AI provider key is needed to run the
bundled validator.

Choose a directory your harness actually supports:

| Harness | Common skill directory |
|---|---|
| GitHub Copilot CLI | `~/.copilot/skills/handbook-course-builder/` or repository `.github/skills/handbook-course-builder/` |
| Claude Code | `~/.claude/skills/handbook-course-builder/` or repository `.claude/skills/handbook-course-builder/` |
| Codex | `~/.agents/skills/handbook-course-builder/` or repository `.agents/skills/handbook-course-builder/` |

Harness support and settings vary. Check its current Agent Skills instructions;
do not assume an identical install command/path in every agent. A standard
portable skill is supplied, not a falsely advertised universal plugin.

After copying/unzipping, ask the agent to use **handbook-course-builder** on
your authorized syllabus and learning sources. The interview can be skipped or
adapted to known context; sensitive disclosure is never a prerequisite.

```sh
cd /path/to/handbook-course-builder
node scripts/validate-course-pack.mjs assets/example-course.json
node scripts/validate-course-pack.mjs /path/to/generated-course.json
```

A valid result confirms structural compatibility only. Review source accuracy,
coverage, diagram meaning, rights and depth before handing the file to the app.

In Handbook, choose **Import course**, select the generated JSON, inspect its
preview and confirm installation. This is a local browser import, not an API
upload. No automatic bridge, cloud account or direct browser-storage permission
is implied.

If the learner explicitly wants a private profile, generate it separately
using `assets/private-profile.schema.json`. It must never be included in course
metadata. The Settings form can capture those same preferences locally.
