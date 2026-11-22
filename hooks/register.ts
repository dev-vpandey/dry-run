import type { Args, EngineInterface, Next, Register } from 'claude-code'
import { namesLockedFile, namesSwitchFile } from './bash-scan'
import { isDryRun } from './dry-run-check'
import { isLocked } from './gate-path'
import type { LockRules } from './gate-path'
import { emptyRepoFile, lockRulesFor, parseRepoFile } from './repo-file'
import type { ParseResult, RepoFile } from './repo-file'
import { goWordKind } from './go-word'
import { candidateRoots, isSwitchFile, UNKNOWN_ROOT } from './switch-file'
import { isOlderThan } from './version'

// The version floor. ci.yml names the same version; a test checks they match.
export const MIN_VERSION = '2.1.304'

const DENY_TEXT =
  'dry-run mod: edits locked. Post a "## Dry run" and wait for /go. (User escape: /dry-run off)'

// State keys. Both must be literals in source. A value never written reads
// as undefined, so "not open" is the safe default.
const IS_OPEN = { plugin: 'dry-run', key: 'isOpen' } as const
const IS_OFF = { plugin: 'dry-run', key: 'isOff' } as const
const IS_REGISTERED = { plugin: 'dry-run', key: 'isRegistered' } as const
// A dry run was posted and no go has covered it yet.
const IS_WAITING = { plugin: 'dry-run', key: 'isWaiting' } as const
// The gate was opened by "just do it" with no dry run. The pane shows "skipped".
const IS_SKIPPED = { plugin: 'dry-run', key: 'isSkipped' } as const

// The person ran /dry-run on or off this session. Without it the source is "default".
const IS_SESSION_SET = { plugin: 'dry-run', key: 'isSessionSet' } as const
// The working folder of the session, and the git root found from it ("" when none).
const CWD = { plugin: 'dry-run', key: 'cwd' } as const
const GIT_ROOT = { plugin: 'dry-run', key: 'gitRoot' } as const

// The repo file set `soft`: dry runs, no gate. The person's /dry-run on clears it.
const IS_SOFT = { plugin: 'dry-run', key: 'isSoft' } as const
// The engine is older than the floor. The mod stays off, whatever the repo file says.
const IS_TOO_OLD = { plugin: 'dry-run', key: 'isTooOld' } as const
// The parsed repo file as JSON text, and its platform block (for ticket 34).
const REPO_FILE = { plugin: 'dry-run', key: 'repoFile' } as const
const PLATFORM = { plugin: 'dry-run', key: 'platform' } as const
const IS_GATE_TOAST_SHOWN = { plugin: 'dry-run', key: 'isGateToastShown' } as const
const LAST_PROBLEMS = { plugin: 'dry-run', key: 'lastProblems' } as const

const REPO_FILE_PATH = '/.claude/dry-run.json'

const GO_NAME = 'go'
const DRY_RUN_NAME = 'dry-run'
const STOP_NAME = 'stop'
const STOP_FALLBACK_NAME = 'hold'

// True only when the flag was written as true. A flag never written reads as false.
// One function per flag on purpose: the engine needs each state key written
// out as a literal at the call site, so a shared helper cannot take the key.
async function isOff($: EngineInterface): Promise<boolean> {
  const read = await $.state.get(IS_OFF)
  return read.value === true
}

async function isOpen($: EngineInterface): Promise<boolean> {
  const read = await $.state.get(IS_OPEN)
  return read.value === true
}

async function isRegistered($: EngineInterface): Promise<boolean> {
  const read = await $.state.get(IS_REGISTERED)
  return read.value === true
}

async function isWaiting($: EngineInterface): Promise<boolean> {
  const read = await $.state.get(IS_WAITING)
  return read.value === true
}

async function isSoft($: EngineInterface): Promise<boolean> {
  const read = await $.state.get(IS_SOFT)
  return read.value === true
}

