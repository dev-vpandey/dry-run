import type { AgentLoop, Args, On, ToolCallArgs } from 'claude-code'
import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

// Written out here on purpose: the test must not share the mod's constant.
const DENY_TEXT =
  'dry-run mod: edits locked. Post a "## Dry run" and wait for /go. (User escape: /dry-run off)'

// What the engine adds to a command the person typed.
const TYPED = { args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } } satisfies Omit<Args<'command.run'>, 'command'>

function run($: Engine, command: string) {
  return $.command.run({ command, ...TYPED })
}

const EDIT_LOCKED = { tool: 'Edit', file_path: 'src/Foo.py', old_string: 'a', new_string: 'b' } satisfies ToolCallArgs
const EDIT_FREE = { tool: 'Edit', file_path: 'README.md', old_string: 'a', new_string: 'b' } satisfies ToolCallArgs

// A full SessionEndInput: the engine always sends the session id and the resume id.
function sessionEnd(reason: 'clear' | 'other') {
  return { reason, sessionId: 'session-1', resume: { id: 'session-1' } }
}

type Stubs = {
  version?: string
  refuseCommand?: string
  home?: string
  gitRoot?: string
  existsThrows?: boolean
  // The text of `<gitRoot>/.claude/dry-run.json`. Undefined means the file is not there.
  repoFile?: string
  readThrows?: boolean
  // The tool.call stub beneath the mod throws.
  toolCallThrows?: boolean
  // Rule files of the plugin, by path under `templates/`.
  bundled?: Record<string, string>
  // The user's copies, by path under `~/.claude/dry-run/templates/`.
  overrides?: Record<string, string>
  // The engine refuses `$.tool.register`, as an org with allowedMcpServers does.
  refuseTool?: boolean
  // The variable that holds the home folder. HOME when left out.
  homeVar?: 'HOME' | 'USERPROFILE'
  // Overrides that exist but cannot be read, by path under `~/.claude/dry-run/templates/`.
  unreadable?: string[]
  // The first prompt that reaches the bottom is dropped, as a hook beneath may do.
  dropFirstPrompt?: boolean
}

const OVERRIDE_DIR = '/Users/me/.claude/dry-run/templates/'

// The text of a rule file the stubs hold, or undefined when none is there.
function ruleFileText(stubs: Stubs, path: string): string | undefined {
  for (const [relative, text] of Object.entries(stubs.overrides ?? {})) {
    if (path === OVERRIDE_DIR + relative) {
      return text
    }
  }
  for (const [relative, text] of Object.entries(stubs.bundled ?? {})) {
    if (path.endsWith('/templates/' + relative) && !path.startsWith(OVERRIDE_DIR)) {
      return text
    }
  }
  return undefined
}

// Each hook here stands for the engine, beneath the mod.
// The mod forwards each of these events with next(e), so each needs a stub.
function stubEngine(on: On, stubs: Stubs = {}) {
  // Blocked-edit toasts are kept apart, so the older tests count only their own toasts.
  const toasts: string[] = []
  const blocked: string[] = []
  const statuses: (string | undefined)[] = []
  const panes: string[] = []
  const registered: string[] = []
  const reads: string[] = []
  const contexts: (readonly string[] | undefined)[] = []
  const tools: string[] = []
  let isStateBroken = false
  on('session.start', (_: unknown, e: { cwd: string }) => ({ cwd: e.cwd }))
  on('session.version', () => ({ value: { version: stubs.version ?? '2.1.326' } }))
  on('command.register', (_: unknown, e: { name: string }) => {
    if (e.name === stubs.refuseCommand) {
      return { deny: 'a built-in has this name' }
    }
    registered.push(e.name)
    return { value: { command: e.name } }
  })
  on('ui.toast', (_: unknown, e: { text: string }) => {
    ;(e.text.startsWith('⊘ Blocked') ? blocked : toasts).push(e.text)
    return { value: undefined }
  })
  on('ui.open', (_: unknown, e: { id: string }) => {
    panes.push(e.id)
    return { value: { isPlaced: true } }
  })
  on('ui.status', (_: unknown, e: { text: string | undefined }) => {
    statuses.push(e.text)
    return { value: undefined }
  })
  on('env.get', (_: unknown, e: { name: string }) => ({ value: e.name === (stubs.homeVar ?? 'HOME') ? (stubs.home ?? '/Users/me') : undefined }))
  on('session.end', () => ({ sessionId: 's1' }))
  on('classic.SessionStart', () => ({}))
  on('session.compact', (_: unknown, e: Args<'session.compact'>) => ({ messages: e.messages }))
  // The folder that holds `.git`. Only this one exists, so the walk finds it.
  on('fs.exists', (_: unknown, e: { path: string }) => {
    if (stubs.existsThrows) {
      return { deny: 'disk error' }
    }
    const isGit = stubs.gitRoot !== undefined && e.path === stubs.gitRoot + '/.git'
    const isRepoFile = stubs.repoFile !== undefined && e.path === stubs.gitRoot + '/.claude/dry-run.json'
    const isUnreadable = (stubs.unreadable ?? []).some(relative => e.path === OVERRIDE_DIR + relative)
    return { value: isGit || isRepoFile || isUnreadable || ruleFileText(stubs, e.path) !== undefined }
  })
  on('fs.read', (_: unknown, e: { path: string }) => {
    reads.push(e.path)
    if (stubs.readThrows) {
      return { deny: 'disk error' }
    }
    if ((stubs.unreadable ?? []).some(relative => e.path === OVERRIDE_DIR + relative)) {
      return { deny: 'disk error' }
    }
    const rule = ruleFileText(stubs, e.path)
    if (rule !== undefined) {
      return { value: rule }
    }
    // A rule file that is not there fails the read, as on disk.
    if (e.path.includes('/templates/')) {
      return { deny: 'no such file' }
    }
    return { value: stubs.repoFile ?? '' }
  })
  // Once broken, every state read throws, so each guard throws before it calls next.
  on('state.get', (_, e, next) => (isStateBroken ? { deny: 'state down' } : next(e)))
  on('tool.call', () => {
    if (stubs.toolCallThrows) {
      throw new Error('beneath failed')
    }
    return { result: {} }
  })
  on('tool.check', () => ({ decision: 'allow', reason: 'stub' }))
  on('tool.register', (_: unknown, e: { name: string }) => {
    if (stubs.refuseTool) {
      return { deny: 'allowedMcpServers is set' }
    }
    tools.push(e.name)
    return { value: { tool: 'mcp__dry-run__' + e.name } }
  })
  on('prompt.submit', (_: unknown, e: { text: string; context?: readonly string[] }) => {
    contexts.push(e.context)
    if (stubs.dropFirstPrompt && contexts.length === 1) {
      return { drop: 'dropped beneath' }
    }
    return { text: e.text }
  })
  on('turn.complete', (_: unknown, e: { answer: string }) => ({ text: e.answer }))
  return { toasts, blocked, statuses, panes, registered, reads, contexts, tools, breakState: () => { isStateBroken = true } }
}

