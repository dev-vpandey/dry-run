// Pure code for the Design Card: read a dry run into boxes, and build the
// short texts the band and the status line show. No engine calls here.
// Rules: SPEC section 6. Heading names match dry-run-check.ts.

import { linesOf } from './dry-run-check'

// The id and title of the Design Card pane. register.ts opens it at session start.
export const PANE_ID = 'design-card'
export const PANE_TITLE = 'dry-run · Design Card'

// The gate as the status line names it. The view adds 'soft' for the repo's soft mode.
export type Gate = 'locked' | 'open'

export type SectionName =
  | 'Goal'
  | 'Change table'
  | 'SOLID'
  | 'Pattern'
  | 'DSA'
  | 'Worked example'
  | 'Open decisions'
  | 'Language explainer'

// Each box name, with the heading of its section in a dry run, in dry-run order.
const SECTIONS: readonly { name: SectionName; heading: string }[] = [
  { name: 'Goal', heading: '### 1. Bug and goal' },
  { name: 'Change table', heading: '### 2. Change table' },
  { name: 'SOLID', heading: '### 3. SOLID' },
  { name: 'Pattern', heading: '### 4. Pattern' },
  { name: 'DSA', heading: '### 5. DSA' },
  { name: 'Worked example', heading: '### 6. Worked example' },
  { name: 'Open decisions', heading: '### 7. Open decisions' },
  { name: 'Language explainer', heading: '### 8. Language explainer' },
]

// The explainer is required only for a reader language and another language in the change
// table (dry-run-check.ts). The count, the band and the status line leave it out.
export const EXPLAINER_SECTION: SectionName = 'Language explainer'
export const SECTION_TOTAL = SECTIONS.length - 1

// The box names in dry-run order.
export const SECTION_NAMES: readonly SectionName[] = SECTIONS.map(section => section.name)

const CHOSEN = '**Chosen:**'
const GOAL = '**Goal:**'
const BIG_O = 'Big-O:'
const LEETCODE_START = 'https://leetcode.com/'
const NOT_ON_LIST = 'not on list'
const NO_LINK = 'no verified link'

export type Names = { patterns: string[]; dsa: string[] }
export type Choice = { name: string; why: string; note: string }
export type LeetRow = { title: string; difficulty: 'E' | 'M' | 'H'; url: string }
// One row of the SOLID table: the principle and why it is in play.
export type Principle = { name: string; why: string }
export type ChangeRow = { path: string; what: string; why: string; tag: 'new' | 'edit' }
export type Example = { input: string; old: string; now: string }
export type Decision = { text: string; isPick: boolean }
export type Explainer = { rows: { construct: string; java: string }[]; flow: string }
export type Card = {
  goal: string
  changes: ChangeRow[]
  example: Example
  decisions: Decision[]
  explainer: Explainer
  // The table rows, or the words of a section that has no table ("None at stake: ...").
  solid: { rows: Principle[]; note: string }
  pattern: Choice
  dsa: Choice & { bigO: string; rows: LeetRow[] }
  // The boxes that have text, in box order.
  done: SectionName[]
}

// The names of the names file: the "Patterns:" and "DSA:" lines, split on commas.
export function namesOf(text: string): Names {
  const names: Names = { patterns: [], dsa: [] }
  for (const line of text.split('\n')) {
    if (line.startsWith('Patterns:')) {
      names.patterns = listOf(line.slice('Patterns:'.length))
    } else if (line.startsWith('DSA:')) {
      names.dsa = listOf(line.slice('DSA:'.length))
    }
  }
  return names
}

export function listOf(text: string): string[] {
  return text
    .split(',')
    .map(item => item.trim())
    .filter(item => item !== '')
}

function isHeading(line: string): boolean {
  return line.startsWith('## ') || line.startsWith('### ')
}

// The lines under one heading, up to the next heading. Empty lines are dropped.
function sectionLines(lines: string[], heading: string): string[] {
  const body: string[] = []
  let isInside = false
  for (const line of lines) {
    if (line === heading) {
      isInside = true
    } else if (isInside && isHeading(line)) {
      break
    } else if (isInside && line.trim() !== '') {
      body.push(line.trim())
    }
  }
  return body
}

function isTableLine(line: string): boolean {
  return line.startsWith('║') || line.startsWith('|')
}

// Only box-drawing and dash characters: a border or a separator row.
function isBorder(line: string): boolean {
  return !/[A-Za-z0-9]/.test(line)
}

// The cells of a table row, without the edges.
function cellsOf(row: string): string[] {
  const edge = row.startsWith('║') ? '║' : '|'
  return row
    .split(edge)
    .map(cell => cell.trim())
    .filter(cell => cell !== '')
}

// The data rows of a table. The first row is a header when a border or a separator line
// follows it; a table with no separator has no header.
function bodyRows(body: string[]): string[] {
  const rows = body.filter(line => isTableLine(line) && !isBorder(line))
  const hasSeparator = body.some(line => isBorder(line))
  return hasSeparator ? rows.slice(1) : rows
}

