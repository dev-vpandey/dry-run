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

test('the default layout is the card: the pane is boxes with the coach box last', async ($, on) => {
  seedState(on, { dryRunText: TWO_SECTIONS })

  const all = await texts($, PANE)
  expect(all).toContain('▾ Goal')
  expect(all).toContain('▾ SOLID')
  expect(all).toContain('Design Coach')
  expect(all.indexOf('Design Coach')).toBeGreaterThan(all.indexOf('▾ SOLID'))
})

test('the card band: the gate, the count and the coach after a bar', async ($, on) => {
  seedState(on, { dryRunText: TWO_SECTIONS })

  expect(await texts($, BAND)).toBe('✻ dry-run  ⊘ GATE LOCKED  ◆ 2/7  │ ○ Coach idle')
})

test('a stored layout of card is the same as none', async ($, on) => {
  seedState(on, { layoutName: 'card' })

  expect(await texts($, BAND)).toContain('◇ 0/7')
})

test('a stored layout that is not known gives the card', async ($, on) => {
  seedState(on, { layoutName: 'grid' })

  expect(await texts($, BAND)).toContain('◇ 0/7')
})

test('the finished coach is one amber line in the band and the box', async ($, on) => {
  seedState(on, { coachState: 'done', coachFlags: 1 })

  expect(await texts($, BAND)).toContain('◆ 1 flag')
  expect(await texts($, PANE)).toContain('Coach done · 1 flag')
})