async function start($: Engine, cwd: string = '/') {
  await $.session.start({ cwd, surface: 'terminal', isInteractive: true })
}

test('a locked file is denied with the deny text, a free file passes', async ($, on) => {
  stubEngine(on)
  await start($)

  expect(await $.tool.call(EDIT_LOCKED)).toEqual({ deny: DENY_TEXT })
  expect(await $.tool.call(EDIT_FREE)).toEqual({ result: {} })
})

test('Write and NotebookEdit on a locked file are denied', async ($, on) => {
  stubEngine(on)
  await start($)

  expect(await $.tool.call(WRITE_LOCKED)).toEqual({ deny: DENY_TEXT })
  expect(await $.tool.call(NOTEBOOK_LOCKED)).toEqual({ deny: DENY_TEXT })
})

test('/go opens the gate and /stop locks it again', async ($, on) => {
  stubEngine(on)
  await start($)

  await run($, 'go')
  expect(await $.tool.call(EDIT_LOCKED)).toEqual({ result: {} })

  await run($, 'stop')
  expect(await $.tool.call(EDIT_LOCKED)).toEqual({ deny: DENY_TEXT })
})

test('a new session locks the gate again', async ($, on) => {
  stubEngine(on)
  await start($)
  await run($, 'go')

  await start($)

  expect(await $.tool.call(EDIT_LOCKED)).toEqual({ deny: DENY_TEXT })
})

const WRITE_LOCKED = { tool: 'Write', file_path: 'src/Foo.py', content: 'x' } satisfies ToolCallArgs
const NOTEBOOK_LOCKED = { tool: 'NotebookEdit', notebook_path: 'a/nb.ipynb', new_source: 'x' } satisfies ToolCallArgs

test('fail closed: an Edit, Write or NotebookEdit hook that throws denies the call', async ($, on) => {
  const { breakState } = stubEngine(on)
  await start($)
  await run($, 'go')
  breakState()

  expect(await $.tool.call(EDIT_FREE)).toEqual({ deny: DENY_TEXT })
  expect(await $.tool.call(WRITE_LOCKED)).toEqual({ deny: DENY_TEXT })
  expect(await $.tool.call(NOTEBOOK_LOCKED)).toEqual({ deny: DENY_TEXT })
})

// The stub beneath throws and is skipped, so next(e) rejects with the engine's
// own error, not the stub's. The call fails with that error instead of a deny.
test('fail closed: when the hook fails after next ran, the call fails with that error, not a deny', async ($, on) => {
  stubEngine(on, { toolCallThrows: true })
  await start($)

  const outcome = await $.tool.call(EDIT_FREE).then(
    answer => ({ answer, error: '' }),
    (error: unknown) => ({ answer: undefined, error: error instanceof Error ? `${error.name}: ${error.message}` : 'not an error' })
  )

  expect(outcome).toEqual({ answer: undefined, error: 'HooksError: no implementation for tool.call' })
})

test('fail closed: a Bash check that throws denies the check', async ($, on) => {
  const { breakState } = stubEngine(on)
  await start($)
  await run($, 'go')
  breakState()

  expect(await $.tool.check(BASH_SAFE)).toEqual({ decision: 'deny', reason: DENY_TEXT })
})

test('an engine older than 2.1.304 gets a toast and the mod stays off', async ($, on) => {
  const { toasts, statuses } = stubEngine(on, { version: '2.1.200' })
  await start($)

  expect(toasts.length).toBe(1)
  expect(toasts[0]).toContain('2.1.304')
  expect(statuses[statuses.length - 1]).toBeUndefined()
  expect(await $.tool.call(EDIT_LOCKED)).toEqual({ result: {} })
})

test('2.1.304 exactly is new enough', async ($, on) => {
  const { toasts } = stubEngine(on, { version: '2.1.304' })
  await start($)

  expect(toasts.length).toBe(0)
  expect(await $.tool.call(EDIT_LOCKED)).toEqual({ deny: DENY_TEXT })
})

test('/go and /stop are registered at start', async ($, on) => {
  const { registered } = stubEngine(on)
  await start($)

  expect(registered).toEqual(['go', 'stop', 'dry-run'])
})

test('when /stop clashes, /hold takes its place', async ($, on) => {
  const { registered } = stubEngine(on, { refuseCommand: 'stop' })
  await start($)
  await run($, 'go')

  expect(registered).toEqual(['go', 'hold', 'dry-run'])
  await run($, 'hold')
  expect(await $.tool.call(EDIT_LOCKED)).toEqual({ deny: DENY_TEXT })
})

test('a repo plans folder is locked, the home plans folder is free', async ($, on) => {
  stubEngine(on, { home: '/Users/me' })
  await start($)

  const repoPlans = { tool: 'Edit', file_path: '/repo/.claude/plans/x.py', old_string: 'a', new_string: 'b' } satisfies ToolCallArgs
  const homePlans = { tool: 'Edit', file_path: '/Users/me/.claude/plans/x.py', old_string: 'a', new_string: 'b' } satisfies ToolCallArgs
  expect(await $.tool.call(repoPlans)).toEqual({ deny: DENY_TEXT })
  expect(await $.tool.call(homePlans)).toEqual({ result: {} })
})

test('the session scratchpad is free', async ($, on) => {
  stubEngine(on)
  await start($)

  const scratch = { tool: 'Edit', file_path: '/private/tmp/claude-501/p/s1/scratchpad/a.py', old_string: 'a', new_string: 'b' } satisfies ToolCallArgs
  expect(await $.tool.call(scratch)).toEqual({ result: {} })
})

test('a second session.start registers /go and /stop only once', async ($, on) => {
  const { registered } = stubEngine(on)
  await start($)
  await start($)

  expect(registered).toEqual(['go', 'stop', 'dry-run'])
})

// ---- dry run detect and go words (ticket 22) ----

const DRY_RUN = [
  '## Dry run',
  '### 1. Bug and goal',
  '### 2. Change table',
  '| `src/Foo.java` | edit | why |',
  '### 3. SOLID',
  '### 4. Pattern',
  '### 5. DSA',
  '### 6. Worked example',
  '### 7. Open decisions',
].join('\n')

const NO_DRY_RUN = '## Dry run\n### 1. Bug and goal\nonly two headings'

function submit($: Engine, text: string, extra: object = {}) {
  return $.prompt.submit({ text, wait: false, origin: { kind: 'composer' }, ...extra })
}

function complete($: Engine, answer: string, extra: object = {}) {
  return $.turn.complete({ answer, reason: 'answer', durationMs: 0, isAborted: false, turnId: 'turn-1', ...extra })
}

