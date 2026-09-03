/**
 * The considerate HTTP client the ingest fetcher is required to be (ADR-009,
 * CLAUDE.md "Repository"): honours `robots.txt`, rate-limits per host, sends a
 * real User-Agent, and gives up on a blocked host instead of retrying it in a
 * loop.
 *
 * Everything here is about *not* being a nuisance. The pipeline downloads at
 * most 5 images per pack, once, into a cache that is never invalidated by
 * convenience — so the correct request count for a re-run is zero.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { ROBOTS_CACHE_DIR } from './paths.ts'
import { logger } from './log.ts'

const log = logger('http')

/**
 * A real, attributable User-Agent with a contact URL, per ADR-009. Not a
 * browser impersonation string: a host that wants to refuse this client should
 * be able to.
 */
export const USER_AGENT =
  'edc-catalog-ingest/0.1 (+https://github.com/davidgardner11/edc-catalog-claude)'

/** The token a `robots.txt` group would have to name to target us specifically. */
const UA_TOKEN = 'edc-catalog-ingest'

/** Floor between two requests to the same host, in ms. Raised by `Crawl-delay`. */
const MIN_HOST_INTERVAL_MS = 1_200

/** `Crawl-delay` is honoured but clamped: a hostile value must not hang the build. */
const MAX_CRAWL_DELAY_MS = 10_000

const REQUEST_TIMEOUT_MS = 30_000

/**
 * `INGEST_OFFLINE=1` makes every outbound request throw before it is made.
 *
 * This is the mechanism that *proves* the second gate condition: a run that
 * rebuilds `public/images/` from `.ingest-cache/` must succeed with this set.
 * If it does not, something re-downloaded.
 *
 * Read per call, not captured at module scope. Capturing it would freeze the
 * value at *import* time — which for a static import is before the importing
 * module's body has run — so anything that set it programmatically would be
 * ignored in silence. That exact mistake shipped once here, in
 * `process-images.ts`'s `--reencode` handling; this is the same shape and does
 * not get to repeat it.
 */
function isOffline(): boolean {
  return process.env.INGEST_OFFLINE === '1'
}

let requestCount = 0
/** Requests actually put on the wire this run. The re-run gate expects 0. */
export function networkRequestCount(): number {
  return requestCount
}

const lastRequestAt = new Map<string, number>()
const hostDelayMs = new Map<string, number>()

/**
 * Hosts that answered 401/403 or a bot challenge. Once a host is in here every
 * later URL on it fails immediately — "fail gracefully on a blocked host rather
 * than retrying in a loop" is the rule, and a per-image retry storm is the
 * exact failure it forbids.
 */
const blockedHosts = new Map<string, string>()

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

async function throttle(host: string): Promise<void> {
  const interval = Math.max(MIN_HOST_INTERVAL_MS, hostDelayMs.get(host) ?? 0)
  const previous = lastRequestAt.get(host)
  if (previous !== undefined) {
    const wait = previous + interval - Date.now()
    if (wait > 0) await sleep(wait)
  }
  lastRequestAt.set(host, Date.now())
}

export class BlockedByHostError extends Error {}
export class DisallowedByRobotsError extends Error {}
export class OfflineError extends Error {}

