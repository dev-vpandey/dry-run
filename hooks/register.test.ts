import { expect, test } from 'claude-code/testing'

// Written out here on purpose: the test must not share the mod's constant.
const DENY_TEXT =
  'dry-run mod: edits locked. Post a "## Dry run" and wait for /go. (User escape: /dry-run off)'

// What the engine adds to a command the person typed.
const TYPED = { args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } } as const

function run($: any, command: string) {
  return $.command.run({ command, ...TYPED })
}

const EDIT_LOCKED = { tool: 'Edit', file_path: 'src/Foo.py', old_string: 'a', new_string: 'b' } as const
const EDIT_FREE = { tool: 'Edit', file_path: 'README.md', old_string: 'a', new_string: 'b' } as const

type Stubs = { version?: string; refuseCommand?: string; home?: string }

// Each hook here stands for the engine, beneath the mod.
// The mod forwards each of these events with next(e), so each needs a stub.
function stubEngine(on: any, stubs: Stubs = {}) {
  const toasts: string[] = []
  const registered: string[] = []
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
    toasts.push(e.text)
    return { value: undefined }
  })
  on('env.get', (_: unknown, e: { name: string }) => ({ value: e.name === 'HOME' ? (stubs.home ?? '/Users/me') : undefined }))
  on('tool.call', () => ({ result: {} }))
  on('tool.check', () => ({ decision: 'allow', reason: 'stub' }))
  on('prompt.submit', (_: unknown, e: { text: string }) => ({ text: e.text }))
  on('turn.complete', (_: unknown, e: { answer: string }) => ({ text: e.answer }))
  return { toasts, registered }
}

async function start($: any) {
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
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

  const write = { tool: 'Write', file_path: 'src/Foo.py', content: 'x' }
  const notebook = { tool: 'NotebookEdit', notebook_path: 'a/nb.ipynb', new_source: 'x' }
  expect(await $.tool.call(write as never)).toEqual({ deny: DENY_TEXT })
  expect(await $.tool.call(notebook as never)).toEqual({ deny: DENY_TEXT })
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

test('fail closed: a call with no path is denied', async ($, on) => {
  stubEngine(on)
  await start($)

  expect(await $.tool.call({ tool: 'Edit', old_string: 'a', new_string: 'b' } as never)).toEqual({ deny: DENY_TEXT })
  expect(await $.tool.call({ tool: 'Write', content: 'x' } as never)).toEqual({ deny: DENY_TEXT })
  expect(await $.tool.call({ tool: 'NotebookEdit', new_source: 'x' } as never)).toEqual({ deny: DENY_TEXT })
})

test('fail closed: an open gate still denies a call with no path', async ($, on) => {
  stubEngine(on)
  await start($)
  await run($, 'go')

  expect(await $.tool.call({ tool: 'Edit', old_string: 'a', new_string: 'b' } as never)).toEqual({ deny: DENY_TEXT })
})

test('an engine older than 2.1.304 gets a toast and the mod stays off', async ($, on) => {
  const { toasts } = stubEngine(on, { version: '2.1.200' })
  await start($)

  expect(toasts.length).toBe(1)
  expect(toasts[0]).toContain('2.1.304')
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

  expect(registered).toEqual(['go', 'stop'])
})

test('when /stop clashes, /hold takes its place', async ($, on) => {
  const { registered } = stubEngine(on, { refuseCommand: 'stop' })
  await start($)
  await run($, 'go')

  expect(registered).toEqual(['go', 'hold'])
  await run($, 'hold')
  expect(await $.tool.call(EDIT_LOCKED)).toEqual({ deny: DENY_TEXT })
})

test('a repo plans folder is locked, the home plans folder is free', async ($, on) => {
  stubEngine(on, { home: '/Users/me' })
  await start($)

  const repoPlans = { tool: 'Edit', file_path: '/repo/.claude/plans/x.py', old_string: 'a', new_string: 'b' } as const
  const homePlans = { tool: 'Edit', file_path: '/Users/me/.claude/plans/x.py', old_string: 'a', new_string: 'b' } as const
  expect(await $.tool.call(repoPlans)).toEqual({ deny: DENY_TEXT })
  expect(await $.tool.call(homePlans)).toEqual({ result: {} })
})

test('the session scratchpad is free', async ($, on) => {
  stubEngine(on)
  await start($)

  const scratch = { tool: 'Edit', file_path: '/private/tmp/claude-501/p/s1/scratchpad/a.py', old_string: 'a', new_string: 'b' } as const
  expect(await $.tool.call(scratch)).toEqual({ result: {} })
})

test('a second session.start registers /go and /stop only once', async ($, on) => {
  const { registered } = stubEngine(on)
  await start($)
  await start($)

  expect(registered).toEqual(['go', 'stop'])
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

function submit($: any, text: string, extra: object = {}) {
  return $.prompt.submit({ text, wait: false, origin: { kind: 'composer' }, ...extra })
}

function complete($: any, answer: string, extra: object = {}) {
  return $.turn.complete({ answer, reason: 'answer', ...extra })
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

const BASH_WRITE = { tool: 'Bash', input: { command: 'echo x > src/foo.py' } } as const
const BASH_SAFE = { tool: 'Bash', input: { command: 'pytest tests/' } } as const

test('Bash: a command that writes a locked file is denied with the deny text', async ($, on) => {
  stubEngine(on)
  await start($)

  expect(await $.tool.check(BASH_WRITE as never)).toEqual({ decision: 'deny', reason: DENY_TEXT })
  expect((await $.tool.check(BASH_SAFE as never)).decision).toBe('allow')
})

test('Bash: a read-only command that names a locked file is allowed', async ($, on) => {
  stubEngine(on)
  await start($)

  const read = { tool: 'Bash', input: { command: 'cat src/foo.py' }, isReadOnly: true }
  expect((await $.tool.check(read as never)).decision).toBe('allow')
})

test('Bash: after /go the write is allowed, after /stop it is denied again', async ($, on) => {
  stubEngine(on)
  await start($)
  await run($, 'go')
  expect((await $.tool.check(BASH_WRITE as never)).decision).toBe('allow')

  await run($, 'stop')
  expect((await $.tool.check(BASH_WRITE as never)).decision).toBe('deny')
})

test('Bash: when the mod is off, a write is allowed', async ($, on) => {
  stubEngine(on, { version: '2.1.200' })
  await start($)

  expect((await $.tool.check(BASH_WRITE as never)).decision).toBe('allow')
})

test('fail closed: a Bash call with no command is denied, even with the gate open', async ($, on) => {
  stubEngine(on)
  await start($)
  expect(await $.tool.check({ tool: 'Bash', input: {} } as never)).toEqual({ decision: 'deny', reason: DENY_TEXT })

  await run($, 'go')
  expect(await $.tool.check({ tool: 'Bash', input: {} } as never)).toEqual({ decision: 'deny', reason: DENY_TEXT })
})