test('a dry run locks the gate, a go word opens it', async ($, on) => {
  stubEngine(on)
  await start($)
  await run($, 'go')

  await complete($, DRY_RUN)
  expect(await $.tool.call(EDIT_LOCKED)).toEqual({ deny: DENY_TEXT })

  await submit($, 'go ahead')
  expect(await $.tool.call(EDIT_LOCKED)).toEqual({ result: {} })
})

test('a message with a heading missing is not a dry run: the gate stays as it was', async ($, on) => {
  stubEngine(on)
  await start($)
  await run($, 'go')

  await complete($, NO_DRY_RUN)

  expect(await $.tool.call(EDIT_LOCKED)).toEqual({ result: {} })
})

test('relock: a new dry run after a go locks the gate again', async ($, on) => {
  stubEngine(on)
  await start($)
  await complete($, DRY_RUN)
  await submit($, 'go')
  expect(await $.tool.call(EDIT_LOCKED)).toEqual({ result: {} })

  await complete($, DRY_RUN)
  expect(await $.tool.call(EDIT_LOCKED)).toEqual({ deny: DENY_TEXT })

  await submit($, 'go')
  expect(await $.tool.call(EDIT_LOCKED)).toEqual({ result: {} })
})

test('one go covers one dry run: a second go word with nothing waiting is dropped', async ($, on) => {
  stubEngine(on)
  await start($)
  await complete($, DRY_RUN)
  await submit($, 'go')

  expect(await submit($, 'go')).toEqual({ drop: 'no dry run to approve' })
})

test('a longer message is not a go', async ($, on) => {
  stubEngine(on)
  await start($)
  await complete($, DRY_RUN)

  await submit($, 'go ahead and fix tests too')

  expect(await $.tool.call(EDIT_LOCKED)).toEqual({ deny: DENY_TEXT })
})

test('no dry run waiting: go is dropped, just do it opens the gate', async ($, on) => {
  stubEngine(on)
  await start($)

  expect(await submit($, 'go ahead')).toEqual({ drop: 'no dry run to approve' })
  expect(await $.tool.call(EDIT_LOCKED)).toEqual({ deny: DENY_TEXT })

  expect(await submit($, 'just do it')).toEqual({ text: 'just do it' })
  expect(await $.tool.call(EDIT_LOCKED)).toEqual({ result: {} })
})

test('a go word from a subagent, a hidden prompt, a command or a notification is not a go', async ($, on) => {
  stubEngine(on)
  await start($)
  await complete($, DRY_RUN)

  await submit($, 'go', { agentId: 'a1' })
  await submit($, 'go', { isMeta: true })
  await submit($, 'go', { origin: { kind: 'notification' } })
  await submit($, 'go', { command: { name: 'x' } })

  expect(await $.tool.call(EDIT_LOCKED)).toEqual({ deny: DENY_TEXT })
})

test('a dry run written by a subagent does not wait for a go', async ($, on) => {
  stubEngine(on)
  await start($)
  await run($, 'go')

  await complete($, DRY_RUN, { agentId: 'a1' })

  expect(await $.tool.call(EDIT_LOCKED)).toEqual({ result: {} })
})

test('/stop and a new session clear the waiting dry run', async ($, on) => {
  stubEngine(on)
  await start($)
  await complete($, DRY_RUN)
  await run($, 'stop')
  expect(await submit($, 'go')).toEqual({ drop: 'no dry run to approve' })

  await complete($, DRY_RUN)
  await start($)
  expect(await submit($, 'go')).toEqual({ drop: 'no dry run to approve' })
})

test('a go word sent from the Remote Control bridge counts as a go', async ($, on) => {
  stubEngine(on)
  await start($)
  await complete($, DRY_RUN)

  await submit($, 'go', { origin: { kind: 'bridge' } })

  expect(await $.tool.call(EDIT_LOCKED)).toEqual({ result: {} })
})

test('a go word from an SDK host or a plugin is not a go', async ($, on) => {
  stubEngine(on)
  await start($)
  await complete($, DRY_RUN)

  await submit($, 'go', { origin: { kind: 'sdk' } })
  await submit($, 'go', { origin: { kind: 'plugin' } })

  expect(await $.tool.call(EDIT_LOCKED)).toEqual({ deny: DENY_TEXT })
})

test('when the mod is off, a dry run and a go word change nothing', async ($, on) => {
  stubEngine(on, { version: '2.1.200' })
  await start($)

  await complete($, DRY_RUN)
  expect(await submit($, 'go')).toEqual({ text: 'go' })
  expect(await $.tool.call(EDIT_LOCKED)).toEqual({ result: {} })
})

test('just do it with the gate already open passes through and the gate stays open', async ($, on) => {
  stubEngine(on)
  await start($)
  await complete($, DRY_RUN)
  await submit($, 'go')

  expect(await submit($, 'just do it')).toEqual({ text: 'just do it' })
  expect(await $.tool.call(EDIT_LOCKED)).toEqual({ result: {} })
})

// ---- Bash deny (ticket 23) ----

const BASH_WRITE = { tool: 'Bash', input: { command: 'echo x > src/foo.py' } } satisfies Args<'tool.check'>
const BASH_SAFE = { tool: 'Bash', input: { command: 'pytest tests/' } } satisfies Args<'tool.check'>

test('Bash: a command that writes a locked file is denied with the deny text', async ($, on) => {
  stubEngine(on)
  await start($)

  expect(await $.tool.check(BASH_WRITE)).toEqual({ decision: 'deny', reason: DENY_TEXT })
  expect((await $.tool.check(BASH_SAFE)).decision).toBe('allow')
})

test('Bash: a read-only command that names a locked file is allowed', async ($, on) => {
  stubEngine(on)
  await start($)

  const read = { tool: 'Bash', input: { command: 'cat src/foo.py' }, isReadOnly: true } satisfies Args<'tool.check'>
  expect((await $.tool.check(read)).decision).toBe('allow')
})

test('Bash: after /go the write is allowed, after /stop it is denied again', async ($, on) => {
  stubEngine(on)
  await start($)
  await run($, 'go')
  expect((await $.tool.check(BASH_WRITE)).decision).toBe('allow')

  await run($, 'stop')
  expect((await $.tool.check(BASH_WRITE)).decision).toBe('deny')
})

test('Bash: when the mod is off, a write is allowed', async ($, on) => {
  stubEngine(on, { version: '2.1.200' })
  await start($)

  expect((await $.tool.check(BASH_WRITE)).decision).toBe('allow')
})

test('fail closed: a Bash call with no command is denied, even with the gate open', async ($, on) => {
  stubEngine(on)
  await start($)
  expect(await $.tool.check({ tool: 'Bash', input: {} })).toEqual({ decision: 'deny', reason: DENY_TEXT })

  await run($, 'go')
  expect(await $.tool.check({ tool: 'Bash', input: {} })).toEqual({ decision: 'deny', reason: DENY_TEXT })
})

// ---- session lifecycle and /dry-run (ticket 24) ----

