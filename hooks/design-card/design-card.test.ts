import { expect, test } from 'claude-code/testing'
import { foldAll, namesOf, parseCard, listOf, repoUnlockLine, sectionCount, statusLineText, toggleFold, topFill, wrapWords } from './design-card'

// Written out here on purpose: the test must not share the mod's list.
const NAMES = { patterns: ['Strategy', 'Observer'], dsa: ['Two pointers', 'Hash map / set lookup'] }

const DRY_RUN = [
  '## Dry run',
  '### 1. Bug and goal',
  '**Bug:** none',
  '**Goal:** show the gate at a glance',
  '### 2. Change table',
  '╔════════════════╦═════════════╦═══════════╗',
  '║ File           ║ Change      ║ Why       ║',
  '╠════════════════╬═════════════╬═══════════╣',
  '║ hooks/a.ts     ║ new function ║ drops dupes ║',
  '║ hooks/a.test.ts ║ 3 cases    ║ cover it  ║',
  '╚════════════════╩═════════════╩═══════════╝',
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
  '- Input: [a, b, a]',
  '- Old: keeps 3',
  '- New: keeps 2',
  '### 7. Open decisions',
  '1. Keep it a normal section. Go works anyway.',
  '2. Make Go wait for the pick.',
  'My pick: 1',
  '### 8. Language explainer',
  '| Construct | Java |',
  '|---|---|',
  '| set | HashSet |',
  '| for x in xs | for (X x : xs) |',
  'Flow: [a, b, a] gives [a, b].',
].join('\n')

