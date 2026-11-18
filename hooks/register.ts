import type { EngineInterface, Register } from 'claude-code'
import { isLocked } from './gate-path'
import { isOlderThan } from './version'

const MIN_VERSION = '2.1.304'

const DENY_TEXT =
  'dry-run mod: edits locked. Post a "## Dry run" and wait for /go. (User escape: /dry-run off)'

// State keys. Both must be literals in source. A value never written reads
// as undefined, so "not open" is the safe default.
const IS_OPEN = { plugin: 'dry-run', key: 'isOpen' } as const
const IS_OFF = { plugin: 'dry-run', key: 'isOff' } as const

const STOP_NAME = 'stop'
const STOP_FALLBACK_NAME = 'hold'

async function isOff($: EngineInterface): Promise<boolean> {
  const read = await $.state.get(IS_OFF)
  return read.value === true
}

async function isOpen($: EngineInterface): Promise<boolean> {
  const read = await $.state.get(IS_OPEN)
  return read.value === true
}

// True when this edit must be denied. Throws when the tool call has no path.
async function mustDeny($: EngineInterface, path: unknown): Promise<boolean> {
  if (await isOff($)) {
    return false
  }
  if (!isLocked(path)) {
    return false
  }
  return !(await isOpen($))
}

// Fail closed. If the guard threw before next, deny. If next already ran, replay it.
const failClosed = (_$: EngineInterface, e: any, next: any) =>
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
  await $.command.register({ name: 'go', description: 'Approve the dry run. Edits open.' })
  await registerStopCommand($)
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

  on('tool.call', { tool: 'Edit' }, async ($, e, next) =>
    (await mustDeny($, e.file_path)) ? { deny: DENY_TEXT } : next(e),
  ).catch(failClosed)

  on('tool.call', { tool: 'Write' }, async ($, e, next) =>
    (await mustDeny($, e.file_path)) ? { deny: DENY_TEXT } : next(e),
  ).catch(failClosed)

  on('tool.call', { tool: 'NotebookEdit' }, async ($, e, next) =>
    (await mustDeny($, e.notebook_path)) ? { deny: DENY_TEXT } : next(e),
  ).catch(failClosed)

  on('command.run', { command: 'go' }, async $ => {
    await $.state.set(IS_OPEN, true)
    return { text: '✓ Gate open. Edits allowed for this dry run.' }
  })

  on('command.run', { command: STOP_NAME }, $ => lockGate($))
  on('command.run', { command: STOP_FALLBACK_NAME }, $ => lockGate($))
}
