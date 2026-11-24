// Clawd, the mascot of the Design Card, drawn as text: one costume per state.
// A frame is 4 rows (prop, eyes, body, legs): 3 columns left of Clawd, 9 for Clawd, up to 12
// on the right. Every glyph is single-width. Pure: the surface module draws the frames.
// Rules: SPEC section 6. The art is the prototype's (PROTOTYPE-look-and-feel-v2.html).

import type { Gate, SectionName } from './design-card'

// The Clawd tick: about 6.7 frames a second.
export const TICK_MS = 150

// The color names an art piece uses. The surface module maps each one to a token.
// `claudeHi` is the light peach of the props; `fg` is the plain text color.
export type Hue = 'claude' | 'claudeHi' | 'fg' | 'violet' | 'blue' | 'green' | 'amber' | 'red' | 'dim'
export type Seg = { text: string; hue: Hue; bold?: boolean }
export type Row = Seg[]
export type Frame = Row[]

export type Mood =
  | 'goal'
  | 'table'
  | 'solid'
  | 'pattern'
  | 'dsa'
  | 'example'
  | 'decisions'
  | 'lang'
  | 'reviewing'
  | 'done'
  | 'down'
  | 'skipped'
  | 'locked'
  | 'open'
  | 'soft'

// What the Design Coach is doing. Ticket 29 writes it; until then it stays idle.
export type CoachState = 'idle' | 'reviewing' | 'done' | 'down' | 'skipped'
// The gate as the card shows it: the status line's two states, and soft mode (no gate).
export type GateState = Gate | 'soft'

const CAPTIONS = new Map<Mood, string>([
  ['goal', 'Setting the goal'],
  ['table', 'Listing the changes'],
  ['solid', 'Lifting SOLID'],
  ['pattern', 'Picking a pattern'],
  ['dsa', 'Writing the algorithm'],
  ['example', 'Working an example'],
  ['decisions', 'Weighing the options'],
  ['lang', 'Translating to Java'],
  ['reviewing', 'Architect review'],
  ['done', 'Review done'],
  ['down', 'Coach is down'],
  ['skipped', 'Coach skipped'],
  ['locked', 'Gate locked · napping'],
  ['open', 'Gate open · edits on'],
  ['soft', 'Soft mode · no gate'],
])

// Every mood, in the order of the caption table.
export const MOODS: readonly Mood[] = [...CAPTIONS.keys()]

export function captionOf(mood: Mood): string {
  return CAPTIONS.get(mood) ?? ''
}

// The costume for the section being written.
const SECTION_MOODS = new Map<SectionName, Mood>([
  ['Goal', 'goal'],
  ['Change table', 'table'],
  ['SOLID', 'solid'],
  ['Pattern', 'pattern'],
  ['DSA', 'dsa'],
  ['Worked example', 'example'],
  ['Open decisions', 'decisions'],
  ['Language explainer', 'lang'],
])

export function moodOfSection(name: SectionName): Mood {
  return SECTION_MOODS.get(name) ?? 'goal'
}

export type MoodInput = { live: SectionName | ''; coach: CoachState; gate: GateState }

// A section being written wins. Then a coach at work. Then a finished coach, while the gate is
// still locked: an open gate has its own costume. Last, the gate.
export function moodOf(input: MoodInput): Mood {
  if (input.live !== '') {
    return moodOfSection(input.live)
  }
  if (input.coach === 'reviewing') {
    return 'reviewing'
  }
  if (input.gate === 'locked' && input.coach !== 'idle') {
    return input.coach
  }
  return input.gate
}

// What a failed Client is told as: a toast, and the note kept in state (empty means none).
export function faultToast(phase: string, reason: string): string {
  return `✗ Clawd animation failed (${phase}): ${reason}`
}

export function faultNote(phase: string, reason: string): string {
  return `${phase}: ${reason}`
}

function seg(text: string, hue: Hue = 'claude', isBold = false): Seg {
  return isBold ? { text, hue, bold: true } : { text, hue }
}

