// Pure parse of the repo file `<git root>/.claude/dry-run.json`. No engine calls,
// so a table test can run it. A bad file is ignored whole. The caller shows each
// problem as a toast.

import { splitPath } from './gate-path'
import type { LockRules } from './gate-path'
import { isAbsolute, UNKNOWN_ROOT } from './switch-file'

export type Mode = 'on' | 'soft' | 'off'

// The research agent name and path patterns for the Platform check (ticket 34).
export type Platform = { agent: string; paths: string[] }

export type RepoFile = {
  mode: Mode
  // True when the file really set a mode. Then `/dry-run` shows source "repo".
  hasMode: boolean
  // Extra locked endings, lower case, like ".yaml".
  lock: string[]
  // Endings (".sql") or repo folders ("generated/") to free.
  unlock: string[]
  platform: Platform | null
}

export type ParseResult = { file: RepoFile; problems: string[] }

const KNOWN_KEYS = ['mode', 'lock', 'unlock', 'platform']
const MODES: readonly Mode[] = ['on', 'soft', 'off']

// What a repo without a usable file gets.
export function emptyRepoFile(): RepoFile {
  return { mode: 'on', hasMode: false, lock: [], unlock: [], platform: null }
}

// A bad file: defaults and one problem.
function ignored(problem: string): ParseResult {
  return { file: emptyRepoFile(), problems: [`Repo file ignored: ${problem}`] }
}

// An item is an ending (".sql") or a folder ("generated/"). Lower case.
// Returns '' when the item is neither.
function cleanItem(item: string): string {
  const lower = item.trim().toLowerCase()
  const isFolder = lower.endsWith('/') && lower.length > 1
  const isEnding = lower.startsWith('.') && lower.length > 1 && !lower.includes('/')
  return isFolder || isEnding ? lower : ''
}

// The list as text items, or null when it is not a list of text.
function textList(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null
  }
  const items: string[] = []
  for (const item of value) {
    if (typeof item !== 'string') {
      return null
    }
    items.push(item)
  }
  return items
}

// Why an unlock item is refused, or '' when it is fine. Repo paths only.
function unlockProblem(item: string): string {
  const slashed = item.split('\\').join('/')
  if (slashed.split('/').includes('..')) {
    return 'it has ".."'
  }
  if (isAbsolute(item)) {
    return 'it is an absolute path'
  }
  if (splitPath(item.toLowerCase()).join('/') === '.claude/dry-run.json') {
    return 'it is the switch file'
  }
  return ''
}

// Keeps the items that are an ending or a folder. Each item left out adds a
// problem that names it. `key` is "lock" or "unlock".
function cleanItems(key: string, items: string[], problems: string[]): string[] {
  const kept: string[] = []
  for (const item of items) {
    const refusal = key === 'unlock' ? unlockProblem(item) : ''
    const clean = cleanItem(item)
    if (refusal !== '') {
      problems.push(`Repo file: "${key}" item ignored: ${item} (${refusal}).`)
    } else if (clean === '') {
      problems.push(`Repo file: "${key}" item ignored: ${item} (not an ending or a folder).`)
    } else {
      kept.push(clean)
    }
  }
  return kept
}

// The platform block of a value, or the reason its shape is bad. No side effects.
function checkPlatform(value: unknown): { platform: Platform } | { problem: string } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { problem: 'it must be an object with "agent" and "paths"' }
  }
  for (const key of Object.keys(value)) {
    if (key !== 'agent' && key !== 'paths') {
      return { problem: `unknown key "${key}"` }
    }
  }
  if (!('agent' in value) || typeof value.agent !== 'string' || value.agent.trim() === '') {
    return { problem: '"agent" must be a name' }
  }
  const paths = 'paths' in value ? textList(value.paths) : null
  if (paths === null || paths.length === 0) {
    return { problem: '"paths" must be a list of text with at least one item' }
  }
  for (const path of paths) {
    if (path.trim() === '') {
      return { problem: '"paths" has an empty item' }
    }
  }
  return { platform: { agent: value.agent.trim(), paths } }
}