test('a dry run fills the boxes', async () => {
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
  expect(card.done).toEqual([
    'Goal',
    'Change table',
    'SOLID',
    'Pattern',
    'DSA',
    'Worked example',
    'Open decisions',
    'Language explainer',
  ])
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

test('the change table gives a row per file, new or edit', async () => {
  expect(parseCard(DRY_RUN, NAMES).changes).toEqual([
    { path: 'hooks/a.ts', what: 'new function', why: 'drops dupes', tag: 'new' },
    { path: 'hooks/a.test.ts', what: '3 cases', why: 'cover it', tag: 'edit' },
  ])
})

test('a change table with no header row keeps its first row', async () => {
  const text = ['### 2. Change table', '| a.ts | edit | why |'].join('\n')
  expect(parseCard(text, NAMES).changes).toEqual([{ path: 'a.ts', what: 'edit', why: 'why', tag: 'edit' }])
})

test('the worked example reads input, old and new', async () => {
  expect(parseCard(DRY_RUN, NAMES).example).toEqual({ input: '[a, b, a]', old: 'keeps 3', now: 'keeps 2' })
})

test('a worked example on one line is split at the arrows', async () => {
  const text = ['### 6. Worked example', '[a, b, a] → keeps 3 → keeps 2'].join('\n')
  expect(parseCard(text, NAMES).example).toEqual({ input: '[a, b, a]', old: 'keeps 3', now: 'keeps 2' })
})

test('open decisions give the options and mark the pick', async () => {
  expect(parseCard(DRY_RUN, NAMES).decisions).toEqual([
    { text: 'Keep it a normal section. Go works anyway.', isPick: true },
    { text: 'Make Go wait for the pick.', isPick: false },
  ])
})

test('open decisions that say none give no options', async () => {
  const text = ['### 7. Open decisions', 'none'].join('\n')
  const card = parseCard(text, NAMES)
  expect(card.decisions).toEqual([])
  expect(card.done).toEqual(['Open decisions'])
})

test('the language explainer gives the construct table and the flow', async () => {
  expect(parseCard(DRY_RUN, NAMES).explainer).toEqual({
    rows: [
      { construct: 'set', java: 'HashSet' },
      { construct: 'for x in xs', java: 'for (X x : xs)' },
    ],
    flow: '[a, b, a] gives [a, b].',
  })
})

test('the count is the required sections written, not the explainer', async () => {
  expect(sectionCount(DRY_RUN)).toBe(7)
  expect(sectionCount(['### 1. Bug and goal', '**Goal:** x'].join('\n'))).toBe(1)
  expect(sectionCount(['### 8. Language explainer', 'Flow: x'].join('\n'))).toBe(0)
})

test('folding a box adds its name, folding it again removes it', async () => {
  expect(toggleFold('', 'Goal')).toBe('Goal')
  expect(toggleFold('Goal', 'DSA')).toBe('Goal,DSA')
  expect(toggleFold('Goal,DSA', 'Goal')).toBe('DSA')
  expect(listOf('Goal,DSA')).toEqual(['Goal', 'DSA'])
  expect(listOf('')).toEqual([])
})

test('fold all folds every shown box, and a second press opens them', async () => {
  expect(foldAll('Goal', ['Goal', 'SOLID'])).toBe('Goal,SOLID')
  expect(foldAll('Goal,SOLID', ['Goal', 'SOLID'])).toBe('')
})

test('the status line names the gate, the count and the repo', async () => {
  expect(statusLineText({ gate: 'locked', count: 3, isRepo: false })).toBe('⊘ dry-run locked · 3/7')
  expect(statusLineText({ gate: 'open', count: 7, isRepo: false })).toBe('✓ dry-run open · 7/7')
  expect(statusLineText({ gate: 'open', count: 7, isRepo: true })).toBe('✓ dry-run open (repo) · 7/7')
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

test('an empty name is not called off the list', async () => {
  const text = ['### 4. Pattern', '**Chosen:**'].join('\n')
  expect(parseCard(text, NAMES).pattern.note).toBe('')
})

test('the top edge fills the width after the corner, the dash and the title', async () => {
  // ╭─ ▾ Goal ───╮ is 1 + 1 + 8 + fill + 1 wide.
  expect(topFill(' ▾ Goal ', 20)).toBe(9)
  expect(topFill(' ▾ A very long title ', 10)).toBe(0)
})

test('words wrap to the width, the first line to its own width', async () => {
  expect(wrapWords('one two three four', 8, 8)).toEqual(['one two', 'three', 'four'])
  expect(wrapWords('one two three', 5, 20)).toEqual(['one', 'two three'])
  expect(wrapWords('', 10, 10)).toEqual([''])
})

function decisionsOf(...lines: string[]) {
  return parseCard(['### 7. Open decisions', ...lines].join('\n'), NAMES).decisions
}

test('a letter pick marks that option', async () => {
  expect(decisionsOf('1. First.', '2. Second.', 'Pick: B').map(d => d.isPick)).toEqual([false, true])
})

test('a pick that is no number or letter marks no option', async () => {
  expect(decisionsOf('1. First.', '2. Second.', 'Pick: none').map(d => d.isPick)).toEqual([false, false])
  expect(decisionsOf('1. First.', '2. Second.', 'Pick:').map(d => d.isPick)).toEqual([false, false])
  expect(decisionsOf('1. First.', '2. Second.', 'Pick: the first one').map(d => d.isPick)).toEqual([false, false])
})

test('a bulleted pick line is not an option', async () => {
  expect(decisionsOf('1. Only option.', '- My pick: 1')).toEqual([{ text: 'Only option.', isPick: true }])
})

test('a line under an option is its context', async () => {
  expect(decisionsOf('1. Keep it.', 'Go works anyway.', '2. Change it.')).toEqual([
    { text: 'Keep it. Go works anyway.', isPick: false },
    { text: 'Change it.', isPick: false },
  ])
})

test('an option label in the text is not doubled', async () => {
  expect(decisionsOf('Option A: Keep it.', 'Option B: Change it.')[0]?.text).toBe('Keep it.')
})

test('a LeetCode row with no known difficulty is not a row', async () => {
  const text = ['### 5. DSA', '**Chosen:** x', 'Odd Problem · Unknown · https://leetcode.com/problems/odd/'].join('\n')
  expect(parseCard(text, NAMES).dsa.rows).toEqual([])
})

test('a Goal line with a list mark, bold or another case still fills the Goal box', () => {
  const goalOf = (line: string) => parseCard(['### 1. Bug and goal', line].join('\n'), NAMES).goal
  expect(goalOf('- **Goal:** boxes fill live')).toBe('boxes fill live')
  expect(goalOf('* goal: boxes fill live')).toBe('boxes fill live')
  expect(goalOf('1. **Goal:** boxes fill live')).toBe('boxes fill live')
})

test('a Goal box with no Goal label shows the first line that is not the Bug line', () => {
  const card = parseCard(['### 1. Bug and goal', '- **Bug:** none', '- Boxes fill as Claude writes.'].join('\n'), NAMES)
  expect(card.goal).toBe('Boxes fill as Claude writes.')
})

test('a Goal box with only a Bug line has no goal yet', () => {
  expect(parseCard(['### 1. Bug and goal', '**Bug:** none'].join('\n'), NAMES).goal).toBe('')
})