const SPACE3: Row = [seg('   ')]
const SPACE9: Row = [seg('         ')]

const EYES = new Map<string, Row>([
  ['fwd', [seg('▐▛███▜▌')]],
  ['shut', [seg('▐█████▌')]],
  ['left', [seg('▐▜███▜▌')]],
  ['right', [seg('▐▛███▛▌')]],
  ['x', [seg('▐▚███▞▌')]],
  ['glasses', [seg('▐'), seg('■', 'violet'), seg('█'), seg('━', 'violet'), seg('█'), seg('■', 'violet'), seg('▌')]],
])

const BODY = new Map<string, string>([
  ['down', '▝▜█████▛▘'],
  ['up', '▗▟█████▙▖'],
  ['typeA', '▗▜█████▛▘'],
  ['typeB', '▝▜█████▛▖'],
])

const LEGS = new Map<string, Row>([
  ['stand', [seg('  ▘▘ ▝▝  ')]],
  ['step', [seg('  ▝▘ ▝▘  ')]],
  ['none', SPACE9],
  ['laptop', [seg(' ▄▄▄▄▄▄▄ ', 'blue')]],
])

const HAT: Row = [seg(' ▄▟███▙▄ ', 'amber')]

// What one frame changes. A row of `left` or `right` that is missing is blank.
type Look = {
  top?: Row
  eyes?: string
  body?: string
  legs?: string
  left?: Row[]
  right?: Row[]
}

function frame(look: Look): Frame {
  const eyes = EYES.get(look.eyes ?? 'fwd') ?? []
  const body = BODY.get(look.body ?? 'down') ?? ''
  const legs = LEGS.get(look.legs ?? 'stand') ?? []
  const middle: Row[] = [look.top ?? SPACE9, [seg(' '), ...eyes, seg(' ')], [seg(body)], legs]
  const rows: Frame = []
  for (let index = 0; index < 4; index++) {
    const left = look.left?.[index]
    const right = look.right?.[index] ?? []
    rows.push([...(left === undefined || left.length === 0 ? SPACE3 : left), ...(middle[index] ?? []), ...right])
  }
  return rows
}

function repeat(count: number, item: Frame): Frame[] {
  const all: Frame[] = []
  for (let index = 0; index < count; index++) {
    all.push(item)
  }
  return all
}

// A right-hand row: two spaces, then the pieces.
function side(...pieces: Seg[]): Row {
  return [seg('  '), ...pieces]
}

const NONE: Row = []

function goalFrames(): Frame[] {
  const target = [NONE, side(seg('◎', 'claudeHi'))]
  return [...repeat(3, frame({ right: target })), ...repeat(3, frame({ legs: 'step', right: target }))]
}

function solidFrames(): Frame[] {
  const letters = ['S', 'O', 'L', 'I', 'D']
  const frames: Frame[] = []
  for (let count = 1; count <= letters.length; count++) {
    const top = [seg(letters.slice(0, count).join(' ').padEnd(9), 'fg', true)]
    frames.push(...repeat(2, frame({ top, body: 'up' })))
  }
  const all = [seg('S O L I D', 'fg', true)]
  frames.push(...repeat(3, frame({ top: all, body: 'up', right: [side(seg('✦', 'claudeHi'))] })))
  frames.push(...repeat(3, frame({ top: all, body: 'up', legs: 'step', right: [[seg('   '), seg('✧', 'claudeHi')]] })))
  return frames
}

function patternFrames(): Frame[] {
  const frames: Frame[] = []
  for (const idea of ['◇', '◈', '◆']) {
    frames.push(...repeat(3, frame({ eyes: 'glasses', right: [NONE, side(seg(idea, 'violet'))] })))
  }
  const pushed = [seg('  '), seg('■━■', 'violet'), seg('    ')]
  frames.push(...repeat(2, frame({ top: pushed, right: [NONE, side(seg('◆', 'violet'))] })))
  return frames
}