// The SOLID box: one row per principle of the table (columns are principle, where, why),
// or the plain text when the section is not a table.
function solidOf(body: string[]): Card['solid'] {
  if (!body.some(isTableLine)) {
    return { rows: [], note: body.join(' ') }
  }
  return {
    rows: bodyRows(body).map(row => {
      const cells = cellsOf(row)
      return { name: cells[0] ?? '', why: cells[2] ?? '' }
    }),
    note: '',
  }
}

// One row per file of the change table: path, what changes, why.
function changesOf(body: string[]): ChangeRow[] {
  return bodyRows(body).map(row => {
    const cells = cellsOf(row)
    const what = cells[1] ?? ''
    return { path: cells[0] ?? '', what, why: cells[2] ?? '', tag: what.toLowerCase().startsWith('new') ? 'new' : 'edit' }
  })
}

// A line without its list mark and bold marks: "- **Old:** x" gives "Old: x".
function plain(line: string): string {
  return line.replace(/^([-*•]|\d+[.)])\s+/, '').split('**').join('').trim()
}

// The worked example: "Input:", "Old:" and "New:" lines, or one line "input → old → new".
function exampleOf(body: string[]): Example {
  const parts = body.map(line => plain(line).split('→').map(part => part.trim())).find(list => list.length >= 3)
  const fromArrows = parts ?? ['', '', '']
  return {
    input: valueAfter(body, 'input:', true) || (fromArrows[0] ?? ''),
    old: valueAfter(body, 'old:', true) || (fromArrows[1] ?? ''),
    now: valueAfter(body, 'new:', true) || fromArrows.slice(2).join(' → '),
  }
}

// The labels of the options. Two at most, as the format says.
export const DECISION_LABELS = ['A', 'B'] as const

function isPickLine(line: string): boolean {
  return /^(my )?pick\b/i.test(plain(line))
}

// The option the "My pick: 1" or "Pick: A" line names, as an index, or -1 when it names none.
function pickIndexOf(body: string[]): number {
  const line = body.find(isPickLine)
  const after = line === undefined ? '' : (plain(line).toLowerCase().split('pick:')[1] ?? '')
  // A lone digit or letter names an option. A word or a sentence does not.
  const token = after.replace('option', '').trim().split(/[\s.,)]/)[0] ?? ''
  if (!/^[a-z0-9]$/.test(token)) {
    return -1
  }
  const index = /\d/.test(token) ? Number(token) - 1 : token.charCodeAt(0) - 'a'.charCodeAt(0)
  return index < DECISION_LABELS.length ? index : -1
}

function isOptionLine(line: string): boolean {
  return /^([-*•]|\d+[.)])\s+|^option\s+\w+\s*[:.)]/i.test(line) && !isPickLine(line)
}

// The options of the open decisions: numbered or bulleted lines, two at most. A line under an
// option, that is not a pick line, is that option's context.
function decisionsOf(body: string[]): Decision[] {
  const texts: string[] = []
  for (const line of body) {
    if (isOptionLine(line)) {
      texts.push(plain(line).replace(/^option\s+\w+\s*[:.)]\s*/i, ''))
    } else if (texts.length > 0 && !isPickLine(line) && line.toLowerCase() !== 'none') {
      texts[texts.length - 1] = `${texts[texts.length - 1]} ${plain(line)}`
    }
  }
  const pick = pickIndexOf(body)
  return texts.slice(0, DECISION_LABELS.length).map((text, index) => ({ text, isPick: index === pick }))
}

// The language explainer: a construct to equivalent table, then a "Flow:" line.
function explainerOf(body: string[]): Explainer {
  const rows = bodyRows(body).map(row => {
    const cells = cellsOf(row)
    return { construct: cells[0] ?? '', java: cells[1] ?? '' }
  })
  return { rows, flow: valueAfter(body, 'flow:', true) }
}

// The first line after the "**Chosen:**" line that is not a Big-O or link line.
function whyOf(body: string[]): string {
  for (const line of body) {
    if (!line.startsWith(CHOSEN) && !line.startsWith(BIG_O) && !line.includes(' · ')) {
      return line
    }
  }
  return ''
}

// The text after a prefix on the first line that starts with it, or "". A loose match ignores
// case, a list mark and bold marks: "- **Old:** x" matches "old:".
function valueAfter(body: string[], prefix: string, isLoose = false): string {
  for (const line of body) {
    const text = isLoose ? plain(line) : line
    const starts = isLoose ? text.toLowerCase().startsWith(prefix.toLowerCase()) : text.startsWith(prefix)
    if (starts) {
      return text.slice(prefix.length).trim()
    }
  }
  return ''
}

function isOnList(name: string, list: string[]): boolean {
  const lower = name.toLowerCase()
  return lower === 'none' || list.some(item => item.toLowerCase() === lower)
}