async function isTooOld($: EngineInterface): Promise<boolean> {
  const read = await $.state.get(IS_TOO_OLD)
  return read.value === true
}

async function isGateToastShown($: EngineInterface): Promise<boolean> {
  const read = await $.state.get(IS_GATE_TOAST_SHOWN)
  return read.value === true
}

// The repo file of this session. A file never read, or text that does not parse,
// gives the defaults.
async function repoFileOf($: EngineInterface): Promise<RepoFile> {
  const read = await $.state.get(REPO_FILE)
  if (typeof read.value !== 'string' || read.value === '') {
    return emptyRepoFile()
  }
  try {
    return JSON.parse(read.value) as RepoFile
  } catch {
    return emptyRepoFile()
  }
}

async function isSessionSet($: EngineInterface): Promise<boolean> {
  const read = await $.state.get(IS_SESSION_SET)
  return read.value === true
}

async function cwdOf($: EngineInterface): Promise<string> {
  const read = await $.state.get(CWD)
  return typeof read.value === 'string' ? read.value : ''
}

// A git root never written reads as unknown, so the switch file stays locked.
async function gitRootOf($: EngineInterface): Promise<string> {
  const read = await $.state.get(GIT_ROOT)
  return typeof read.value === 'string' ? read.value : UNKNOWN_ROOT
}

// A test for one path or word: is it the switch file of this session's repo?
async function switchFileCheck($: EngineInterface): Promise<(word: unknown) => boolean> {
  const cwd = await cwdOf($)
  const gitRoot = await gitRootOf($)
  return word => isSwitchFile(word, cwd, gitRoot)
}

// The path check rules from the repo file of this session.
async function lockRulesOf($: EngineInterface): Promise<LockRules> {
  return lockRulesFor(await repoFileOf($), await cwdOf($), await gitRootOf($))
}

// The first folder, from the working folder up, that holds a `.git` entry.
// "" when there is none. UNKNOWN_ROOT when the lookup itself failed.
async function findGitRoot($: EngineInterface, cwd: string): Promise<string> {
  try {
    for (const folder of candidateRoots(cwd)) {
      const prefix = folder === '/' ? '' : folder
      if (await $.fs.exists(prefix + '/.git')) {
        return folder
      }
    }
  } catch {
    // A failed lookup must not stop the session start, and must not free the switch file.
    return UNKNOWN_ROOT
  }
  return ''
}

// The edit tools the gate guards, and the field that holds each one's path.
const GUARDED_TOOLS = [
  { tool: 'Edit', pathField: 'file_path' },
  { tool: 'Write', pathField: 'file_path' },
  { tool: 'NotebookEdit', pathField: 'notebook_path' },
] as const

// The home folder, or "" when the environment does not say. Names are literals
// because the engine lists them. HOME first, then USERPROFILE (Windows).
async function homeDir($: EngineInterface): Promise<string> {
  const home = await $.env.get('HOME')
  if (home !== undefined && home !== '') {
    return home
  }
  return (await $.env.get('USERPROFILE')) ?? ''
}

// True when this edit must be denied. Throws when the tool call has no path.
// The switch file is locked in every mode, so /dry-run off does not free it.
// A bad path throws even when the mod is off: fail closed.
async function mustDeny($: EngineInterface, path: unknown): Promise<boolean> {
  const isSwitch = (await switchFileCheck($))(path)
  const isLockedFile = isLocked(path, await homeDir($), await lockRulesOf($))
  if (isSwitch) {
    return !(await isOpen($))
  }
  if ((await isOff($)) || (await isSoft($)) || !isLockedFile) {
    return false
  }
  return !(await isOpen($))
}

// Fail closed. If the guard threw before next, deny. If next already ran, replay it.
const failClosed = (_$: EngineInterface, e: Args<'tool.call'>, next: Next<'tool.call'>) =>
  next.called ? next(e) : { deny: DENY_TEXT }