function dsaFrames(): Frame[] {
  const code = 'set.add(k)'
  const frames: Frame[] = []
  for (let length = 1; length <= code.length; length++) {
    const typed = [seg(code.slice(0, length), 'blue')]
    const cursor = length < code.length ? [seg('▌', 'claudeHi')] : []
    frames.push(frame({ body: length % 2 === 1 ? 'typeA' : 'typeB', legs: 'laptop', right: [NONE, [seg('  '), ...typed, ...cursor]] }))
  }
  const finished = [NONE, side(seg(code, 'blue')), side(seg('O(n) ✓', 'green'))]
  frames.push(...repeat(5, frame({ legs: 'laptop', right: finished })))
  return frames
}

function tableFrames(): Frame[] {
  const files = ['a.py', 'b.py', 'a.test']
  const frames: Frame[] = []
  for (let count = 1; count <= files.length; count++) {
    const listed: Row[] = [NONE]
    for (const file of files.slice(0, count)) {
      listed.push(side(seg('▤', 'green'), seg(' '), seg(file, 'blue')))
    }
    frames.push(...repeat(3, frame({ eyes: count % 2 === 1 ? 'left' : 'right', right: listed })))
  }
  const ticked: Row[] = [NONE]
  for (const file of files) {
    ticked.push(side(seg('✓', 'green'), seg(' '), seg(file, 'blue')))
  }
  frames.push(...repeat(3, frame({ body: 'up', right: ticked })))
  return frames
}

function exampleFrames(): Frame[] {
  const input = side(seg('[a, b, a]', 'dim'))
  const old = side(seg('old → 3', 'red'))
  const now = side(seg('new → 2 ✓', 'green'))
  return [
    ...repeat(3, frame({ eyes: 'right', right: [NONE, input] })),
    ...repeat(3, frame({ eyes: 'left', right: [NONE, input, old] })),
    ...repeat(4, frame({ body: 'up', right: [NONE, input, old, now] })),
  ]
}

function decisionsFrames(): Frame[] {
  const askA = [NONE, side(seg('A ?', 'amber'), seg(' B', 'dim'))]
  const askB = [NONE, side(seg('A ', 'dim'), seg('B ?', 'amber'))]
  const frames: Frame[] = []
  for (let round = 0; round < 3; round++) {
    frames.push(...repeat(2, frame({ eyes: 'left', right: askA })))
    frames.push(...repeat(2, frame({ eyes: 'right', right: askB })))
  }
  frames.push(...repeat(4, frame({ body: 'up', right: [NONE, side(seg('★ A picked', 'amber'))] })))
  return frames
}

function langFrames(): Frame[] {
  const python = 'add(k)'
  const java = 'add(k);'
  const frames: Frame[] = []
  // The eyes look right first, then left, then right, as the prototype's.
  for (let step = 0; step * 2 + 2 <= python.length; step++) {
    const typed = side(seg('py ', 'violet'), seg(python.slice(0, step * 2 + 2), 'dim'))
    frames.push(...repeat(2, frame({ eyes: step % 2 === 0 ? 'right' : 'left', right: [NONE, typed] })))
  }
  const pyRow = side(seg('py ', 'violet'), seg(python, 'dim'))
  const javaRow = (code: string) => side(seg('⇄ ', 'green'), seg(code, 'blue'))
  frames.push(...repeat(2, frame({ right: [NONE, pyRow, javaRow('java')] })))
  frames.push(...repeat(4, frame({ body: 'up', right: [NONE, pyRow, javaRow(java)] })))
  return frames
}

