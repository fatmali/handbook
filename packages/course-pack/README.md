# @handbook/course-pack

Build from the repository root with `npm ci && npm run build`.
The package exports strict typed models, `validateCoursePack`, `parseCourseJSON`,
limits, private-profile validation and evidence-led learner helpers.
`schema/course-pack-v1.schema.json` is generated from those same runtime models.

The `handbook-validate` executable is a bundled Node 20+ CLI. It exits 0 for
structurally valid courses, 1 for invalid data, and 2 for usage/file errors.
Validation is not factual verification.

After building, `npm pack ./packages/course-pack` creates an installable package.
The application imports the same source implementation that is bundled into
the portable course-builder skill; there is no duplicated validator.