function difficultyOf(word: string): 'E' | 'M' | 'H' | null {
  const first = word.trim().charAt(0).toUpperCase()
  if (first === 'E' || first === 'M' || first === 'H') {
    return first
  }
  return null
}

// "title · difficulty · url" lines of the DSA section.
function rowsOf(body: string[]): LeetRow[] {
  const rows: LeetRow[] = []
  for (const line of body) {
    const parts = line.split(' · ')
    const difficulty = parts.length === 3 ? difficultyOf(parts[1] ?? '') : null
    const url = (parts[2] ?? '').trim()
    if (difficulty !== null && url.startsWith(LEETCODE_START)) {
      rows.push({ title: (parts[0] ?? '').trim(), difficulty, url })
    }
  }
  return rows
}

// What a box says about its name: "" when fine. A name off the list is shown as such.
// DSA adds "no verified link" because a name off the list has no row in the rules file.
function noteOf(name: string, list: string[] | undefined, isDsa: boolean): string {
  // No names file to check against: say nothing rather than call every name off the list.
  // No name yet: nothing to call off the list.
  if (list === undefined || name === '' || isOnList(name, list)) {
    return ''
  }
  return isDsa ? `${NOT_ON_LIST} · ${NO_LINK}` : NOT_ON_LIST
}

// The card of one dry run text. A text with no sections gives an empty card.
export function parseCard(text: string, names: Names | null): Card {
  const lines = linesOf(text)
  const body = new Map<SectionName, string[]>()
  for (const section of SECTIONS) {
    body.set(section.name, sectionLines(lines, section.heading))
  }
  const patternBody = body.get('Pattern') ?? []
  const dsaBody = body.get('DSA') ?? []
  const patternName = valueAfter(patternBody, CHOSEN)
  const dsaName = valueAfter(dsaBody, CHOSEN)
  return {
    goal: valueAfter(body.get('Goal') ?? [], GOAL),
    changes: changesOf(body.get('Change table') ?? []),
    example: exampleOf(body.get('Worked example') ?? []),
    decisions: decisionsOf(body.get('Open decisions') ?? []),
    explainer: explainerOf(body.get('Language explainer') ?? []),
    solid: solidOf(body.get('SOLID') ?? []),
    pattern: { name: patternName, why: whyOf(patternBody), note: noteOf(patternName, names?.patterns, false) },
    dsa: {
      name: dsaName,
      why: whyOf(dsaBody),
      note: noteOf(dsaName, names?.dsa, true),
      bigO: valueAfter(dsaBody, BIG_O),
      rows: rowsOf(dsaBody),
    },
    done: SECTIONS.filter(section => (body.get(section.name) ?? []).length > 0).map(section => section.name),
  }
}

export type StatusInput = { gate: Gate; count: number; isRepo: boolean }

// The UI status line: gate, count of sections done, and (repo) when the repo set the mode.
export function statusLineText(input: StatusInput): string {
  const mark = input.gate === 'open' ? '✓' : '⊘'
  const repo = input.isRepo ? ' (repo)' : ''
  return `${mark} dry-run ${input.gate}${repo} · ${input.count}/${SECTION_TOTAL}`
}

export function repoUnlockLine(count: number): string {
  if (count === 0) {
    return ''
  }
  return count === 1 ? '1 repo-unlocked path' : `${count} repo-unlocked paths`
}

// How many required sections a dry run text fills. The names do not matter for a count.
export function sectionCount(text: string): number {
  return parseCard(text, null).done.filter(name => name !== EXPLAINER_SECTION).length
}

// The folded boxes are kept as their names joined with commas.
export function toggleFold(text: string, name: string): string {
  const names = listOf(text)
  return (names.includes(name) ? names.filter(item => item !== name) : [...names, name]).join(',')
}

// Folds every shown box, or opens them all when they are all folded already.
export function foldAll(text: string, shown: string[]): string {
  const names = listOf(text)
  return shown.every(name => names.includes(name)) ? '' : shown.join(',')
}

// The dashes of a box's top edge: ╭─ title ────╮ is 1 + 1 + title + dashes + 1 wide.
export function topFill(title: string, width: number): number {
  return Math.max(0, width - 3 - title.length)
}

// Words wrapped to lines. The first line has its own width, because a pill may stand before it.
// A word longer than a line stays whole on a line of its own.
export function wrapWords(text: string, firstWidth: number, width: number): string[] {
  const lines: string[] = ['']
  for (const word of text.split(' ').filter(item => item !== '')) {
    const last = lines.length - 1
    const limit = last === 0 ? firstWidth : width
    const current = lines[last] ?? ''
    if (current === '') {
      lines[last] = word
    } else if (current.length + 1 + word.length <= limit) {
      lines[last] = `${current} ${word}`
    } else {
      lines.push(word)
    }
  }
  return lines
}