function reviewingFrames(): Frame[] {
  const rolls = ['▐', '▐░', '▐░░', '▐░░░']
  const full = [NONE, NONE, side(seg('▐░░░', 'blue'))]
  const frames: Frame[] = []
  for (let index = 0; index < rolls.length; index++) {
    const rolled = [NONE, NONE, side(seg(rolls[index] ?? '', 'blue'))]
    frames.push(...repeat(2, frame({ top: HAT, eyes: index < 2 ? 'left' : 'right', right: rolled })))
  }
  frames.push(...repeat(4, frame({ top: HAT, eyes: 'right', right: full })))
  frames.push(frame({ top: HAT, eyes: 'shut', right: full }))
  frames.push(...repeat(4, frame({ top: HAT, eyes: 'left', right: full })))
  return frames
}

function doneFrames(flags: number): Frame[] {
  const label = `⚑ ${flags} ${flags === 1 ? 'flag' : 'flags'}`
  const held = [NONE, side(seg(label, 'amber'))]
  return [
    ...repeat(8, frame({ top: HAT, right: held })),
    frame({ top: HAT, eyes: 'shut', right: held }),
    ...repeat(3, frame({ top: HAT, body: 'up', right: held })),
  ]
}

function downFrames(): Frame[] {
  const smoke = (text: string, pad: string): Row[] => [[seg(pad), seg(text, 'dim')]]
  return [
    ...repeat(4, frame({ eyes: 'x', right: smoke('~', '  ') })),
    ...repeat(4, frame({ eyes: 'x', right: smoke('~ ~', '  ') })),
    ...repeat(4, frame({ eyes: 'x', legs: 'step', right: smoke('~', '   ') })),
  ]
}

function skippedFrames(): Frame[] {
  return [
    ...repeat(10, frame({})),
    ...repeat(2, frame({ body: 'up', right: [NONE, side(seg('?', 'dim'))] })),
    frame({ eyes: 'shut' }),
  ]
}

function lockedFrames(): Frame[] {
  const lock: Row[] = [NONE, NONE, [seg(' '), seg('⊘', 'red'), seg(' ')]]
  const nap = (right: Row[]) => frame({ eyes: 'shut', left: lock, right })
  const z = (text: string, pad: string): Row => [seg(pad), seg(text, 'blue')]
  return [
    ...repeat(5, nap([NONE, side(seg('z', 'blue'))])),
    ...repeat(5, nap([z('Z', '  '), z('z', '   ')])),
    ...repeat(5, nap([z('Z', '   ')])),
  ]
}

function openFrames(): Frame[] {
  const sparkles = ['✢', '✳', '✶', '✻', '✽']
  const frames: Frame[] = []
  for (let index = 0; index < 12; index++) {
    const isJump = index % 4 < 2
    frames.push(frame({
      body: isJump ? 'up' : 'down',
      legs: isJump ? 'none' : 'stand',
      left: [[seg(' '), seg(sparkles[index % 5] ?? '', 'claudeHi'), seg(' ')]],
      right: [side(seg(sparkles[(index + 2) % 5] ?? '', 'claudeHi')), NONE, side(seg('✓', 'green'))],
    }))
  }
  return frames
}

// Standing by: soft mode has no gate to sleep by.
function softFrames(): Frame[] {
  return [...repeat(10, frame({})), frame({ eyes: 'shut' })]
}

// The frames of one costume. Only the finished coach depends on a count: its flags.
export function framesOf(mood: Mood, flags: number): Frame[] {
  switch (mood) {
    case 'goal': return goalFrames()
    case 'table': return tableFrames()
    case 'solid': return solidFrames()
    case 'pattern': return patternFrames()
    case 'dsa': return dsaFrames()
    case 'example': return exampleFrames()
    case 'decisions': return decisionsFrames()
    case 'lang': return langFrames()
    case 'reviewing': return reviewingFrames()
    case 'done': return doneFrames(flags)
    case 'down': return downFrames()
    case 'skipped': return skippedFrames()
    case 'locked': return lockedFrames()
    case 'open': return openFrames()
    case 'soft': return softFrames()
  }
}

// The frame to draw at a tick. The costume loops.
export function frameAt(mood: Mood, tick: number, flags: number): Frame {
  const frames = framesOf(mood, flags)
  return frames[tick % frames.length] ?? []
}
