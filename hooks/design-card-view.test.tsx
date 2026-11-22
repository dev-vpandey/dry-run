import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'
import { DARK } from './design-card-colors'
import type { Engine } from 'claude-code/testing'

const PLUGIN = 'dry-run'

const PANE = {
  plugin: PLUGIN,
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

const BAND = {
  plugin: PLUGIN,
  component: 'AbovePrompt',
  requestId: 'band',
  props: { hasSurvey: false, isCollapsed: false, isWorking: false, maxRows: 3, bodyColumns: 80, scroll: { offset: 0, bodyRows: 3 }, view: {} },
} as const

const NAMES_FILE = 'Patterns: Strategy\nDSA: Two pointers'

const DRY_RUN = [
  '## Dry run',
  '### 1. Bug and goal',
  '**Goal:** show the gate',
  '### 2. Change table',
  '| a.ts | edit | why |',
  '### 3. SOLID',
  '║ Principle ║ Where ║ Why ║',
  '║ Single Responsibility ║ card.ts ║ one job ║',
  '### 4. Pattern',
  '**Chosen:** Strategy',
  'Two variants exist.',
  '### 5. DSA',
  '**Chosen:** Bloom filter',
  'Cheap test.',
  'Big-O: O(1).',
  'Two Sum · Easy · https://leetcode.com/problems/two-sum/',
  '### 6. Worked example',
  'x',
  '### 7. Open decisions',
  'y',
].join('\n')

type Seed = { isOpen?: boolean; isWaiting?: boolean; isSkipped?: boolean; isOff?: boolean; isSoft?: boolean; text?: string; repoFile?: string }

// The state the engine holds, by key. A key not seeded reads as never written.
function seedState(on: On, seed: Seed, writes: string[] = []) {
  const values = new Map<string, unknown>([
    ['isOpen', seed.isOpen],
    ['isWaiting', seed.isWaiting],
    ['isSkipped', seed.isSkipped],
    ['isOff', seed.isOff],
    ['isSoft', seed.isSoft],
    ['dryRunText', seed.text],
    ['repoFile', seed.repoFile],
  ])
  let version = 1
  on('state.get', (_: unknown, e: { plugin: string; key: string }) => {
    return values.has(e.key) && values.get(e.key) !== undefined
      ? { value: { value: values.get(e.key), version } }
      : { value: { value: undefined, version: 0 } }
  })
  on('state.set', (_: unknown, e: { plugin: string; key: string; value: unknown }) => {
    writes.push(`${e.key}=${String(e.value)}`)
    values.set(e.key, e.value)
    version += 1
    return { value: { isSet: true, version } }
  })
  on('fs.read', () => ({ value: NAMES_FILE }))
  on('ui.toast', () => ({ value: undefined }))
  on('ui.status', () => ({ value: undefined }))
}

async function paneTexts($: Engine, surface: 'terminal' | 'desktop' | 'vscode' | 'mobile') {
  const ui = await $.ui.mount({ ...PANE, surface })
  const texts = (await ui.findAll({ type: 'Text' })).map(node => node.text)
  await ui.unmount()
  return texts.join('\n')
}

test('the pane shows the four boxes on every surface', async ($, on) => {
  seedState(on, { isWaiting: true, text: DRY_RUN })

  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const all = await paneTexts($, surface)
    expect(all).toContain('show the gate')
    expect(all).toContain('Single Responsibility')
    expect(all).toContain('one job')
    expect(all).toContain('Strategy')
    expect(all).toContain('Bloom filter')
    expect(all).toContain('not on list · no verified link')
    expect(all).toContain('O(1).')
    expect(all).not.toContain('Big-O:')
  }
})

test('the DSA box lists LeetCode rows as links', async ($, on) => {
  seedState(on, { text: DRY_RUN })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const link = await ui.find({ type: 'Link' })
  await ui.unmount()

  expect(link?.props.href).toBe('https://leetcode.com/problems/two-sum/')
  expect(link?.props.label).toBe('Two Sum')
})

test('the pane has Go when a dry run waits, and Go opens the gate', async ($, on) => {
  const writes: string[] = []
  seedState(on, { isWaiting: true, text: DRY_RUN }, writes)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Button', key: 'go' }))?.props.label).toBe('▶ Go [g]')
  await ui.press({ key: 'go' })
  await ui.unmount()

  expect(writes).toContain('isOpen=true')
  expect(writes).toContain('isWaiting=false')
})