// What a typed `/dry-run off` carries: the same fields as TYPED plus the args.
async function dryRun($: Engine, args: string): Promise<{ text?: string }> {
  return $.command.run({ command: 'dry-run', ...TYPED, args })
}

const SWITCH = { tool: 'Edit', file_path: '/repo/.claude/dry-run.json', old_string: 'a', new_string: 'b' } satisfies ToolCallArgs
const BASH_SWITCH = { tool: 'Bash', input: { command: 'echo {} > /repo/.claude/dry-run.json' } } satisfies Args<'tool.check'>
const SUBAGENT_EDIT = { ...EDIT_LOCKED, agentId: 'a1' } satisfies ToolCallArgs & AgentLoop

async function startInRepo($: Engine, on: On, stubs: Stubs = {}) {
  stubEngine(on, { gitRoot: '/repo', ...stubs })
  await start($, '/repo/src')
}

test('/dry-run off: no gate this session. /dry-run on: gate locked again', async ($, on) => {
  stubEngine(on)
  await start($)
  await run($, 'go')

  await dryRun($, 'off')
  expect(await $.tool.call(EDIT_LOCKED)).toEqual({ result: {} })

  await dryRun($, 'on')
  expect(await $.tool.call(EDIT_LOCKED)).toEqual({ deny: DENY_TEXT })
})

test('/dry-run shows the state and where it came from', async ($, on) => {
  stubEngine(on)
  await start($)

  expect((await dryRun($, '')).text).toBe('dry-run mod: on (source: default). Gate locked.')
  expect((await dryRun($, 'off')).text).toBe('dry-run mod: off (source: session).')
  expect((await dryRun($, '')).text).toBe('dry-run mod: off (source: session).')
  expect((await dryRun($, 'on')).text).toBe('dry-run mod: on (source: session). Gate locked.')
  await run($, 'go')
  expect((await dryRun($, '')).text).toBe('dry-run mod: on (source: session). Gate open.')
})

test('/dry-run with an unknown word changes nothing and shows the usage', async ($, on) => {
  stubEngine(on)
  await start($)

  expect((await dryRun($, 'maybe')).text).toContain('Use /dry-run, /dry-run on or /dry-run off')
  expect(await $.tool.call(EDIT_LOCKED)).toEqual({ deny: DENY_TEXT })
})

test('/dry-run off, then a new session: gate on and locked, source default', async ($, on) => {
  stubEngine(on)
  await start($)
  await dryRun($, 'off')

  await start($)

  expect(await $.tool.call(EDIT_LOCKED)).toEqual({ deny: DENY_TEXT })
  expect((await dryRun($, '')).text).toBe('dry-run mod: on (source: default). Gate locked.')
})

test('relock: a real /clear (session.end) locks the gate, /dry-run off survives it', async ($, on) => {
  stubEngine(on)
  await start($)
  await run($, 'go')

  await $.session.end(sessionEnd('clear'))
  expect(await $.tool.call(EDIT_LOCKED)).toEqual({ deny: DENY_TEXT })

  await dryRun($, 'off')
  await $.session.end(sessionEnd('clear'))
  expect(await $.tool.call(EDIT_LOCKED)).toEqual({ result: {} })
})

test('relock: the classic SessionStart with source clear locks the gate', async ($, on) => {
  stubEngine(on)
  await start($)
  await run($, 'go')

  await $.classic.SessionStart({ source: 'clear' })

  expect(await $.tool.call(EDIT_LOCKED)).toEqual({ deny: DENY_TEXT })
})

test('a session end for another reason does not lock the gate', async ($, on) => {
  stubEngine(on)
  await start($)
  await run($, 'go')

  await $.session.end(sessionEnd('other'))

  expect(await $.tool.call(EDIT_LOCKED)).toEqual({ result: {} })
})

test('a compact keeps the gate open', async ($, on) => {
  stubEngine(on)
  await start($)
  await run($, 'go')

  const message: Args<'session.compact'>['messages'][number] = { role: 'user', text: 'hi', toolUses: [] }
  await $.session.compact({ trigger: 'auto', messages: [message] })

  expect(await $.tool.call(EDIT_LOCKED)).toEqual({ result: {} })
})

test('one lock for every agent: a subagent is denied while locked, allowed after a go', async ($, on) => {
  stubEngine(on)
  await start($)

  expect(await $.tool.call(SUBAGENT_EDIT)).toEqual({ deny: DENY_TEXT })
  await run($, 'go')
  expect(await $.tool.call(SUBAGENT_EDIT)).toEqual({ result: {} })
  await run($, 'stop')
  expect(await $.tool.call(SUBAGENT_EDIT)).toEqual({ deny: DENY_TEXT })
})

test('a subagent Bash write is denied while locked', async ($, on) => {
  stubEngine(on)
  await start($)

  const bash = { ...BASH_WRITE, agentId: 'a1' }
  expect((await $.tool.check(bash)).decision).toBe('deny')
})

test('switch file: locked even when no dry run waits, a go opens it', async ($, on) => {
  await startInRepo($, on)

  expect(await $.tool.call(SWITCH)).toEqual({ deny: DENY_TEXT })
  await run($, 'go')
  expect(await $.tool.call(SWITCH)).toEqual({ result: {} })
})

test('switch file: still locked under /dry-run off, while code files are free', async ($, on) => {
  await startInRepo($, on)
  await dryRun($, 'off')

  expect(await $.tool.call(EDIT_LOCKED)).toEqual({ result: {} })
  expect(await $.tool.call(SWITCH)).toEqual({ deny: DENY_TEXT })
  await run($, 'go')
  expect(await $.tool.call(SWITCH)).toEqual({ result: {} })
})

test('switch file: a relative path counts from the working folder', async ($, on) => {
  await startInRepo($, on)

  const relative = { tool: 'Write', file_path: '../.claude/dry-run.json', content: '{}' } satisfies ToolCallArgs
  expect(await $.tool.call(relative)).toEqual({ deny: DENY_TEXT })
})

test('switch file: Write and NotebookEdit are denied too', async ($, on) => {
  await startInRepo($, on)

  const write = { tool: 'Write', file_path: '/repo/.claude/dry-run.json', content: '{}' } satisfies ToolCallArgs
  const notebook = { tool: 'NotebookEdit', notebook_path: '/repo/.claude/dry-run.json', new_source: '{}' } satisfies ToolCallArgs
  expect(await $.tool.call(write)).toEqual({ deny: DENY_TEXT })
  expect(await $.tool.call(notebook)).toEqual({ deny: DENY_TEXT })
})

test('switch file: a Bash write is denied, also under /dry-run off', async ($, on) => {
  await startInRepo($, on)
  expect((await $.tool.check(BASH_SWITCH)).decision).toBe('deny')

  await dryRun($, 'off')
  expect((await $.tool.check(BASH_SWITCH)).decision).toBe('deny')
  expect((await $.tool.check(BASH_WRITE)).decision).toBe('allow')

  await run($, 'go')
  expect((await $.tool.check(BASH_SWITCH)).decision).toBe('allow')
})