// The platform block, or null when its shape is bad. A bad shape adds a problem.
function readPlatform(value: unknown, problems: string[]): Platform | null {
  const checked = checkPlatform(value)
  if ('problem' in checked) {
    problems.push(`Repo file: "platform" ignored: ${checked.problem}.`)
    return null
  }
  return checked.platform
}

// The mode this value names, or null when it names none.
function modeOf(value: unknown): Mode | null {
  for (const mode of MODES) {
    if (value === mode) {
      return mode
    }
  }
  return null
}

export function parseRepoFile(text: string): ParseResult {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return ignored('it is not valid JSON.')
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return ignored('it is not a JSON object.')
  }
  const map = data as Record<string, unknown>
  for (const key of Object.keys(map)) {
    if (!KNOWN_KEYS.includes(key)) {
      return ignored(`unknown key "${key}".`)
    }
  }

  const file = emptyRepoFile()
  const problems: string[] = []
  if (map.mode !== undefined) {
    const mode = modeOf(map.mode)
    if (mode === null) {
      return ignored('"mode" must be on, soft or off.')
    }
    file.mode = mode
    file.hasMode = true
  }
  for (const key of ['lock', 'unlock'] as const) {
    if (map[key] === undefined) {
      continue
    }
    const items = textList(map[key])
    if (items === null) {
      return ignored(`"${key}" must be a list of text.`)
    }
    file[key] = cleanItems(key, items, problems)
  }
  if (map.platform !== undefined) {
    file.platform = readPlatform(map.platform, problems)
  }
  return { file, problems }
}

// A repo file read back from the JSON text the mod stored in session state.
// Text that is not a whole, valid repo file gives the defaults.
export function restoreRepoFile(text: string): RepoFile {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return emptyRepoFile()
  }
  if (typeof data !== 'object' || data === null) {
    return emptyRepoFile()
  }
  const mode = 'mode' in data ? modeOf(data.mode) : null
  const lock = 'lock' in data ? textList(data.lock) : null
  const unlock = 'unlock' in data ? textList(data.unlock) : null
  const hasMode = 'hasMode' in data && typeof data.hasMode === 'boolean' ? data.hasMode : null
  if (mode === null || lock === null || unlock === null || hasMode === null || !('platform' in data)) {
    return emptyRepoFile()
  }
  if (data.platform === null) {
    return { mode, hasMode, lock, unlock, platform: null }
  }
  const checked = checkPlatform(data.platform)
  if ('problem' in checked) {
    return emptyRepoFile()
  }
  return { mode, hasMode, lock, unlock, platform: checked.platform }
}

// True when `names` begins with `prefix`.
function startsWith(names: string[], prefix: string[]): boolean {
  if (prefix.length > names.length) {
    return false
  }
  for (let i = 0; i < prefix.length; i++) {
    if (names[i] !== prefix[i]) {
      return false
    }
  }
  return true
}

// The path check rules of a repo file. A relative path counts from `cwd`.
// "" or UNKNOWN_ROOT as `gitRoot` means folders free nothing.
export function lockRulesFor(file: RepoFile, cwd: string, gitRoot: string): LockRules {
  const hasRoot = gitRoot !== '' && gitRoot !== UNKNOWN_ROOT
  const rootNames = hasRoot ? splitPath(gitRoot.toLowerCase()) : []
  const relativeNames = (path: string): string[] | null => {
    if (!hasRoot) {
      return null
    }
    const full = isAbsolute(path) ? path : cwd + '/' + path
    const names = splitPath(full.toLowerCase())
    return startsWith(names, rootNames) ? names.slice(rootNames.length) : null
  }
  return { lock: file.lock, unlock: file.unlock, relativeNames }
}
