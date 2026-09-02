/**
 * `pnpm ingest` — orchestrates the build-time pipeline that produces
 * app/data/catalog.json and public/images/ from data/.
 *
 * Not implemented yet: the pipeline lands in Phase 4 of
 * edc-catalog-app-implementation-plan.md as fetch-images → process-images →
 * analyze-label → build-catalog. This stub exists so the command table in
 * CLAUDE.md and README.md is never aspirational, and so a fresh clone gets a
 * clear message rather than "command not found".
 */
console.error(
  'pnpm ingest: the ingest pipeline is not implemented yet (Phase 4).\n' +
    'See the "Ingest pipeline" section of edc-catalog-app-implementation-plan.md.',
)
process.exit(1)
