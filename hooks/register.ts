import type { Args, EngineInterface, Next, Register } from 'claude-code'
import { isLocked } from './gate-path'
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

const GO_NAME = 'go'
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
async function mustDeny($: EngineInterface, path: unknown): Promise<boolean> {
  if (await isOff($)) {
    return false
  }
  if (!isLocked(path, await homeDir($))) {
    return false
  }
  return !(await isOpen($))
}

// Fail closed. If the guard threw before next, deny. If next already ran, replay it.
const failClosed = (_$: EngineInterface, e: Args<'tool.call'>, next: Next<'tool.call'>) =>
  next.called ? next(e) : { deny: DENY_TEXT }

async function registerStopCommand($: EngineInterface): Promise<void> {
  const description = 'Lock the gate again. Edits to code files need a new /go.'
  try {
    await $.command.register({ name: STOP_NAME, description, immediate: true })
  } catch {
    await $.command.register({ name: STOP_FALLBACK_NAME, description, immediate: true })
    $.ui.toast(`dry-run mod: /${STOP_NAME} is taken. Use /${STOP_FALLBACK_NAME} instead.`)
  }
}

async function startSession($: EngineInterface): Promise<void> {
  await $.state.set(IS_OPEN, false)
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
  await $.state.set(IS_REGISTERED, true)
}

async function lockGate($: EngineInterface) {
  await $.state.set(IS_OPEN, false)
  return { text: '⊘ Gate locked. Edits to code files are blocked.' }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await startSession($)
    return next(e)
  })

  for (const guarded of GUARDED_TOOLS) {
    on('tool.call', { tool: guarded.tool }, async ($, e, next) => {
      const path = (e as Record<string, unknown>)[guarded.pathField]
      return (await mustDeny($, path)) ? { deny: DENY_TEXT } : next(e)
    }).catch(failClosed)
  }

  on('command.run', { command: GO_NAME }, async $ => {
    await $.state.set(IS_OPEN, true)
    return { text: '✓ Gate open. Edits allowed for this dry run.' }
  })

  for (const name of [STOP_NAME, STOP_FALLBACK_NAME]) {
    on('command.run', { command: name }, $ => lockGate($))
  }
}
