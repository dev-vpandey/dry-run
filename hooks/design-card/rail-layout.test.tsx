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
  props: { title: 'dry-run · Design Card', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
} as const

const TWO_SECTIONS = ['## Dry run', '### 1. Bug and goal', '**Goal:** show the gate', '### 3. SOLID', 'None at stake: one function.'].join('\n')

function seedState(on: On, seed: Record<string, unknown>) {
  const values = new Map<string, unknown>(Object.entries(seed))
  on('state.get', (_: unknown, e: { key: string }) => ({ value: { value: values.get(e.key), version: values.has(e.key) ? 1 : 0 } }))
  on('fs.read', () => ({ value: 'Patterns: Strategy\nDSA: Two pointers' }))
}

async function texts($: Engine, part: typeof BAND | typeof PANE, surface: 'terminal' | 'vscode' = 'terminal') {
  const ui = await $.ui.mount({ ...part, surface })
  const all = (await ui.findAll({ type: 'Text' })).map(node => node.text).join('')
  await ui.unmount()
  return all
}

async function clients($: Engine, part: typeof BAND | typeof PANE, surface: 'terminal' | 'vscode' = 'terminal') {
  const ui = await $.ui.mount({ ...part, surface })
  const found = await ui.findAll({ type: 'Client' })
  await ui.unmount()
  return found
}

const RAIL = { layoutName: 'rail' }

test('the rail band has six stops joined by lines: nothing written yet', async ($, on) => {
  seedState(on, RAIL)

  expect(await texts($, BAND)).toBe('✻ ○ Goal ── ○ SOLID ── ○ Pattern ── ○ DSA ── ○ Coach ── ○ Go')
})

test('a written section is a ● and its name is plain text', async ($, on) => {
  seedState(on, { ...RAIL, dryRunText: TWO_SECTIONS })

  const all = await texts($, BAND)
  expect(all).toContain('● Goal ── ● SOLID ── ○ Pattern')
})

test('the stop being written spins, and the stops before it are done', async ($, on) => {
  seedState(on, { ...RAIL, liveSection: 'Pattern' })

  const spinners = await clients($, BAND)
  expect(spinners.map(node => node.key)).toEqual(['spin-Pattern'])
  expect(spinners[0]?.props.props).toEqual({ label: 'Pattern', color: '#d77757' })
  expect(await texts($, BAND)).toContain('● Goal ── ● SOLID ──')
})

test('a coach at work spins its stop', async ($, on) => {
  seedState(on, { ...RAIL, coachState: 'reviewing' })
  expect((await clients($, BAND)).map(node => node.key)).toEqual(['spin-Coach'])
})

test('a down coach shows ✗', async ($, on) => {
  seedState(on, { ...RAIL, coachState: 'down' })
  expect(await texts($, BAND)).toContain('✗ Coach')
})

test('an open gate makes the Go stop done', async ($, on) => {
  seedState(on, { ...RAIL, isOpen: true })

  expect(await texts($, BAND)).toContain('● Go')
})

test('with no Client the live stop is a still ✻', async ($, on) => {
  seedState(on, { ...RAIL, liveSection: 'DSA' })

  expect(await clients($, BAND, 'vscode')).toEqual([])
  expect(await texts($, BAND, 'vscode')).toContain('✻ DSA')
})

test('the rail pane is a timeline: a step per stop, words only under the done ones', async ($, on) => {
  seedState(on, { ...RAIL, dryRunText: TWO_SECTIONS })

  const all = await texts($, PANE)
  expect(all).toContain('dry-run')
  expect(all).toContain('GATE LOCKED')
  for (const step of ['Goal', 'SOLID', 'Pattern', 'DSA', 'Coach', 'Go']) {
    expect(all).toContain(` ${step}`)
  }
  expect(all).toContain('show the gate')
  expect(all).toContain('None at stake')
})

test('the rail pane draws Clawd, with Go as the last step', async ($, on) => {
  seedState(on, { ...RAIL, isWaiting: true })

  const found = await clients($, PANE)
  expect(found.some(node => String(node.key).startsWith('clawd-'))).toBe(true)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const go = await ui.find({ type: 'Button', key: 'go' })
  await ui.unmount()
  expect(go).toBeDefined()
})