// True when this Bash call must be denied. Throws when the call has no command.
// A call with `isReadOnly` set is a read, so it is never denied.
async function mustDenyBash($: EngineInterface, e: Args<'tool.check'>): Promise<boolean> {
  if (e.isReadOnly === true) {
    return false
  }
  const input = e.input as Record<string, unknown> | undefined
  const command = input?.command
  // The switch file is locked in every mode. No command throws, even when off.
  if (namesSwitchFile(command, await switchFileCheck($))) {
    return !(await isOpen($))
  }
  if ((await isOff($)) || (await isSoft($))) {
    return false
  }
  return namesLockedFile(command, await homeDir($), await lockRulesOf($)) && !(await isOpen($))
}

// Fail closed for tool.check: same rule as failClosed above.
const failClosedCheck = (_$: EngineInterface, e: Args<'tool.check'>, next: Next<'tool.check'>) =>
  next.called ? next(e) : { decision: 'deny' as const, reason: DENY_TEXT }

async function registerStopCommand($: EngineInterface): Promise<void> {
  const description = 'Lock the gate again. Edits to code files need a new /go.'
  try {
    await $.command.register({ name: STOP_NAME, description, immediate: true })
  } catch {
    await $.command.register({ name: STOP_FALLBACK_NAME, description, immediate: true })
    $.ui.toast(`dry-run mod: /${STOP_NAME} is taken. Use /${STOP_FALLBACK_NAME} instead.`)
  }
}

async function startSession($: EngineInterface, cwd: string): Promise<void> {
  await $.state.set(IS_OPEN, false)
  await $.state.set(IS_SESSION_SET, false)
  await $.state.set(CWD, cwd)
  await $.state.set(GIT_ROOT, await findGitRoot($, cwd))
  await $.state.set(IS_WAITING, false)
  await $.state.set(IS_SKIPPED, false)
  await $.state.set(IS_SOFT, false)
  await $.state.set(IS_GATE_TOAST_SHOWN, false)
  await $.state.set(LAST_PROBLEMS, '')
  const engine = await $.session.version()
  const isOld = isOlderThan(engine.version, MIN_VERSION)
  await $.state.set(IS_TOO_OLD, isOld)
  await $.state.set(IS_OFF, isOld)
  if (isOld) {
    $.ui.toast(`dry-run mod needs Claude Code ${MIN_VERSION} or newer. It is off for this session.`)
    return
  }
  await loadRepoFile($)
  await registerCommands($)
}

// The text of the repo file, or null when the session has no git root or the
// file is not there. Throws when the file cannot be read.
async function readRepoFileText($: EngineInterface): Promise<string | null> {
  const gitRoot = await gitRootOf($)
  if (gitRoot === '' || gitRoot === UNKNOWN_ROOT) {
    return null
  }
  const path = (gitRoot === '/' ? '' : gitRoot) + REPO_FILE_PATH
  if (!(await $.fs.exists(path))) {
    return null
  }
  const text = await $.fs.read(path)
  if (typeof text !== 'string') {
    throw new Error('repo file: not text')
  }
  return text
}

// Parses the repo file. A file that cannot be read is a bad file.
async function parseRepoFileOf($: EngineInterface): Promise<ParseResult> {
  try {
    const text = await readRepoFileText($)
    return text === null ? { file: emptyRepoFile(), problems: [] } : parseRepoFile(text)
  } catch {
    return { file: emptyRepoFile(), problems: ['Repo file ignored: it could not be read.'] }
  }
}

// One toast per problem. The same set of problems is not shown twice in a row,
// because a /clear raises two signals.
async function showProblems($: EngineInterface, problems: string[]): Promise<void> {
  const key = problems.join('\n')
  const last = await $.state.get(LAST_PROBLEMS)
  if (key === last.value) {
    return
  }
  await $.state.set(LAST_PROBLEMS, key)
  for (const problem of problems) {
    $.ui.toast(problem)
  }
}

