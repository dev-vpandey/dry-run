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

const BUDDY = { layoutName: 'buddy' }

test('the buddy band is a sentence, the gate and n/4: locked', async ($, on) => {
  seedState(on, BUDDY)

  expect(await texts($, BAND)).toBe('✻ Gate locked. Ask for a change and I will post a dry run first. │  ⊘ GATE LOCKED  0/4')
})

test('while a section is written the sentence spins', async ($, on) => {
  seedState(on, { ...BUDDY, liveSection: 'SOLID' })

  const spinners = await clients($, BAND)
  expect(spinners.map(node => node.key)).toEqual(['spin-say'])
  expect(spinners[0]?.props.props).toEqual({ label: 'Drafting the dry run…', color: '#d77757' })
  expect(await texts($, BAND)).toContain(' 1/4')
})

test('while the coach reads the sentence spins too', async ($, on) => {
  seedState(on, { ...BUDDY, coachState: 'reviewing' })

  const spinners = await clients($, BAND)
  expect(spinners[0]?.props.props).toMatchObject({ label: 'The coach is reading your files.' })
})

test('an open gate says go and counts the written sections', async ($, on) => {
  seedState(on, { ...BUDDY, isOpen: true, dryRunText: TWO_SECTIONS })

  const all = await texts($, BAND)
  expect(all).toContain('Go! Edits are open for this dry run.')
  expect(all).toContain('GATE OPEN')
  expect(all).toContain(' 2/4')
})

test('the buddy pane has a big Clawd, the sentence, the gate and three tiles', async ($, on) => {
  seedState(on, { ...BUDDY, dryRunText: TWO_SECTIONS })

  const all = await texts($, PANE)
  expect((await clients($, PANE)).some(node => String(node.key).startsWith('clawd-'))).toBe(true)
  expect(all).toContain('Gate locked. Ask for a change')
  expect(all).toContain('GATE LOCKED')
  expect(all).toContain('✓ SOLID')
  expect(all).toContain('○ PATTERN')
  expect(all).toContain('○ DSA')
  expect(all).toContain('None at stake')
})

test('the buddy pane ends with the coach and Go', async ($, on) => {
  seedState(on, { ...BUDDY, isWaiting: true, coachState: 'done', coachFlags: 2 })

  const all = await texts($, PANE)
  expect(all).toContain('Coach done · 2 flags')
  expect(all).toContain('Coach says: 2 things to check.')
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const go = await ui.find({ type: 'Button', key: 'go' })
  await ui.unmount()
  expect(go).toBeDefined()
})

test('with no Client the sentence is still ✻ text', async ($, on) => {
  seedState(on, { ...BUDDY, liveSection: 'Goal' })

  expect(await clients($, BAND, 'vscode')).toEqual([])
  expect(await texts($, BAND, 'vscode')).toContain('✻ Drafting the dry run…')
})

const FOUR = [TWO_SECTIONS, '### 4. Pattern', '**Chosen:** none', 'No pattern, because one rule today.', '### 5. DSA', '**Chosen:** Bloom filter', 'Cheap test.', 'Big-O: O(1).', 'Two Sum · Easy · https://leetcode.com/problems/two-sum/'].join('\n')

test('the LeetCode rows sit under Practice once the four sections are written, not in the DSA tile', async ($, on) => {
  seedState(on, { ...BUDDY, dryRunText: FOUR })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const all = (await ui.findAll({ type: 'Text' })).map(node => node.text)
  await ui.unmount()

  expect(all).toContain('Practice')
  expect(all.indexOf('Practice')).toBeGreaterThan(all.findIndex(text => text.includes('O(1)')))
  expect(all.filter(text => text.trim() === 'E')).toHaveLength(1)
})

test('no Practice header before the four sections are written', async ($, on) => {
  seedState(on, { ...BUDDY, dryRunText: TWO_SECTIONS })

  expect(await texts($, PANE)).not.toContain('Practice')
})
