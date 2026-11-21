import type { Args, EngineInterface, Next, Register } from 'claude-code'
import { namesLockedFile, namesSwitchFile } from './bash-scan'
import { isDryRun } from './dry-run-check'
import { isLocked } from './gate-path'
import { goWordKind } from './go-word'
import { candidateRoots, isSwitchFile } from './switch-file'
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

async function isSessionSet($: EngineInterface): Promise<boolean> {
  const read = await $.state.get(IS_SESSION_SET)
  return read.value === true
}

async function cwdOf($: EngineInterface): Promise<string> {
  const read = await $.state.get(CWD)
  return typeof read.value === 'string' ? read.value : ''
}

async function gitRootOf($: EngineInterface): Promise<string> {
  const read = await $.state.get(GIT_ROOT)
  return typeof read.value === 'string' ? read.value : ''
}

// The first folder, from the working folder up, that holds a `.git` entry. "" when none.
async function findGitRoot($: EngineInterface, cwd: string): Promise<string> {
  try {
    for (const folder of candidateRoots(cwd)) {
      const prefix = folder === '/' ? '' : folder
      if (await $.fs.exists(prefix + '/.git')) {
        return folder
      }
    }
  } catch {
    // A failed lookup must not stop the session start. No root means no switch file.
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
async function mustDeny($: EngineInterface, path: unknown): Promise<boolean> {
  const isSwitch = isSwitchFile(path, await cwdOf($), await gitRootOf($))
  if (!isSwitch) {
    if (await isOff($)) {
      return false
    }
    if (!isLocked(path, await homeDir($))) {
      return false
    }
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
  const cwd = await cwdOf($)
  const gitRoot = await gitRootOf($)
  const isSwitchWord = (word: string) => isSwitchFile(word, cwd, gitRoot)
  if (await isOff($)) {
    // Off frees code files. The switch file stays locked. A broken call is not ours to judge.
    const isHit = typeof command === 'string' && command.trim() !== '' && namesSwitchFile(command, isSwitchWord)
    return isHit && !(await isOpen($))
  }
  const isHit = namesSwitchFile(command, isSwitchWord) || namesLockedFile(command, await homeDir($))
  return isHit && !(await isOpen($))
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
  const engine = await $.session.version()
  const isTooOld = isOlderThan(engine.version, MIN_VERSION)
  await $.state.set(IS_OFF, isTooOld)
  if (isTooOld) {
    $.ui.toast(`dry-run mod needs Claude Code ${MIN_VERSION} or newer. It is off for this session.`)
    return
  }
  await registerCommands($)
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

// The text /dry-run shows: on or off, where that came from, and the gate.
async function statusText($: EngineInterface): Promise<string> {
  const source = (await isSessionSet($)) ? 'session' : 'default'
  if (await isOff($)) {
    return `dry-run mod: off (source: ${source}).`
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
    if ((e as Record<string, unknown>).reason === 'clear') {
      await lockGate($)
    }
    return next(e)
  })
  on('classic.SessionStart', async ($, e, next) => {
    if ((e as Record<string, unknown>).source === 'clear') {
      await lockGate($)
    }
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
