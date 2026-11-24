import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

const PANE = {
  plugin: 'dry-run',
  component: 'Pane',
  requestId: 'design-card',
  props: { title: 'dry-run · Design Card', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
} as const

function seedState(on: On, seed: Record<string, unknown>) {
  const values = new Map<string, unknown>(Object.entries(seed))
  on('state.get', (_: unknown, e: { key: string }) => ({ value: { value: values.get(e.key), version: values.has(e.key) ? 1 : 0 } }))
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

test('the coach line of an idle coach', async ($, on) => {
  seedState(on, {})
  expect(await texts($)).toContain('○ Coach idle')
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