test('switch file: just do it with no dry run waiting opens it', async ($, on) => {
  await startInRepo($, on)

  await submit($, 'just do it')

  expect(await $.tool.call(SWITCH)).toEqual({ result: {} })
})

test('switch file: another repo file named dry-run.json is free', async ($, on) => {
  await startInRepo($, on)

  const other = { tool: 'Edit', file_path: '/repo/src/.claude/dry-run.json', old_string: 'a', new_string: 'b' } satisfies ToolCallArgs
  expect(await $.tool.call(other)).toEqual({ result: {} })
})

test('switch file: with no git root there is no switch file', async ($, on) => {
  stubEngine(on)
  await start($, '/repo/src')

  expect(await $.tool.call(SWITCH)).toEqual({ result: {} })
})

test('fail closed: under /dry-run off a call with no command is still denied', async ($, on) => {
  await startInRepo($, on)
  await dryRun($, 'off')

  const noCommand = await $.tool.check({ tool: 'Bash', input: {} })
  expect(noCommand).toEqual({ decision: 'deny', reason: DENY_TEXT })
})

test('fail closed: when the git root lookup fails, any path ending in .claude/dry-run.json is locked', async ($, on) => {
  stubEngine(on, { existsThrows: true })
  await start($, '/repo/src')

  expect(await $.tool.call(SWITCH)).toEqual({ deny: DENY_TEXT })
  expect((await $.tool.check(BASH_SWITCH)).decision).toBe('deny')
  expect(await $.tool.call(EDIT_FREE)).toEqual({ result: {} })
})

test('fail closed: before any session.start the switch file is locked by its ending', async ($, on) => {
  stubEngine(on)

  expect(await $.tool.call(SWITCH)).toEqual({ deny: DENY_TEXT })
})

// ---- repo file (ticket 25) ----

const GATE_DOWN_SOFT = 'Repo sets dry-run mod: soft. `/dry-run on` to lock.'
const GATE_DOWN_OFF = 'Repo sets dry-run mod: off. `/dry-run on` to lock.'

function startWithRepoFile(text: string, stubs: Stubs = {}) {
  return async ($: Engine, on: On) => {
    const seen = stubEngine(on, { gitRoot: '/repo', repoFile: text, ...stubs })
    await start($, '/repo/src')
    return seen
  }
}

test('repo file soft: no gate, source repo, one gate-down toast', async ($, on) => {
  const { toasts } = await startWithRepoFile('{ "mode": "soft" }')($, on)

  expect(await $.tool.call(EDIT_LOCKED)).toEqual({ result: {} })
  expect((await dryRun($, '')).text).toBe('dry-run mod: soft (source: repo). No gate.')
  expect(toasts).toEqual([GATE_DOWN_SOFT])
})

test('repo file soft: dry runs still count, so a go word is still understood', async ($, on) => {
  await startWithRepoFile('{ "mode": "soft" }')($, on)

  expect(await submit($, 'go')).toEqual({ drop: 'no dry run to approve' })
  await complete($, DRY_RUN)
  expect(await submit($, 'go')).toEqual({ text: 'go' })
})

test('repo file off: no dry runs, no gate, but the switch file stays locked', async ($, on) => {
  const { toasts } = await startWithRepoFile('{ "mode": "off" }')($, on)

  expect(await $.tool.call(EDIT_LOCKED)).toEqual({ result: {} })
  expect(await $.tool.call(SWITCH)).toEqual({ deny: DENY_TEXT })
  expect((await dryRun($, '')).text).toBe('dry-run mod: off (source: repo).')
  expect(toasts).toEqual([GATE_DOWN_OFF])
})

test('repo file on: gate locked, source repo, no gate-down toast', async ($, on) => {
  const { toasts } = await startWithRepoFile('{ "mode": "on" }')($, on)

  expect(await $.tool.call(EDIT_LOCKED)).toEqual({ deny: DENY_TEXT })
  expect((await dryRun($, '')).text).toBe('dry-run mod: on (source: repo). Gate locked.')
  expect(toasts).toEqual([])
})

test('no repo file: source default, nothing read, no toast', async ($, on) => {
  const { toasts, reads } = await startWithRepoFile('', { repoFile: undefined })($, on)

  expect((await dryRun($, '')).text).toBe('dry-run mod: on (source: default). Gate locked.')
  expect(reads).toEqual([])
  expect(toasts).toEqual([])
})

test('repo soft: /dry-run on locks the gate and wins, /dry-run off frees it', async ($, on) => {
  await startWithRepoFile('{ "mode": "soft" }')($, on)

  expect((await dryRun($, 'on')).text).toBe('dry-run mod: on (source: session). Gate locked.')
  expect(await $.tool.call(EDIT_LOCKED)).toEqual({ deny: DENY_TEXT })
  await dryRun($, 'off')
  expect(await $.tool.call(EDIT_LOCKED)).toEqual({ result: {} })
})

test('repo off: /dry-run on locks the gate and wins', async ($, on) => {
  await startWithRepoFile('{ "mode": "off" }')($, on)

  await dryRun($, 'on')
  expect(await $.tool.call(EDIT_LOCKED)).toEqual({ deny: DENY_TEXT })
})

test('repo on: /dry-run off frees the gate and wins', async ($, on) => {
  await startWithRepoFile('{ "mode": "on" }')($, on)

  expect((await dryRun($, 'off')).text).toBe('dry-run mod: off (source: session).')
  expect(await $.tool.call(EDIT_LOCKED)).toEqual({ result: {} })
})

test('repo file lock and unlock feed the path check, for Edit and for Bash', async ($, on) => {
  const text = '{ "lock": [".yaml"], "unlock": ["generated/", ".sql"] }'
  const { toasts } = await startWithRepoFile(text)($, on)
  const edit = (file_path: string) => $.tool.call({ tool: 'Edit', file_path, old_string: 'a', new_string: 'b' })
  const bash = (command: string) => $.tool.check({ tool: 'Bash', input: { command } })

  expect(await edit('/repo/ci.yaml')).toEqual({ deny: DENY_TEXT })
  expect(await edit('/repo/generated/a.py')).toEqual({ result: {} })
  expect(await edit('/repo/db/q.sql')).toEqual({ result: {} })
  expect(await edit('/repo/src/a.py')).toEqual({ deny: DENY_TEXT })
  expect(await bash('echo x > /repo/ci.yaml')).toEqual({ decision: 'deny', reason: DENY_TEXT })
  expect(await bash('echo x > /repo/generated/a.py')).toEqual({ decision: 'allow', reason: 'stub' })
  // Any unlock is a gate-down toast, even with mode on.
  expect(toasts).toEqual(['Repo sets dry-run mod: on. `/dry-run on` to lock.'])
})