// Once per session, when the repo file takes the gate down.
async function showGateDown($: EngineInterface, file: RepoFile): Promise<void> {
  const isDown = file.mode !== 'on' || file.unlock.length > 0
  if (!isDown || (await isGateToastShown($)) || (await isSessionSet($))) {
    return
  }
  await $.state.set(IS_GATE_TOAST_SHOWN, true)
  $.ui.toast(`Repo sets dry-run mod: ${file.mode}. \`/dry-run on\` to lock.`)
}

// Reads the repo file at session start and after /clear. The repo sets the start
// state. The person's /dry-run on or off wins, so it is never overwritten here.
async function loadRepoFile($: EngineInterface): Promise<void> {
  // An engine below the floor keeps the mod off, so the repo file means nothing.
  if (await isTooOld($)) {
    return
  }
  const result = await parseRepoFileOf($)
  await $.state.set(REPO_FILE, JSON.stringify(result.file))
  await $.state.set(PLATFORM, result.file.platform === null ? '' : JSON.stringify(result.file.platform))
  await showProblems($, result.problems)
  if (!(await isSessionSet($))) {
    await $.state.set(IS_OFF, result.file.mode === 'off')
    await $.state.set(IS_SOFT, result.file.mode === 'soft')
  }
  await showGateDown($, result.file)
}

// Register /go and /stop once. A second session.start must not register them again.
async function registerCommands($: EngineInterface): Promise<void> {
  if (await isRegistered($)) {
    return
  }
  await $.command.register({ name: GO_NAME, description: 'Approve the dry run. Edits open.' })
  await registerStopCommand($)
  await $.command.register({ name: DRY_RUN_NAME, description: 'Show, or set, the dry-run mod: on or off.' })
  await $.state.set(IS_REGISTERED, true)
}

// One go opens the gate. It ends the waiting mark and sets the skipped mark
// to the given value (true only for "just do it" with no dry run).
async function openGate($: EngineInterface, isSkipped: boolean): Promise<void> {
  await $.state.set(IS_OPEN, true)
  await $.state.set(IS_WAITING, false)
  await $.state.set(IS_SKIPPED, isSkipped)
}

// The text /dry-run shows: the mode, where it came from, and the gate.
async function statusText($: EngineInterface): Promise<string> {
  let source = 'default'
  if (await isSessionSet($)) {
    source = 'session'
  } else if ((await repoFileOf($)).hasMode) {
    source = 'repo'
  }
  if (await isOff($)) {
    return `dry-run mod: off (source: ${source}).`
  }
  if (await isSoft($)) {
    return `dry-run mod: soft (source: ${source}). No gate.`
  }
  const gate = (await isOpen($)) ? 'open' : 'locked'
  return `dry-run mod: on (source: ${source}). Gate ${gate}.`
}

// /dry-run, /dry-run on and /dry-run off. Anything else shows the usage.
async function runDryRunCommand($: EngineInterface, args: string): Promise<{ text: string }> {
  const word = args.trim().toLowerCase()
  if (word === 'off') {
    await $.state.set(IS_OFF, true)
    await $.state.set(IS_SESSION_SET, true)
  } else if (word === 'on') {
    await $.state.set(IS_OFF, false)
    await $.state.set(IS_SOFT, false)
    await $.state.set(IS_SESSION_SET, true)
    await lockGate($)
  } else if (word !== '') {
    return { text: 'Use /dry-run, /dry-run on or /dry-run off.' }
  }
  return { text: await statusText($) }
}

// A new dry run locks the gate and waits for the next go.
async function waitForGo($: EngineInterface): Promise<void> {
  await $.state.set(IS_OPEN, false)
  await $.state.set(IS_WAITING, true)
  await $.state.set(IS_SKIPPED, false)
}

// The section 8 rule needs the explainLanguage setting. That setting is not
// built yet, so it is empty and section 8 is never required for now.
const EXPLAIN_LANGUAGE = ''

