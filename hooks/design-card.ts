// Pure code for the Design Card: read a dry run into four boxes, and build the
// short texts the band and the status line show. No engine calls here.
// Rules: SPEC section 6. Heading names match dry-run-check.ts.

import { linesOf } from './dry-run-check'

// The id and title of the Design Card pane. register.ts opens it at session start.
export const PANE_ID = 'design-card'
export const PANE_TITLE = 'dry-run · Design Card'

// The gate as the status line names it. The view adds 'soft' for the repo's soft mode.
export type Gate = 'locked' | 'open'

export type SectionName = 'Goal' | 'SOLID' | 'Pattern' | 'DSA'

// Each box name, with the heading of its section in a dry run.
const SECTIONS: readonly { name: SectionName; heading: string }[] = [
  { name: 'Goal', heading: '### 1. Bug and goal' },
  { name: 'SOLID', heading: '### 3. SOLID' },
  { name: 'Pattern', heading: '### 4. Pattern' },
  { name: 'DSA', heading: '### 5. DSA' },
]

const CHOSEN = '**Chosen:**'
const GOAL = '**Goal:**'
const BIG_O = 'Big-O:'
const LEETCODE_START = 'https://leetcode.com/'
const NOT_ON_LIST = 'not on list'
const NO_LINK = 'no verified link'

export type Names = { patterns: string[]; dsa: string[] }
export type Choice = { name: string; why: string; note: string }
export type LeetRow = { title: string; difficulty: 'E' | 'M' | 'H'; url: string }
export type Card = {
  goal: string
  solid: string
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

function listOf(text: string): string[] {
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

// The SOLID box: the principle names of the table (first column, header row skipped),
// or the plain text when the section is not a table ("None at stake: ...").
function solidText(body: string[]): string {
  const rows = body.filter(line => isTableLine(line) && !isBorder(line))
  if (rows.length === 0) {
    return body.join(' ')
  }
  return rows
    .slice(1)
    .map(row => cellsOf(row)[0] ?? '')
    .join(', ')
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

// The text after a prefix on the first line that starts with it, or "".
function valueAfter(body: string[], prefix: string): string {
  for (const line of body) {
    if (line.startsWith(prefix)) {
      return line.slice(prefix.length).trim()
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
  if (list === undefined || isOnList(name, list)) {
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
    solid: solidText(body.get('SOLID') ?? []),
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

export function sectionPills(done: SectionName[]): { name: SectionName; isDone: boolean }[] {
  return SECTIONS.map(section => ({ name: section.name, isDone: done.includes(section.name) }))
}

export type StatusInput = { gate: Gate; count: number; isRepo: boolean }

// The UI status line: gate, count of sections done, and (repo) when the repo set the mode.
export function statusLineText(input: StatusInput): string {
  const mark = input.gate === 'open' ? '✓' : '⊘'
  const repo = input.isRepo ? ' (repo)' : ''
  return `${mark} dry-run ${input.gate}${repo} · ${input.count}/${SECTIONS.length}`
}

export function repoUnlockLine(count: number): string {
  if (count === 0) {
    return ''
  }
  return count === 1 ? '1 repo-unlocked path' : `${count} repo-unlocked paths`
}

// How many boxes a dry run text fills. The names do not matter for a count.
export function sectionCount(text: string): number {
  return parseCard(text, null).done.length
}