test('repo unlock cannot free the switch file', async ($, on) => {
  const { toasts } = await startWithRepoFile('{ "unlock": [".claude/dry-run.json", ".json", ".claude/"] }')($, on)

  expect(await $.tool.call(SWITCH)).toEqual({ deny: DENY_TEXT })
  expect(toasts.some(t => t.includes('.claude/dry-run.json'))).toBe(true)
})

test('repo unlock items with .. or absolute paths are ignored, and a toast names them', async ($, on) => {
  const { toasts } = await startWithRepoFile('{ "unlock": ["../x/", "/etc/", "gen/"] }')($, on)

  expect(toasts.filter(t => t.includes('../x/')).length).toBe(1)
  expect(toasts.filter(t => t.includes('/etc/')).length).toBe(1)
  expect(await $.tool.call({ tool: 'Edit', file_path: '/repo/gen/a.py', old_string: 'a', new_string: 'b' })).toEqual({ result: {} })
  expect(await $.tool.call({ tool: 'Edit', file_path: '/x/a.py', old_string: 'a', new_string: 'b' })).toEqual({ deny: DENY_TEXT })
})

const BAD_REPO_FILES: [string, string][] = [
  ['bad JSON', '{ "mode": '],
  ['an unknown key', '{ "mod": "off" }'],
]

for (const [name, text] of BAD_REPO_FILES) {
  test(`bad repo file (${name}): ignored whole, mode on, one toast`, async ($, on) => {
    const { toasts } = await startWithRepoFile(text)($, on)

    expect(await $.tool.call(EDIT_LOCKED)).toEqual({ deny: DENY_TEXT })
    expect((await dryRun($, '')).text).toBe('dry-run mod: on (source: default). Gate locked.')
    expect(toasts.length).toBe(1)
    expect(toasts[0]).toContain('Repo file ignored')
  })
}

test('a bad platform shape ignores only platform, with a toast', async ($, on) => {
  const { toasts } = await startWithRepoFile('{ "mode": "soft", "platform": { "agent": 1 } }')($, on)

  expect((await dryRun($, '')).text).toBe('dry-run mod: soft (source: repo). No gate.')
  expect(toasts.some(t => t.includes('platform'))).toBe(true)
})

test('a repo file that cannot be read: ignored, mode on, a toast', async ($, on) => {
  const { toasts } = await startWithRepoFile('{ "mode": "off" }', { readThrows: true })($, on)

  expect(await $.tool.call(EDIT_LOCKED)).toEqual({ deny: DENY_TEXT })
  expect(toasts.length).toBe(1)
  expect(toasts[0]).toContain('Repo file')
})

test('no git root: no repo file is read', async ($, on) => {
  const { reads } = stubEngine(on, { repoFile: '{ "mode": "off" }' })
  await start($, '/work')

  expect(await $.tool.call(EDIT_LOCKED)).toEqual({ deny: DENY_TEXT })
  expect(reads).toEqual([])
})

test('only the git-root file is read, never one in a parent or sub folder', async ($, on) => {
  const { reads } = await startWithRepoFile('{}')($, on)

  expect(reads).toEqual(['/repo/.claude/dry-run.json'])
})

test('the file is read again after /clear: new rules apply, session choice stays', async ($, on) => {
  const stubs: Stubs = { gitRoot: '/repo', repoFile: '{ "mode": "soft" }' }
  const { toasts } = stubEngine(on, stubs)
  await start($, '/repo/src')
  expect(await $.tool.call(EDIT_LOCKED)).toEqual({ result: {} })

  stubs.repoFile = '{ "mode": "on" }'
  await $.session.end(sessionEnd('clear'))
  expect(await $.tool.call(EDIT_LOCKED)).toEqual({ deny: DENY_TEXT })
  expect(toasts).toEqual([GATE_DOWN_SOFT])

  await dryRun($, 'off')
  stubs.repoFile = '{ "mode": "on", "lock": [".yaml"] }'
  await $.session.end(sessionEnd('clear'))
  expect(await $.tool.call(EDIT_LOCKED)).toEqual({ result: {} })
  expect(await $.tool.call({ tool: 'Edit', file_path: '/repo/a.yaml', old_string: 'a', new_string: 'b' })).toEqual({ result: {} })
})

test('both /clear signals together show a bad-file toast once', async ($, on) => {
  const stubs: Stubs = { gitRoot: '/repo', repoFile: '{}' }
  const { toasts } = stubEngine(on, stubs)
  await start($, '/repo/src')

  stubs.repoFile = '{ "mod": 1 }'
  await $.session.end(sessionEnd('clear'))
  await $.classic.SessionStart({ source: 'clear' })

  expect(toasts.length).toBe(1)
})

test('the gate-down toast shows once per session, and again in the next session', async ($, on) => {
  const stubs: Stubs = { gitRoot: '/repo', repoFile: '{ "mode": "soft" }' }
  const { toasts } = stubEngine(on, stubs)
  await start($, '/repo/src')
  await $.session.end(sessionEnd('clear'))
  await $.classic.SessionStart({ source: 'clear' })
  expect(toasts).toEqual([GATE_DOWN_SOFT])

  await start($, '/repo/src')
  expect(toasts).toEqual([GATE_DOWN_SOFT, GATE_DOWN_SOFT])
})

test('an engine below the floor stays off: the repo file is not read', async ($, on) => {
  const { reads } = await startWithRepoFile('{ "mode": "on" }', { version: '2.1.300' })($, on)

  expect(reads).toEqual([])
  expect(await $.tool.call(EDIT_LOCKED)).toEqual({ result: {} })
  await $.session.end(sessionEnd('clear'))
  expect(await $.tool.call(EDIT_LOCKED)).toEqual({ result: {} })
})

test('an engine below the floor: /clear reads no repo file and shows no repo toast', async ($, on) => {
  const { reads, toasts } = await startWithRepoFile('{ "mode": "off", "unlock": [".sql"] }', { version: '2.1.300' })($, on)

  await $.session.end(sessionEnd('clear'))
  await $.classic.SessionStart({ source: 'clear' })

  expect(reads).toEqual([])
  expect(toasts.length).toBe(1)
  expect(toasts[0]).toContain('needs Claude Code')
})

// ---- Rules delivery (ticket 26) ----

const RULES_TOOL = 'mcp__dry-run__dry_run_rules'
const BLOCKED_TOAST = 'Rules tool blocked by your org. Using fallback text.'
const BUNDLED = {
  'dry-run-format.md': 'FORMAT TEXT',
  'dry-run-names.md': 'NAMES TEXT',
  'dry-run-design.md': 'DESIGN TEXT',
  'dry-run-dsa.md': 'DSA TEXT',
  'examples/generic.md': 'GENERIC EXAMPLES',
  'examples/data-pipeline.md': 'PIPELINE EXAMPLES',
}
const LOCKED_LINE = 'dry-run mod: locked; call dry_run_rules'

