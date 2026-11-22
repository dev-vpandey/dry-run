import { expect, test } from 'claude-code/testing'
import { namesOf, parseCard, repoUnlockLine, sectionPills, statusLineText } from './design-card'

// Written out here on purpose: the test must not share the mod's list.
const NAMES = { patterns: ['Strategy', 'Observer'], dsa: ['Two pointers', 'Hash map / set lookup'] }

const DRY_RUN = [
  '## Dry run',
  '### 1. Bug and goal',
  '**Bug:** none',
  '**Goal:** show the gate at a glance',
  '### 2. Change table',
  '| a.ts | edit | why |',
  '### 3. SOLID',
  '╔═══════════╦═══════╦═════╗',
  '║ Principle ║ Where ║ Why ║',
  '╠═══════════╬═══════╬═════╣',
  '║ Single Responsibility ║ card.ts ║ one job ║',
  '╚═══════════╩═══════╩═════╝',
  '### 4. Pattern',
  '**Chosen:** Strategy',
  'Strategy wins because two variants exist today.',
  'Rejected: Factory Method, because one type.',
  '### 5. DSA',
  '**Chosen:** Bloom filter',
  'Cheap membership test.',
  'Big-O: O(1) per lookup.',
  'Two Sum · Easy · https://leetcode.com/problems/two-sum/',
  '3Sum · Medium · https://leetcode.com/problems/3sum/',
  '### 6. Worked example',
  'x',
  '### 7. Open decisions',
  'y',
].join('\n')

test('a dry run fills the four boxes', async () => {
  const card = parseCard(DRY_RUN, NAMES)
  expect(card.goal).toBe('show the gate at a glance')
  expect(card.solid).toEqual({ rows: [{ name: 'Single Responsibility', why: 'one job' }], note: '' })
  expect(card.pattern).toEqual({
    name: 'Strategy',
    why: 'Strategy wins because two variants exist today.',
    note: '',
  })
  expect(card.dsa.name).toBe('Bloom filter')
  expect(card.dsa.why).toBe('Cheap membership test.')
  expect(card.dsa.bigO).toBe('O(1) per lookup.')
  expect(card.done).toEqual(['Goal', 'SOLID', 'Pattern', 'DSA'])
})

test('a SOLID section with no table keeps its words as a note', async () => {
  const text = ['### 3. SOLID', 'None at stake: small'].join('\n')
  expect(parseCard(text, NAMES).solid).toEqual({ rows: [], note: 'None at stake: small' })
})

test('a name off the list says so, and a link-less name has no verified link', async () => {
  const card = parseCard(DRY_RUN, NAMES)
  expect(card.dsa.note).toBe('not on list · no verified link')
  expect(parseCard(DRY_RUN.replace('Bloom filter', 'two pointers'), NAMES).dsa.note).toBe('')
})

test('with no names file nothing is called off the list', async () => {
  expect(parseCard(DRY_RUN, null).dsa.note).toBe('')
  expect(parseCard(DRY_RUN, null).pattern.note).toBe('')
})

test('chosen none is not off the list', async () => {
  const text = DRY_RUN.replace('**Chosen:** Strategy', '**Chosen:** none')
  expect(parseCard(text, NAMES).pattern.note).toBe('')
})

test('LeetCode rows come from the DSA section', async () => {
  expect(parseCard(DRY_RUN, NAMES).dsa.rows).toEqual([
    { title: 'Two Sum', difficulty: 'E', url: 'https://leetcode.com/problems/two-sum/' },
    { title: '3Sum', difficulty: 'M', url: 'https://leetcode.com/problems/3sum/' },
  ])
})

test('a heading inside a code fence is not a section', async () => {
  const text = ['### 4. Pattern', '**Chosen:** Observer', '```', '### 5. DSA', '**Chosen:** x', '```'].join('\n')
  expect(parseCard(text, NAMES).done).toEqual(['Pattern'])
})

test('no text gives an empty card', async () => {
  expect(parseCard('', NAMES).done).toEqual([])
})

test('section pills mark the done ones', async () => {
  expect(sectionPills(['Goal', 'DSA'])).toEqual([
    { name: 'Goal', isDone: true },
    { name: 'SOLID', isDone: false },
    { name: 'Pattern', isDone: false },
    { name: 'DSA', isDone: true },
  ])
})

test('the status line names the gate, the count and the repo', async () => {
  expect(statusLineText({ gate: 'locked', count: 3, isRepo: false })).toBe('⊘ dry-run locked · 3/4')
  expect(statusLineText({ gate: 'open', count: 4, isRepo: false })).toBe('✓ dry-run open · 4/4')
  expect(statusLineText({ gate: 'open', count: 4, isRepo: true })).toBe('✓ dry-run open (repo) · 4/4')
})

test('the repo-unlock line counts the paths', async () => {
  expect(repoUnlockLine(0)).toBe('')
  expect(repoUnlockLine(1)).toBe('1 repo-unlocked path')
  expect(repoUnlockLine(2)).toBe('2 repo-unlocked paths')
})

test('names are read from the names file', async () => {
  const text = 'SOLID: A, B\nPatterns: Strategy, Factory Method\nDSA: Two pointers, Union-find'
  expect(namesOf(text)).toEqual({ patterns: ['Strategy', 'Factory Method'], dsa: ['Two pointers', 'Union-find'] })
})
