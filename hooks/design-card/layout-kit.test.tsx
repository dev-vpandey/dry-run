import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

const PANE = {
  plugin: 'dry-run',
  component: 'Pane',
  requestId: 'design-card',
  props: { title: 'dry-run · Design Card', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
} as const

function seedState(on: On, seed: Record<string, unknown>, writes: string[] = []) {
  const values = new Map<string, unknown>(Object.entries(seed))
  on('state.get', (_: unknown, e: { key: string }) => ({ value: { value: values.get(e.key), version: values.has(e.key) ? 1 : 0 } }))
  on('state.set', (_: unknown, e: { key: string; value: unknown }) => {
    writes.push(`${e.key}=${String(e.value)}`)
    values.set(e.key, e.value)
    return { value: { isSet: true, version: 2 } }
  })
  on('fs.read', () => ({ value: 'Patterns: Strategy\nDSA: Two pointers' }))
}

async function texts($: Engine) {
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const all = (await ui.findAll({ type: 'Text' })).map(node => node.text).join('')
  await ui.unmount()
  return all
}

test('the gate pill says locked, open or soft', async ($, on) => {
  seedState(on, {})
  expect(await texts($)).toContain('⊘ GATE LOCKED')
})

test('an open gate says so and shows the approval with /stop', async ($, on) => {
  seedState(on, { isOpen: true })
  expect(await texts($)).toContain('✓ GATE OPEN')
  expect(await texts($)).toContain('✓ Approved for this dry run')
})

test('soft mode says so', async ($, on) => {
  seedState(on, { isSoft: true })
  expect(await texts($)).toContain('◇ GATE SOFT')
})

test('nothing waiting: Go is off and says why', async ($, on) => {
  seedState(on, {})
  expect(await texts($)).toContain('▶ Go [g] needs a dry run')
})

test('an idle coach has no line: the coach is not built yet', async ($, on) => {
  seedState(on, {})
  expect(await texts($)).not.toContain('Coach')
})

test('the coach line of a skipped coach', async ($, on) => {
  seedState(on, { coachState: 'skipped' })
  expect(await texts($)).toContain('○ Coach skipped')
})

test('the coach line of a down coach', async ($, on) => {
  seedState(on, { coachState: 'down' })
  expect(await texts($)).toContain('✗ Coach unavailable')
})

test('the coach line of a finished coach counts its flags', async ($, on) => {
  seedState(on, { coachState: 'done', coachFlags: 2 })
  expect(await texts($)).toContain('◆ Coach done · 2 flags')
})

const BAND = {
  plugin: 'dry-run',
  component: 'AbovePrompt',
  requestId: 'band',
  props: { hasSurvey: false, isCollapsed: false, isWorking: false, maxRows: 3, bodyColumns: 80, scroll: { offset: 0, bodyRows: 3 }, view: {} },
} as const

test('the pane header has a button for each layout, the one in force marked', async ($, on) => {
  seedState(on, { layoutName: 'rail' })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const buttons = (await ui.findAll({ type: 'Button' })).filter(button => String(button.key).startsWith('layout-'))
  const current = await ui.find({ type: 'Text', text: ' rail ' })
  await ui.unmount()

  expect(buttons.map(button => button.key)).toEqual(['layout-card', 'layout-rail', 'layout-buddy'])
  expect(current?.props.backgroundColor).toBe('#302320')
})

test('pressing a layout button stores that layout for the session', async ($, on) => {
  const writes: string[] = []
  seedState(on, {}, writes)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'layout-buddy' })
  await ui.unmount()

  expect(writes).toContain('layoutName=buddy')
})

async function layoutButtons($: Engine, part: typeof BAND | typeof PANE) {
  const ui = await $.ui.mount({ ...part, surface: 'terminal' })
  const buttons = (await ui.findAll({ type: 'Button' })).filter(button => String(button.key).startsWith('layout-'))
  await ui.unmount()
  return buttons.map(button => button.key)
}

const ALL_LAYOUTS = ['layout-card', 'layout-rail', 'layout-buddy']

test('the band has the buttons in the card layout', async ($, on) => {
  seedState(on, { layoutName: 'card' })
  expect(await layoutButtons($, BAND)).toEqual(ALL_LAYOUTS)
})

test('the band has the buttons in the rail layout', async ($, on) => {
  seedState(on, { layoutName: 'rail' })
  expect(await layoutButtons($, BAND)).toEqual(ALL_LAYOUTS)
})

test('the band has the buttons in the buddy layout', async ($, on) => {
  seedState(on, { layoutName: 'buddy' })
  expect(await layoutButtons($, BAND)).toEqual(ALL_LAYOUTS)
})

test('the rail pane has the buttons', async ($, on) => {
  seedState(on, { layoutName: 'rail' })
  expect(await layoutButtons($, PANE)).toEqual(ALL_LAYOUTS)
})

test('the buddy pane has the buttons', async ($, on) => {
  seedState(on, { layoutName: 'buddy' })
  expect(await layoutButtons($, PANE)).toEqual(ALL_LAYOUTS)
})