function rules($: Engine, name: string) {
  return $.tool.call({ tool: RULES_TOOL, name })
}

// The context the last prompt reached the bottom with.
function lastContext(contexts: (readonly string[] | undefined)[]): readonly string[] {
  return contexts[contexts.length - 1] ?? []
}

test('rules: the tool is registered at session start', async ($, on) => {
  const { tools } = stubEngine(on, { bundled: BUNDLED })
  await start($)

  expect(tools).toEqual(['dry_run_rules'])
})

test('rules: the index goes in once per thread, the status line every turn', async ($, on) => {
  const { contexts } = stubEngine(on, { bundled: BUNDLED })
  await start($)

  await submit($, 'first')
  const first = lastContext(contexts)
  expect(first.length).toBe(2)
  expect(first[0]).toContain('FORMAT TEXT')
  expect(first[0]).toContain('NAMES TEXT')
  expect(first[0]).toContain('dry_run_rules("dsa")')
  expect(first[0]).not.toContain('DSA TEXT')
  expect(first[0]).not.toContain('DESIGN TEXT')
  expect(first[1]).toBe(LOCKED_LINE)

  await submit($, 'second')
  expect(lastContext(contexts)).toEqual([LOCKED_LINE])
})

test('rules: a new session and a clear send the index again', async ($, on) => {
  const { contexts } = stubEngine(on, { bundled: BUNDLED })
  await start($)
  await submit($, 'first')

  await $.session.end(sessionEnd('clear'))
  await submit($, 'after clear')
  expect(lastContext(contexts).length).toBe(2)

  await start($)
  await submit($, 'after restart')
  expect(lastContext(contexts).length).toBe(2)
})

test('rules: the status line names each state', async ($, on) => {
  const { contexts } = stubEngine(on, { bundled: BUNDLED })
  await start($)
  await submit($, 'one')

  await run($, 'go')
  await submit($, 'two')
  expect(lastContext(contexts)).toEqual(['dry-run mod: open'])

  await dryRun($, 'off')
  await submit($, 'three')
  expect(lastContext(contexts)).toEqual(['dry-run mod: off'])
})

test('rules: repo off shows off (repo), no index', async ($, on) => {
  const { contexts } = await startWithRepoFile('{ "mode": "off" }', { bundled: BUNDLED })($, on)

  await submit($, 'one')

  expect(lastContext(contexts)).toEqual(['dry-run mod: off (repo)'])
})

test('rules: repo soft shows soft and still sends the index', async ($, on) => {
  const { contexts } = await startWithRepoFile('{ "mode": "soft" }', { bundled: BUNDLED })($, on)

  await submit($, 'one')

  expect(lastContext(contexts).length).toBe(2)
  expect(lastContext(contexts)[1]).toBe('dry-run mod: soft; call dry_run_rules')
})

test('rules: /dry-run off before the first prompt sends the status line only', async ($, on) => {
  const { contexts } = stubEngine(on, { bundled: BUNDLED })
  await start($)
  await dryRun($, 'off')

  await submit($, 'one')

  expect(lastContext(contexts)).toEqual(['dry-run mod: off'])
})

test('rules: a prompt that is not the person\'s own gets no rule text', async ($, on) => {
  const { contexts } = stubEngine(on, { bundled: BUNDLED })
  await start($)

  await submit($, 'task note', { origin: { kind: 'notification' } })

  expect(lastContext(contexts)).toEqual([])
})

test('rules: the tool returns the bundled file for each name', async ($, on) => {
  stubEngine(on, { bundled: BUNDLED })
  await start($)

  expect(await rules($, 'design')).toEqual({ result: 'DESIGN TEXT' })
  expect(await rules($, 'dsa')).toEqual({ result: 'DSA TEXT' })
  expect(await rules($, 'examples')).toEqual({ result: 'GENERIC EXAMPLES' })
  const index = await rules($, 'index')
  expect(String(index.result)).toContain('FORMAT TEXT')
})

test('rules: an override of the user wins per file', async ($, on) => {
  stubEngine(on, { bundled: BUNDLED, overrides: { 'dry-run-dsa.md': 'MY DSA' } })
  await start($)

  expect(await rules($, 'dsa')).toEqual({ result: 'MY DSA' })
  expect(await rules($, 'design')).toEqual({ result: 'DESIGN TEXT' })
})

test('rules: an override is found under USERPROFILE when HOME is not set', async ($, on) => {
  stubEngine(on, { bundled: BUNDLED, overrides: { 'dry-run-dsa.md': 'MY DSA' }, homeVar: 'USERPROFILE' })
  await start($)

  expect(await rules($, 'dsa')).toEqual({ result: 'MY DSA' })
})

test('rules: examples returns the pack, then generic', async ($, on) => {
  stubEngine(on, { bundled: BUNDLED })
  await start($)

  expect(await rules($, 'examples')).toEqual({ result: 'GENERIC EXAMPLES' })
})

test('rules: the pack option picks the examples file', { options: { examplePack: 'data-pipeline' } }, async ($, on) => {
  stubEngine(on, { bundled: BUNDLED })
  await start($)

  expect(await rules($, 'examples')).toEqual({ result: 'PIPELINE EXAMPLES\n\nGENERIC EXAMPLES' })
})

test('rules: a name outside the list is refused', async ($, on) => {
  stubEngine(on, { bundled: BUNDLED })
  await start($)

  const answer = await rules($, 'coach')

  expect(answer.deny).toContain('index | design | examples | dsa | platform')
})

test('rules: a file that cannot be read is refused with the name', async ($, on) => {
  stubEngine(on, { bundled: BUNDLED })
  await start($)

  // dry-run-platform.md is not in the stub, so the read fails.
  const answer = await rules($, 'platform')

  expect(answer.deny).toContain('platform')
})

test('rules: explainLanguage adds the reader line to rule text', { options: { explainLanguage: 'java' } }, async ($, on) => {
  const { contexts } = stubEngine(on, { bundled: BUNDLED })
  await start($)

  await submit($, 'one')
  expect(lastContext(contexts)[0]).toContain("Reader's language: java")
  expect(String((await rules($, 'dsa')).result)).toContain("Reader's language: java")
})

test('rules: explainLanguage off adds no reader line', { options: { explainLanguage: 'off' } }, async ($, on) => {
  const { contexts } = stubEngine(on, { bundled: BUNDLED })
  await start($)

  await submit($, 'one')

  expect(lastContext(contexts)[0]).not.toContain("Reader's language")
})

test('rules: a refused tool shows one toast and the full text rides each prompt', async ($, on) => {
  const { toasts, contexts } = stubEngine(on, { bundled: BUNDLED, refuseTool: true })
  await start($)

  expect(toasts).toEqual([BLOCKED_TOAST])
  await submit($, 'one')
  await submit($, 'two')

  const full = 'FORMAT TEXT\n\nNAMES TEXT\n\nDESIGN TEXT\n\nGENERIC EXAMPLES\n\nDSA TEXT'
  expect(lastContext(contexts)).toEqual([full, 'dry-run mod: locked'])
  expect(contexts.length).toBe(2)
  expect(contexts[0]).toEqual([full, 'dry-run mod: locked'])
})

