import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

const BAND = {
  plugin: 'dry-run',
  component: 'AbovePrompt',
  requestId: 'band',
  props: { hasSurvey: false, isCollapsed: false, isWorking: false, maxRows: 3, bodyColumns: 80, scroll: { offset: 0, bodyRows: 3 }, view: {} },
} as const

const PANE = {
  plugin: 'dry-run',
  component: 'Pane',
  requestId: 'design-card',
  props: {
    title: 'dry-run · Design Card',
    isFocused: false,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

// The state the engine holds, by key. A key not seeded reads as never written.
// `writes` collects each state write as "key=value".
function seedState(on: On, seed: Record<string, unknown>, writes: string[] = []) {
  const values = new Map<string, unknown>(Object.entries(seed))
  on('state.get', (_: unknown, e: { key: string }) => ({ value: { value: values.get(e.key), version: values.has(e.key) ? 1 : 0 } }))
  on('state.set', (_: unknown, e: { key: string; value: unknown }) => {
    writes.push(`${e.key}=${String(e.value)}`)
    values.set(e.key, e.value)
    return { value: { isSet: true, version: 2 } }
  })
  on('fs.read', () => ({ value: 'Patterns: Strategy\nDSA: Two pointers' }))
  on('ui.toast', () => ({ value: undefined }))
  on('ui.status', () => ({ value: undefined }))
}

// The Client of Clawd that the pane drew: found by key, its props are plain data.
async function clawdClient($: Engine, surface: 'terminal' | 'desktop') {
  const ui = await $.ui.mount({ ...PANE, surface })
  const found = (await ui.findAll({ type: 'Client' })).find(node => String(node.key).startsWith('clawd-'))
  await ui.unmount()
  return found
}

async function paneTexts($: Engine, surface: 'terminal' | 'desktop' | 'vscode' | 'mobile') {
  const ui = await $.ui.mount({ ...PANE, surface })
  const texts = (await ui.findAll({ type: 'Text' })).map(node => node.text)
  await ui.unmount()
  return texts.join('\n')
}

test('Clawd is a Client on the terminal, in the gate costume when nothing else is going on', async ($, on) => {
  seedState(on, {})

  const clawd = await clawdClient($, 'terminal')
  expect(clawd?.key).toBe('clawd-locked')
  expect(String(clawd?.props.module)).toMatch(/clawd-surface\.tsx$/)
  expect(clawd?.props.props).toMatchObject({ mood: 'locked', flags: 0 })
})

test('an open gate gives the open costume', async ($, on) => {
  seedState(on, { isOpen: true })

  expect((await clawdClient($, 'desktop'))?.key).toBe('clawd-open')
})

test('soft mode gives the soft costume', async ($, on) => {
  seedState(on, { isSoft: true })

  expect((await clawdClient($, 'terminal'))?.key).toBe('clawd-soft')
})

test('the section being written sets the costume, even with the gate open', async ($, on) => {
  seedState(on, { liveSection: 'SOLID', isOpen: true })

  expect((await clawdClient($, 'terminal'))?.props.props).toMatchObject({ mood: 'solid' })
})

test('a coach at work sets the costume', async ($, on) => {
  seedState(on, { coachState: 'reviewing' })

  expect((await clawdClient($, 'terminal'))?.props.props).toMatchObject({ mood: 'reviewing' })
})

test('a finished coach holds up the flag count while the gate is locked', async ($, on) => {
  seedState(on, { coachState: 'done', coachFlags: 2 })

  expect((await clawdClient($, 'terminal'))?.props.props).toMatchObject({ mood: 'done', flags: 2 })
})

test('a stored section or coach name that is not known is ignored', async ($, on) => {
  seedState(on, { liveSection: 'Nonsense', coachState: 'Nonsense' })

  expect((await clawdClient($, 'terminal'))?.props.props).toMatchObject({ mood: 'locked' })
})

test('the Client is given a color for every hue of the art', async ($, on) => {
  seedState(on, {})

  const props = (await clawdClient($, 'terminal'))?.props.props
  expect(props).toMatchObject({ colors: { claude: '#d77757', amber: '#f2c14e', red: '#ff6b80' } })
})

test('without a Client (VS Code, mobile) Clawd is drawn as the first frame and its caption', async ($, on) => {
  seedState(on, { liveSection: 'DSA' })

  for (const surface of ['vscode', 'mobile'] as const) {
    const all = await paneTexts($, surface)
    expect(all, surface).toContain('Writing the algorithm')
    expect(all, surface).toContain('▐')
  }
})

// A model step: the chunks the engine streams, with the hook of the mod above them.
const STEP = { turnId: 't1', index: 0, model: 'm', messageCount: 1 }
const STEP_RESULT = { turnId: 't1', index: 0, answer: '', toolUses: [], stopReason: 'end_turn' as const, usage: null }

function textChunks(...pieces: string[]) {
  return pieces.map((text, ref) => ({ kind: 'text' as const, index: 0, text, ref }))
}

async function streamed($: Engine, input: typeof STEP & { agentId?: string }): Promise<string> {
  let text = ''
  for await (const chunk of $.turn.step(input)) {
    if (chunk.kind === 'text') {
      text += chunk.text
    }
  }
  return text
}

// What the live section writes, without the clear a main turn makes at its first step.
function liveWrites(writes: string[]): string[] {
  return writes.filter(item => item.startsWith('liveSection=') && item !== 'liveSection=')
}

test('turn.step: the ### heading being streamed sets the live section, and every chunk passes on', async ($, on) => {
  const writes: string[] = []
  seedState(on, {}, writes)
  on('turn.step', async function* () {
    yield* textChunks('## Dry run\n### 1. Bug and goal\n**Goal:** x\n', '### 3. SO', 'LID\n| a |', ' more')
    return STEP_RESULT
  })

  expect(await streamed($, STEP)).toBe('## Dry run\n### 1. Bug and goal\n**Goal:** x\n### 3. SOLID\n| a | more')
  expect(liveWrites(writes)).toEqual(['liveSection=Goal', 'liveSection=SOLID'])
})

test('turn.step: a step with no ### heading writes nothing, so the costume stays the gate costume', async ($, on) => {
  const writes: string[] = []
  seedState(on, {}, writes)
  on('turn.step', async function* () {
    yield* textChunks('hello ', 'world')
    return STEP_RESULT
  })

  expect(await streamed($, STEP)).toBe('hello world')
  expect(liveWrites(writes)).toEqual([])
})

test('turn.step: a subagent step is left alone', async ($, on) => {
  const writes: string[] = []
  seedState(on, {}, writes)
  on('turn.step', async function* () {
    yield* textChunks('## Dry run\n### 3. SOLID\n')
    return STEP_RESULT
  })

  expect(await streamed($, { ...STEP, agentId: 'sub-1' })).toBe('## Dry run\n### 3. SOLID\n')
  expect(writes.filter(item => item.startsWith('liveSection='))).toEqual([])
})

test('the Client module draws four rows of art and the caption', async ($, on) => {
  seedState(on, { liveSection: 'Goal' })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const inside = (await ui.findAll({ type: 'Text', in: 'clawd-goal' })).map(node => node.text).join('|')
  await ui.unmount()

  expect(inside).toContain('Setting the goal')
  expect(inside).toContain('◎')
})

test('turn.step: an ordinary answer with a ### heading is not a dry run, so no section is set', async ($, on) => {
  const writes: string[] = []
  seedState(on, {}, writes)
  on('turn.step', async function* () {
    yield* textChunks('Setup:\n### 3. Setup\nsteps')
    return STEP_RESULT
  })

  await streamed($, STEP)

  expect(liveWrites(writes)).toEqual([])
})

test('turn.step: the first step of a main turn clears a section an interrupted turn left', async ($, on) => {
  const writes: string[] = []
  seedState(on, { liveSection: 'SOLID' }, writes)
  on('turn.step', async function* () {
    yield* textChunks('thinking')
    return STEP_RESULT
  })

  await streamed($, STEP)

  expect(writes).toContain('liveSection=')
})

test('turn.step: a later step of a turn keeps the section', async ($, on) => {
  const writes: string[] = []
  seedState(on, { liveSection: 'SOLID' }, writes)
  on('turn.step', async function* () {
    yield* textChunks('more')
    return { ...STEP_RESULT, index: 1 }
  })

  await streamed($, { ...STEP, index: 1 })

  expect(writes).not.toContain('liveSection=')
})

test('after a Client failed, the pane leaves it out: Clawd is still art with the right costume', async ($, on) => {
  seedState(on, { isOpen: true, clientFault: 'load: module not found' })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Client' })).toBeUndefined()
  const all = (await ui.findAll({ type: 'Text' })).map(node => node.text).join('\n')
  await ui.unmount()

  expect(all).toContain('Gate open · edits on')
})

test('after a Client failed, the band leaves its spinner out too', async ($, on) => {
  seedState(on, { liveSection: 'DSA', clientFault: 'render: boom' })

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ type: 'Client' })).toBeUndefined()
  const all = (await ui.findAll({ type: 'Text' })).map(node => node.text).join('')
  await ui.unmount()

  expect(all).toContain('✻ 4/7')
})