// True when this prompt is the person's own words: typed at the terminal or sent
// from a phone or web client. Not a command, not hidden, not a subagent, and not
// a notification, a peer, a plugin or an SDK host.
function isFromPerson(e: Args<'prompt.submit'>): boolean {
  const isPersonOrigin = e.origin.kind === 'composer' || e.origin.kind === 'bridge'
  return isPersonOrigin && e.command === undefined && e.isMeta !== true && isMainLoop(e)
}

// Event types do not list agentId on every event. It is set only inside a subagent.
function isMainLoop(e: object): boolean {
  return (e as Record<string, unknown>).agentId === undefined
}

// Locks the gate when the event has `field` equal to `value`, and reads the repo
// file again. Used for "clear".
async function lockWhen($: EngineInterface, e: object, field: string, value: string): Promise<void> {
  if ((e as Record<string, unknown>)[field] === value) {
    await lockGate($)
    await loadRepoFile($)
  }
}

async function lockGate($: EngineInterface) {
  await $.state.set(IS_OPEN, false)
  await $.state.set(IS_WAITING, false)
  await $.state.set(IS_SKIPPED, false)
  return { text: '⊘ Gate locked. Edits to code files are blocked.' }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await startSession($, e.cwd)
    return next(e)
  })

  // A real /clear raises session.end with reason "clear", and no session.start.
  // The classic SessionStart with source "clear" is the second signal. Either one
  // locks the gate. /dry-run off stays: it holds for the whole session.
  on('session.end', async ($, e, next) => {
    await lockWhen($, e, 'reason', 'clear')
    return next(e)
  })
  on('classic.SessionStart', async ($, e, next) => {
    await lockWhen($, e, 'source', 'clear')
    return next(e)
  })

  for (const guarded of GUARDED_TOOLS) {
    on('tool.call', { tool: guarded.tool }, async ($, e, next) => {
      const path = (e as Record<string, unknown>)[guarded.pathField]
      return (await mustDeny($, path)) ? { deny: DENY_TEXT } : next(e)
    }).catch(failClosed)
  }

  // Bash may write a file. Deny when it names a locked file and is not read-only.
  on('tool.check', { tool: 'Bash' }, async ($, e, next) => {
    return (await mustDenyBash($, e)) ? { decision: 'deny', reason: DENY_TEXT } : next(e)
  }).catch(failClosedCheck)

  // A dry run posted by the main thread locks the gate and waits for a go.
  // Lock first, then next(e): if next throws, the gate is already locked.
  on('turn.complete', async ($, e, next) => {
    const answer = (e as Record<string, unknown>).answer
    if (isMainLoop(e) && !(await isOff($)) && isDryRun(answer, EXPLAIN_LANGUAGE)) {
      await waitForGo($)
    }
    return next(e)
  })

  // A go word, sent as the whole message, opens the gate.
  on('prompt.submit', async ($, e, next) => {
    if (!isFromPerson(e) || (await isOff($))) {
      return next(e)
    }
    const kind = goWordKind(e.text)
    if (kind === 'none') {
      return next(e)
    }
    if (await isWaiting($)) {
      await openGate($, false)
      return next(e)
    }
    if (kind === 'just-do-it') {
      // Gate already open: nothing to unlock, and the open dry run stays as it is.
      if (!(await isOpen($))) {
        await openGate($, true)
      }
      return next(e)
    }
    return { drop: 'no dry run to approve' }
  })

  on('command.run', { command: GO_NAME }, async $ => {
    await openGate($, false)
    return { text: '✓ Gate open. Edits allowed for this dry run.' }
  })

  on('command.run', { command: DRY_RUN_NAME }, ($, e) => runDryRunCommand($, e.args))

  for (const name of [STOP_NAME, STOP_FALLBACK_NAME]) {
    on('command.run', { command: name }, $ => lockGate($))
  }
}
