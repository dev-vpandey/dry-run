import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

const BAND = {
  plugin: 'dry-run',
  component: 'AbovePrompt',
  requestId: 'band',
  props: { hasSurvey: false, isCollapsed: false, isWorking: false, maxRows: 3, bodyColumns: 80, scroll: { offset: 0, bodyRows: 3 }, view: {} },
} as const

const GOAL_AND_SOLID = [
  '## Dry run',
  '### 1. Bug and goal',
  '**Goal:** x',
  '### 3. SOLID',
  'None at stake: one function.',
].join('\n')

function seedState(on: On, seed: Record<string, unknown>) {
  const values = new Map<string, unknown>(Object.entries(seed))
  on('state.get', (_: unknown, e: { key: string }) => ({ value: { value: values.get(e.key), version: values.has(e.key) ? 1 : 0 } }))
  on('fs.read', () => ({ value: 'Patterns: Strategy\nDSA: Two pointers' }))
}

async function bandTexts($: Engine, surface: 'terminal' | 'vscode') {
  const ui = await $.ui.mount({ ...BAND, surface })
  const texts = (await ui.findAll({ type: 'Text' })).map(node => node.text).join('')
  await ui.unmount()
  return texts
}

test('the band has one count pill: ◆ with the sections written, no pill per section', async ($, on) => {
  seedState(on, { dryRunText: GOAL_AND_SOLID })

  const all = await bandTexts($, 'terminal')
  expect(all).toContain('◆ 2/7')
  expect(all).not.toContain('Goal')
  expect(all).not.toContain('◇ Pattern')
})

test('with nothing written the count is a dim ◇ 0/7 and nothing spins', async ($, on) => {
  seedState(on, {})

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const spinners = await ui.findAll({ type: 'Client' })
  const all = (await ui.findAll({ type: 'Text' })).map(node => node.text).join('')
  await ui.unmount()

  expect(all).toContain('◇ 0/7')
  expect(spinners).toEqual([])
})

test('the count pill spins while a section is written, and the band names the section', async ($, on) => {
  seedState(on, { liveSection: 'Pattern', dryRunText: GOAL_AND_SOLID })

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const spinner = await ui.find({ type: 'Client', key: 'spin-count' })
  const all = (await ui.findAll({ type: 'Text' })).map(node => node.text).join('')
  await ui.unmount()

  expect(String(spinner?.props.module)).toMatch(/spinner-surface\.tsx$/)
  expect(spinner?.props.props).toMatchObject({ label: '3/7' })
  expect(all).toContain('Pattern')
})

test('only the count pill spins: one Client for a section at work', async ($, on) => {
  seedState(on, { liveSection: 'DSA' })

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const spinners = await ui.findAll({ type: 'Client' })
  await ui.unmount()

  expect(spinners.map(node => node.key)).toEqual(['spin-count'])
})

test('a coach at work spins a plain spinner, with no background, and the engine accepts it', async ($, on) => {
  seedState(on, { coachState: 'reviewing' })

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const spinner = await ui.find({ type: 'Client', key: 'spin-coach' })
  await ui.unmount()

  expect(spinner?.props.props).toEqual({ label: 'Coach reviewing…', color: '#d77757' })
})

test('on a surface with no Client the count pill is a plain ✻ pill', async ($, on) => {
  seedState(on, { liveSection: 'DSA' })

  expect(await bandTexts($, 'vscode')).toContain('✻ 4/7')
})

test('the sections before the one being written count as written, like the prototype', async ($, on) => {
  seedState(on, { liveSection: 'SOLID' })

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const spinner = await ui.find({ type: 'Client', key: 'spin-count' })
  await ui.unmount()

  expect(spinner?.props.props).toMatchObject({ label: '2/7' })
})

test('with the first section live the count is 0/7', async ($, on) => {
  seedState(on, { liveSection: 'Goal' })

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const spinner = await ui.find({ type: 'Client', key: 'spin-count' })
  await ui.unmount()

  expect(spinner?.props.props).toMatchObject({ label: '0/7' })
})

test('the count is the larger of the stored sections and the live section place', async ($, on) => {
  seedState(on, { liveSection: 'Goal', dryRunText: GOAL_AND_SOLID })

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const spinner = await ui.find({ type: 'Client', key: 'spin-count' })
  await ui.unmount()

  expect(spinner?.props.props).toMatchObject({ label: '2/7' })
})

test('the language explainer being live does not push the count past 7', async ($, on) => {
  seedState(on, { liveSection: 'Language explainer' })

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const spinner = await ui.find({ type: 'Client', key: 'spin-count' })
  await ui.unmount()

  expect(spinner?.props.props).toMatchObject({ label: '7/7' })
})