test('rules: the fallback text stops after a dry run, when the gate is open, and when off', async ($, on) => {
  const { contexts } = stubEngine(on, { bundled: BUNDLED, refuseTool: true })
  await start($)

  await complete($, DRY_RUN)
  await submit($, 'after dry run')
  expect(lastContext(contexts)).toEqual(['dry-run mod: locked'])

  await start($)
  await run($, 'go')
  await submit($, 'open')
  expect(lastContext(contexts)).toEqual(['dry-run mod: open'])

  await start($)
  await dryRun($, 'off')
  await submit($, 'off')
  expect(lastContext(contexts)).toEqual(['dry-run mod: off'])
})

test('rules: a dry run from a subagent does not stop the fallback text', async ($, on) => {
  const { contexts } = stubEngine(on, { bundled: BUNDLED, refuseTool: true })
  await start($)

  await complete($, DRY_RUN, { agentId: 'agent-1' })
  await submit($, 'next')

  expect(lastContext(contexts).length).toBe(2)
})

test('rules: the fallback carries the reader line when set', { options: { explainLanguage: 'java' } }, async ($, on) => {
  const { contexts } = stubEngine(on, { bundled: BUNDLED, refuseTool: true })
  await start($)

  await submit($, 'one')

  expect(lastContext(contexts)[0]).toContain("Reader's language: java")
})

test('rules: the go word opens the gate and its own status line already says open', async ($, on) => {
  const { contexts } = stubEngine(on, { bundled: BUNDLED })
  await start($)
  await complete($, DRY_RUN)

  await submit($, 'go ahead')

  expect(await $.tool.call(EDIT_LOCKED)).toEqual({ result: {} })
  expect(lastContext(contexts)[1]).toBe('dry-run mod: open')
})

test('rules: a missing rule file does not stop the prompt, the status line still goes in', async ($, on) => {
  const { contexts } = stubEngine(on, { bundled: {} })
  await start($)

  await submit($, 'one')

  expect(lastContext(contexts)).toEqual([LOCKED_LINE])
})

test('rules: a session /dry-run off over a repo off shows off, not off (repo)', async ($, on) => {
  const { contexts } = await startWithRepoFile('{ "mode": "off" }', { bundled: BUNDLED })($, on)
  await dryRun($, 'off')

  await submit($, 'one')

  expect(lastContext(contexts)).toEqual(['dry-run mod: off'])
})

test('rules: a missing rule file does not stop the prompt when the tool is blocked', async ($, on) => {
  const { contexts } = stubEngine(on, { bundled: {}, refuseTool: true })
  await start($)

  await submit($, 'one')

  expect(lastContext(contexts)).toEqual(['dry-run mod: locked'])
})

test('rules: an override that cannot be read falls back to the bundled file', async ($, on) => {
  stubEngine(on, { bundled: BUNDLED, overrides: { 'dry-run-dsa.md': 'MY DSA' }, unreadable: ['dry-run-dsa.md'] })
  await start($)

  expect(await rules($, 'dsa')).toEqual({ result: 'DSA TEXT' })
})

test('rules: a prompt dropped beneath does not use up the index', async ($, on) => {
  const { contexts } = stubEngine(on, { bundled: BUNDLED, dropFirstPrompt: true })
  await start($)

  await submit($, 'dropped')
  await submit($, 'kept')

  expect(lastContext(contexts).length).toBe(2)
  expect(lastContext(contexts)[0]).toContain('FORMAT TEXT')
})

// ---- Design Card: status line and toasts (ticket 27) ----

const CARD_RUN = [
  '## Dry run',
  '### 1. Bug and goal',
  '**Goal:** g',
  '### 2. Change table',
  '| `src/Foo.java` | edit | why |',
  '### 3. SOLID',
  'None at stake: small',
  '### 4. Pattern',
  '**Chosen:** none',
  '### 5. DSA',
  '**Chosen:** none',
  '### 6. Worked example',
  'x',
  '### 7. Open decisions',
  'y',
].join('\n')

const GATE_OPEN_TOAST = '✓ Gate open. Edits allowed for this dry run.'

function last<T>(items: T[]): T | undefined {
  return items[items.length - 1]
}

test('status line: locked with nothing, locked 4/4 after a dry run, open after go', async ($, on) => {
  const { statuses } = stubEngine(on)
  await start($)
  expect(last(statuses)).toBe('⊘ dry-run locked · 0/4')

  await complete($, CARD_RUN)
  expect(last(statuses)).toBe('⊘ dry-run locked · 4/4')

  await submit($, 'go')
  expect(last(statuses)).toBe('✓ dry-run open · 4/4')

  await run($, 'stop')
  expect(last(statuses)).toBe('⊘ dry-run locked · 4/4')
})

test('status line: a clear forgets the dry run', async ($, on) => {
  const { statuses } = stubEngine(on)
  await start($)
  await complete($, CARD_RUN)

  await $.session.end(sessionEnd('clear'))

  expect(last(statuses)).toBe('⊘ dry-run locked · 0/4')
})

test('status line: (repo) when the repo file set the mode, gone when off', async ($, on) => {
  const { statuses } = await startWithRepoFile('{ "mode": "on" }')($, on)
  expect(last(statuses)).toBe('⊘ dry-run locked (repo) · 0/4')

  await dryRun($, 'off')
  expect(last(statuses)).toBeUndefined()
})

test('status line: the repo file off clears the line at start', async ($, on) => {
  const { statuses } = await startWithRepoFile('{ "mode": "off" }')($, on)

  expect(last(statuses)).toBeUndefined()
})

test('toast: the gate opens by /go, by a go word', async ($, on) => {
  const { toasts } = stubEngine(on)
  await start($)

  await run($, 'go')
  await complete($, CARD_RUN)
  await submit($, 'go')

  expect(toasts).toEqual([GATE_OPEN_TOAST, GATE_OPEN_TOAST])
})

test('toast: a blocked edit names the path', async ($, on) => {
  const { blocked } = stubEngine(on)
  await start($)

  await $.tool.call(EDIT_LOCKED)
  await $.tool.call(WRITE_LOCKED)
  await $.tool.call(EDIT_FREE)

  expect(blocked).toEqual([
    '⊘ Blocked Update(src/Foo.py) — Post a dry run, then say "go".',
    '⊘ Blocked Update(src/Foo.py) — Post a dry run, then say "go".',
  ])
})

test('the Design Card pane opens at session start', async ($, on) => {
  const { panes } = stubEngine(on)
  await start($)

  expect(panes).toEqual(['design-card'])
})