test('with nothing waiting, Go is dimmed and says it needs a dry run', async ($, on) => {
  seedState(on, {})

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Button', key: 'go' })).toBeUndefined()
  expect((await ui.find({ type: 'Text', text: /needs a dry run/ }))?.text).toContain('needs a dry run')
  await ui.unmount()
})

test('after a go the pane says approved and offers /stop, which locks the gate', async ($, on) => {
  const writes: string[] = []
  seedState(on, { isOpen: true, text: DRY_RUN }, writes)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /Approved/ }))?.text).toContain('✓ Approved for this dry run')
  await ui.press({ key: 'stop' })
  await ui.unmount()

  expect(writes).toContain('isOpen=false')
})

test('a gate opened by "just do it" says the dry run was skipped', async ($, on) => {
  seedState(on, { isOpen: true, isSkipped: true })

  expect(await paneTexts($, 'terminal')).toContain('dry run skipped')
})

test('the pane shows the count of repo-unlocked paths', async ($, on) => {
  seedState(on, { repoFile: JSON.stringify({ mode: 'on', hasMode: false, lock: [], unlock: ['.sql', 'gen/'], platform: null }) })

  expect(await paneTexts($, 'terminal')).toContain('2 repo-unlocked paths')
})

test('the band shows the gate pill and the section pills', async ($, on) => {
  seedState(on, { text: DRY_RUN.split('### 5. DSA')[0] ?? '' })

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const all = (await ui.findAll({ type: 'Text' })).map(node => node.text).join('')
  await ui.unmount()

  expect(all).toContain('✻ dry-run')
  expect(all).toContain('⊘ GATE LOCKED')
  expect(all).toContain('◆ Goal')
  expect(all).toContain('◆ SOLID')
  expect(all).toContain('◆ Pattern')
  expect(all).toContain('◇ DSA')
})

test('the band shows an open gate', async ($, on) => {
  seedState(on, { isOpen: true, text: DRY_RUN })

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const all = (await ui.findAll({ type: 'Text' })).map(node => node.text).join('')
  await ui.unmount()

  expect(all).toContain('✓ GATE OPEN')
})

test('the band is left to the engine while off', async ($, on) => {
  seedState(on, { isOff: true })
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /engine/ }))?.text).toBe('engine')
  await ui.unmount()
})

test('the band names done sections in the Claude color on a tint', async ($, on) => {
  seedState(on, { text: DRY_RUN })

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const goal = await ui.find({ type: 'Text', text: /◆ Goal/ })
  const title = await ui.find({ type: 'Text', text: /dry-run/ })
  await ui.unmount()

  expect(goal?.props.color).toBe(DARK.claude)
  expect(goal?.props.backgroundColor).toBe(DARK.claudeBg)
  expect(title?.props.bold).toBe(true)
})

test('the pane puts each name in a pill and keeps its why dim', async ($, on) => {
  seedState(on, { text: DRY_RUN })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const solid = await ui.find({ type: 'Text', text: /Single Responsibility/ })
  const pattern = await ui.find({ type: 'Text', text: /Strategy/ })
  const why = await ui.find({ type: 'Text', text: /one job/ })
  const bigO = await ui.find({ type: 'Text', text: /O\(1\)/ })
  await ui.unmount()

  expect(solid?.props.backgroundColor).toBe(DARK.claude)
  expect(pattern?.props.backgroundColor).toBe(DARK.violetBg)
  expect(why?.props.dimColor).toBe(true)
  expect(bigO?.props.dimColor).toBe(true)
})

test('a LeetCode row has a blue mark and a level colored by difficulty', async ($, on) => {
  seedState(on, { text: DRY_RUN })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const mark = await ui.find({ type: 'Text', text: /○/ })
  const level = await ui.find({ type: 'Text', text: /^E/ })
  await ui.unmount()

  expect(mark?.props.color).toBe(DARK.blue)
  expect(level?.props.color).toBe(DARK.green)
})

test('the title is bold and Design Card is dim', async ($, on) => {
  seedState(on, {})

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const name = await ui.find({ type: 'Text', text: /Design Card/ })
  await ui.unmount()

  expect(name?.props.dimColor).toBe(true)
})

test('Go has a hint for the other ways to approve', async ($, on) => {
  seedState(on, { isWaiting: true, text: DRY_RUN })

  expect(await paneTexts($, 'terminal')).toContain('or type /go · "go ahead"')
})

test('the approved line is a green pill', async ($, on) => {
  seedState(on, { isOpen: true, text: DRY_RUN })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const approved = await ui.find({ type: 'Text', text: /Approved/ })
  await ui.unmount()

  expect(approved?.props.backgroundColor).toBe(DARK.greenBg)
})