async function rawFetch(url: URL, accept: string): Promise<Response> {
  if (isOffline()) {
    throw new OfflineError(
      `INGEST_OFFLINE=1 but ${url.href} was requested — something tried to re-download.`,
    )
  }
  await throttle(url.host)
  requestCount += 1
  const response = await fetch(url, {
    headers: { 'user-agent': USER_AGENT, accept },
    redirect: 'follow',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (response.status === 401 || response.status === 403 || response.status === 429) {
    blockedHosts.set(url.host, `HTTP ${response.status}`)
  }
  return response
}

// ---------------------------------------------------------------------------
// robots.txt
// ---------------------------------------------------------------------------

type Rule = { allow: boolean; pattern: string }
type Robots = { rules: Rule[]; crawlDelayMs: number | null; allowAll: boolean }

const robotsByOrigin = new Map<string, Robots>()

/**
 * Group-aware parse. Only two groups can apply to us — one naming
 * `edc-catalog-ingest` and the wildcard group — and the more specific one wins
 * outright, which is what the standard says and what a host operator expects.
 */
function parseRobots(text: string): Robots {
  const specific: Rule[] = []
  const wildcard: Rule[] = []
  let specificDelay: number | null = null
  let wildcardDelay: number | null = null

  // Agent tokens of the group currently being read. Consecutive `User-agent`
  // lines share one rule block, so the set is only reset when a rule follows.
  let agents: string[] = []
  let readingAgents = false

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.split('#')[0]!.trim()
    if (line === '') continue
    const colon = line.indexOf(':')
    if (colon === -1) continue
    const field = line.slice(0, colon).trim().toLowerCase()
    const value = line.slice(colon + 1).trim()

    if (field === 'user-agent') {
      if (!readingAgents) {
        agents = []
        readingAgents = true
      }
      agents.push(value.toLowerCase())
      continue
    }
    readingAgents = false

    const targets: Rule[][] = []
    let delayTargets: 'specific' | 'wildcard' | null = null
    // RFC 9309: a group targets us when its value is a case-insensitive
    // substring of our product token. `*` is handled separately below.
    if (agents.some((a) => a !== '*' && a !== '' && UA_TOKEN.includes(a))) {
      targets.push(specific)
      delayTargets = 'specific'
    }
    if (agents.includes('*')) {
      targets.push(wildcard)
      delayTargets ??= 'wildcard'
    }
    if (targets.length === 0) continue

    if (field === 'allow' || field === 'disallow') {
      // `Disallow:` with an empty value means "nothing is disallowed" and must
      // not be treated as the prefix that matches every path.
      if (field === 'disallow' && value === '') continue
      for (const t of targets) t.push({ allow: field === 'allow', pattern: value })
    } else if (field === 'crawl-delay') {
      const seconds = Number.parseFloat(value)
      if (Number.isFinite(seconds) && seconds > 0) {
        const ms = Math.min(seconds * 1000, MAX_CRAWL_DELAY_MS)
        if (delayTargets === 'specific') specificDelay = ms
        else wildcardDelay = ms
      }
    }
  }

  const rules = specific.length > 0 ? specific : wildcard
  const crawlDelayMs = specific.length > 0 ? specificDelay : wildcardDelay
  return { rules, crawlDelayMs, allowAll: rules.length === 0 }
}

/** `*` is any run of characters, `$` anchors the end. Everything else is literal. */
function patternMatches(pattern: string, path: string): boolean {
  const anchored = pattern.endsWith('$')
  const body = anchored ? pattern.slice(0, -1) : pattern
  const source =
    '^' +
    body
      .split('*')
      .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
      .join('.*') +
    (anchored ? '$' : '')
  return new RegExp(source).test(path)
}

/** Longest matching pattern wins; Allow beats Disallow at equal length (RFC 9309). */
function isAllowedBy(robots: Robots, path: string): boolean {
  if (robots.allowAll) return true
  let best: Rule | null = null
  for (const rule of robots.rules) {
    if (!patternMatches(rule.pattern, path)) continue
    if (
      best === null ||
      rule.pattern.length > best.pattern.length ||
      (rule.pattern.length === best.pattern.length && rule.allow)
    ) {
      best = rule
    }
  }
  return best === null ? true : best.allow
}

/**
 * Fetched once per origin per run, then cached to disk so a re-run of a
 * *changed* source file does not re-ask every host for its robots.txt.
 */
async function robotsFor(origin: string): Promise<Robots> {
  const cached = robotsByOrigin.get(origin)
  if (cached) return cached

  const host = new URL(origin).host
  const diskPath = resolve(ROBOTS_CACHE_DIR, `${host}.txt`)
  let text: string | null = null

  try {
    text = await readFile(diskPath, 'utf8')
  } catch {
    try {
      const response = await rawFetch(new URL('/robots.txt', origin), 'text/plain,*/*')
      if (response.status >= 500 || response.status === 401 || response.status === 403) {
        // Unreadable for a reason that suggests the host does not want us:
        // treat the whole origin as disallowed rather than assuming consent.
        const robots: Robots = { rules: [{ allow: false, pattern: '/' }], crawlDelayMs: null, allowAll: false }
        robotsByOrigin.set(origin, robots)
        log('warn', `${host}: robots.txt unreadable (HTTP ${response.status}) — treating host as disallowed`)
        return robots
      }
      // 404 and friends: no robots.txt means no restrictions.
      text = response.ok ? await response.text() : ''
      await mkdir(ROBOTS_CACHE_DIR, { recursive: true })
      await writeFile(diskPath, text, 'utf8')
    } catch (error) {
      if (error instanceof OfflineError) throw error
      const robots: Robots = { rules: [{ allow: false, pattern: '/' }], crawlDelayMs: null, allowAll: false }
      robotsByOrigin.set(origin, robots)
      log('warn', `${host}: robots.txt fetch failed — treating host as disallowed`)
      return robots
    }
  }

  // `text` is assigned on every path above, but TypeScript cannot see that
  // through the nested try/catch; the fallback is the correct value anyway.
  const robots = parseRobots(text ?? '')
  if (robots.crawlDelayMs !== null) {
    hostDelayMs.set(host, robots.crawlDelayMs)
    log('info', `${host}: honouring Crawl-delay ${robots.crawlDelayMs}ms`)
  }
  robotsByOrigin.set(origin, robots)
  return robots
}

/**
 * Fetch a binary asset, subject to robots.txt, per-host rate limiting, and the
 * blocked-host memo.
 *
 * One retry, and only for 429/5xx — a transient condition. 403 is a decision,
 * not a hiccup, so it fails immediately and poisons the host for the rest of
 * the run.
 */
export async function fetchAsset(rawUrl: string): Promise<{ bytes: Buffer; contentType: string }> {
  const url = new URL(rawUrl)
  const blocked = blockedHosts.get(url.host)
  if (blocked) {
    throw new BlockedByHostError(`${url.host} already refused this run (${blocked}) — not retrying`)
  }

  const robots = await robotsFor(url.origin)
  if (!isAllowedBy(robots, url.pathname + url.search)) {
    throw new DisallowedByRobotsError(`robots.txt disallows ${url.pathname} on ${url.host}`)
  }

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    // Deliberately advertises no modern format. A CDN that negotiates on `accept`
    // returns WebP/AVIF for a `.jpg` URL when we name those tokens — so the bytes
    // behind a URL would depend on the client, and two machines populating a cold
    // `.ingest-cache/` could emit different `width`/`height` into a committed
    // `catalog.json` (ADR-030). Asking only for `image/*` gets the URL's own bytes.
    const response = await rawFetch(url, 'image/*')
    if (response.ok) {
      return {
        bytes: Buffer.from(await response.arrayBuffer()),
        contentType: response.headers.get('content-type') ?? '',
      }
    }
    const retryable = response.status === 429 || response.status >= 500
    if (!retryable || attempt === 2) {
      throw new BlockedByHostError(`HTTP ${response.status} for ${url.href}`)
    }
    log('warn', `HTTP ${response.status} for ${url.href} — one retry in 3s`)
    await sleep(3_000)
  }
  throw new BlockedByHostError(`unreachable: ${url.href}`)
}
