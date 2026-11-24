// What the three layouts (card, rail, buddy) share: the view they draw from, the colors, the
// pill, the gate pill, Clawd, the spinner, the coach line and the Go row. Rules: SPEC section 6.

import type { EngineInterface, RenderChildren } from 'claude-code'
import { DARK } from './design-card-colors'
import type { Tokens } from './design-card-colors'
import { moodOf } from './clawd-frames'
import type { CoachState, GateState, Hue } from './clawd-frames'
import { drawClawd } from './clawd-surface'
import { wrapWords } from './design-card'
import type { Card, SectionName } from './design-card'
import { LAYOUT_NAMES } from './layout-model'
import type { DesignName, LayoutName } from './layout-model'

export type Els = ReturnType<EngineInterface['ui']['resolve']>

export type View = {
  layout: LayoutName
  gate: GateState
  isWaiting: boolean
  isSkipped: boolean
  text: string
  unlocked: number
  folded: string[]
  hasClient: boolean
  live: SectionName | ''
  coach: CoachState
  flags: number
}

// What a press does. The view owns the state; a layout only names the press.
export type Actions = {
  fold: (name: string) => Promise<void>
  layout: (name: LayoutName) => Promise<void>
  foldAll: (names: string[]) => Promise<void>
  go: () => Promise<void>
  stop: () => Promise<void>
}

export const TOKENS = DARK

// A part of the gate pill: its words and colors. The words are the prototype's.
export function gateOf(view: View, t: Tokens): { label: string; color: string; bg: string } {
  if (view.gate === 'open') {
    return { label: '✓ GATE OPEN', color: t.green, bg: t.greenBg }
  }
  if (view.gate === 'soft') {
    return { label: '◇ GATE SOFT', color: t.amber, bg: t.amberBg }
  }
  return { label: '⊘ GATE LOCKED', color: t.red, bg: t.redBg }
}

// A word on a colored background. A terminal paints a solid color, so the prototype's
// soft tint is a blended solid (design-card-colors.ts), and its dashed border is not drawn.
export function pillOf(els: Els, label: string, color: string, bg: string) {
  const { Text } = els
  return <Text color={color} backgroundColor={bg} bold>{` ${label} `}</Text>
}

export function gatePill(els: Els, view: View) {
  const gate = gateOf(view, TOKENS)
  return pillOf(els, gate.label, gate.color, gate.bg)
}

// The colors of the art, by hue.
function hues(t: Tokens): Record<Hue, string> {
  return { claude: t.claude, claudeHi: t.claudeHi, fg: t.fg, violet: t.violet, blue: t.blue, green: t.green, amber: t.amber, red: t.red, dim: t.dim }
}

// Clawd and his caption. The terminal and the desktop give him a Client that ticks on its own;
// the other surfaces have no Client, so they get the first frame of the same costume.
export function clawdNode(els: Els, view: View) {
  const mood = moodOf({ live: view.live, coach: view.coach, gate: view.gate })
  const props = { mood, flags: view.flags, colors: hues(TOKENS), captionColor: TOKENS.claudeHi }
  if (view.hasClient && 'Client' in els) {
    return <els.Client key={`clawd-${mood}`} module="./clawd-surface.tsx" props={props} />
  }
  return drawClawd(els, props, 0)
}

// A spinner with its label. With a background it is a pill. The terminal and the desktop spin it
// in a Client; the other surfaces get a still `✻`.
export function spinnerNode(els: Els, view: View, key: string, label: string, color: string, background?: string) {
  const { Text } = els
  if (view.hasClient && 'Client' in els) {
    // A prop of undefined is refused by the engine, so a plain spinner has no background key at all.
    const props = background === undefined ? { label, color } : { label, color, background }
    return <els.Client key={`spin-${key}`} module="./spinner-surface.tsx" props={props} />
  }
  return background === undefined ? <Text color={color}>{`✻ ${label}`}</Text> : pillOf(els, `✻ ${label}`, color, background)
}

// The three layouts as buttons, the one in force marked. The same row sits in the band and in
// each pane, so a layout can be changed from either.
export function layoutSwitch(els: Els, view: View, actions: Actions, isLabelled: boolean) {
  const { Box, Text, Button } = els
  const t = TOKENS
  return (
    <Box>
      {isLabelled && <Text color={t.faint}>layout </Text>}
      {LAYOUT_NAMES.map(name => (
        <Button key={`layout-${name}`} plain onPress={() => actions.layout(name)}>
          {name === view.layout ? pillOf(els, name, t.claude, t.claudeBg) : <Text color={t.dim}>{` ${name} `}</Text>}
        </Button>
      ))}
    </Box>
  )
}

// The coach has nothing to show until it is built (ticket 29): an idle coach has no line, no box.
export function hasCoach(view: View): boolean {
  return view.coach !== 'idle'
}

