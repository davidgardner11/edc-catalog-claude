/**
 * Minimal logging for the ingest pipeline.
 *
 * The pipeline's contract is that a run tells you exactly what it fetched,
 * skipped, cached, or failed (ADR-014) — so the vocabulary is fixed and every
 * line is prefixed by the stage. No dependency: `consola` belongs to Nuxt's
 * runtime and the scripts are plain Node.
 */

/** Fixed vocabulary. `skip` means "already correct", `warn` means "degraded but usable". */
export type Verb = 'fetch' | 'cached' | 'encode' | 'skip' | 'write' | 'prune' | 'warn' | 'fail' | 'info'

const PAD = 6

/** Structural, not `NodeJS.WriteStream`: this repo does not depend on `@types/node`. */
type Sink = { write(chunk: string): unknown }

function emit(stream: Sink, stage: string, verb: Verb, message: string): void {
  stream.write(`[${stage}] ${verb.padEnd(PAD)} ${message}\n`)
}

export type Logger = {
  (verb: Verb, message: string): void
  /** Section header, so a long run is skimmable. */
  banner(message: string): void
}

export function logger(stage: string): Logger {
  const fn = ((verb: Verb, message: string) => {
    // Failures and warnings go to stderr so `pnpm ingest 2>/dev/null` shows
    // only the happy path, and CI surfaces problems without parsing.
    emit(verb === 'fail' || verb === 'warn' ? process.stderr : process.stdout, stage, verb, message)
  }) as Logger
  fn.banner = (message: string) => process.stdout.write(`\n=== ${message} ===\n`)
  return fn
}

/**
 * Per-pack failure record. Stages collect these instead of throwing, so one
 * blocked retailer never aborts the other nineteen packs.
 */
export type PackFailure = { slug: string; stage: string; reason: string }

export function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
