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