// The coach in one line: `short` is the band's, the long one is the pane's.
export function coachLine(els: Els, view: View, isShort: boolean) {
  const { Box, Text } = els
  const t = TOKENS
  if (!hasCoach(view)) {
    return null
  }
  if (view.coach === 'reviewing') {
    return spinnerNode(els, view, 'coach', 'Coach reviewing…', t.claude)
  }
  if (view.coach === 'done') {
    const flags = `${view.flags} ${view.flags === 1 ? 'flag' : 'flags'}`
    return <Text color={t.amber}>{isShort ? `◆ ${flags}` : `◆ Coach done · ${flags}`}</Text>
  }
  if (view.coach === 'down') {
    return <Text color={t.red}>✗ Coach unavailable</Text>
  }
  return <Box><Text color={t.faint}>○ Coach skipped</Text></Box>
}

// The Go row: the open gate shows its approval and /stop, a waiting dry run shows Go, and
// nothing waiting shows why Go is off.
export function goRow(els: Els, view: View, actions: Actions) {
  const { Box, Text, Button } = els
  const t = TOKENS
  if (view.gate === 'open') {
    return (
      <Box>
        {pillOf(els, view.isSkipped ? '✓ Gate open · dry run skipped' : '✓ Approved for this dry run', t.green, t.greenBg)}
        <Button key="stop" label="/stop" onPress={actions.stop} />
      </Box>
    )
  }
  if (view.isWaiting) {
    return (
      <Box>
        <Button key="go" label="▶ Go [g]" hotkey="g" variant="primary" onPress={actions.go} />
        <Text color={t.fg}> or type /go · "go ahead"</Text>
      </Box>
    )
  }
  return <Text color={t.amber}>▶ Go [g] needs a dry run</Text>
}

// Rows of one line each: the words wrapped to `width`. Nothing for no words.
export function wrappedRows(els: Els, value: string, color: string, width: number) {
  const { Text } = els
  return value === '' ? [] : wrapWords(value, width, width).map(line => <Text color={color}>{line}</Text>)
}

// A badge, then the words after it on the same line; the rest of the words wrap below it.
export function badgeRows(els: Els, badge: RenderChildren, badgeWidth: number, value: string, color: string, width: number) {
  const { Box, Text } = els
  const [first = '', ...rest] = wrapWords(value, width - badgeWidth, width)
  return [
    <Box>
      {badge}
      <Text color={color}>{` ${first}`}</Text>
    </Box>,
    ...rest.map(line => <Text color={color}>{line}</Text>),
  ]
}

function levelColor(level: 'E' | 'M' | 'H'): string {
  if (level === 'E') {
    return TOKENS.green
  }
  return level === 'M' ? TOKENS.amber : TOKENS.red
}

// A name in a pill, or a dash when the dry run gave none.
function namedPill(els: Els, value: string, color: string, bg: string) {
  return value === '' ? <els.Text color={TOKENS.fg}>—</els.Text> : pillOf(els, value, color, bg)
}

// The words of Pattern and DSA after the pill: the pill and the first line of the why share a line.
function chosenRows(els: Els, name: string, color: string, bg: string, why: string, width: number) {
  return name === '' ? [namedPill(els, name, color, bg)] : badgeRows(els, pillOf(els, name, color, bg), name.length + 2, why, TOKENS.dim, width)
}

// The LeetCode rows of the DSA section: a blue mark, the level colored by difficulty, the link.
export function linkRows(els: Els, card: Card) {
  const { Box, Text, Link } = els
  return card.dsa.rows.map(row => (
    <Box>
      <Text color={TOKENS.blue}>○ </Text>
      <Text color={levelColor(row.difficulty)}>{`${row.difficulty} `}</Text>
      <Link href={row.url} label={row.title} />
    </Box>
  ))
}

// The words of Pattern, SOLID or DSA, as rows of one line each, for the card, the rail and the
// buddy. `width` is the room of a line. Goal is one paragraph: the layouts place it themselves.
// The buddy shows the LeetCode rows apart, under Practice, so it asks for DSA without them.
export function designRows(els: Els, card: Card, name: Exclude<DesignName, 'Goal'>, width: number, hasLinks = true) {
  const t = TOKENS
  if (name === 'SOLID') {
    return card.solid.rows.length === 0
      ? wrappedRows(els, card.solid.note === '' ? '—' : card.solid.note, t.dim, width)
      : card.solid.rows.flatMap(row => badgeRows(els, pillOf(els, row.name, t.term, t.claude), row.name.length + 3, row.why, t.dim, width))
  }
  if (name === 'Pattern') {
    return [
      ...chosenRows(els, card.pattern.name, t.violet, t.violetBg, card.pattern.why, width),
      ...wrappedRows(els, card.pattern.note, t.amber, width),
    ]
  }
  return [
    ...chosenRows(els, card.dsa.name, t.blue, t.blueBg, card.dsa.why, width),
    ...wrappedRows(els, card.dsa.note, t.amber, width),
    ...wrappedRows(els, card.dsa.bigO, t.dim, width),
    ...(hasLinks ? linkRows(els, card) : []),
  ]
}
