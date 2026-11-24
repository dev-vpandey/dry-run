// Layout "rail": a band of stops joined by a line, and a pane that reads as a timeline.
// Prototype v2, variant B. Rules: SPEC section 6.

import type { RenderChildren } from 'claude-code'
import { parseCard } from './design-card'
import type { Card } from './design-card'
import { clawdNode, coachLine, designRows, gatePill, goRow, spinnerNode, TOKENS, wrappedRows } from './layout-kit'
import type { Actions, Els, View } from './layout-kit'
import { DESIGN_SECTIONS, stopList, stopsOf } from './layout-model'
import type { Stop, Stops } from './layout-model'

function stopsOfView(view: View, card: Card): Stops {
  return stopsOf({ done: card.done, live: view.live, coach: view.coach, isOpen: view.gate === 'open' })
}

// The dot of a stop: ● done, a spinner while it is written, ✗ a coach that is down, ○ not yet.
function dotOf(els: Els, view: View, stop: Stop) {
  const { Text } = els
  const t = TOKENS
  if (stop.state === 'done') {
    return <Text color={t.green}>●</Text>
  }
  if (stop.state === 'live') {
    return spinnerNode(els, view, `dot-${stop.name}`, '', t.claude)
  }
  return stop.state === 'down' ? <Text color={t.red}>✗</Text> : <Text color={t.faint}>○</Text>
}

function lineColor(stop: Stop): string {
  if (stop.state === 'done') {
    return TOKENS.green
  }
  return stop.state === 'live' ? TOKENS.claude : TOKENS.faint
}

// The band: `✻` then each stop as a dot and its name, joined by a line that is green once the stop
// before it is done. The stop being written spins.
export function railBand(els: Els, view: View): ReturnType<Els['Box']> {
  const { Box, Text } = els
  const t = TOKENS
  const stops = stopList(stopsOfView(view, parseCard(view.text, null)))
  return (
    <Box>
      <Text color={t.claude}>✻ </Text>
      {stops.map((stop, index) => (
        <Box>
          {stop.state === 'live' ? spinnerNode(els, view, stop.name, stop.name, t.claude) : (
            <Box>
              {dotOf(els, view, stop)}
              <Text color={stop.state === 'done' ? t.fg : t.faint}>{` ${stop.name}`}</Text>
            </Box>
          )}
          {index < stops.length - 1 && <Text color={lineColor(stop)}>{' ── '}</Text>}
        </Box>
      ))}
    </Box>
  )
}

// The coach step of the pane: ◆ amber when done, ○ when skipped, not the band's green ●.
function coachDot(els: Els, view: View, stop: Stop) {
  const { Text } = els
  if (view.coach === 'done') {
    return <Text color={TOKENS.amber}>◆</Text>
  }
  return view.coach === 'skipped' ? <Text color={TOKENS.faint}>○</Text> : dotOf(els, view, stop)
}

// The pane: Clawd with the name and the gate, then a step for each stop. A step shows its words
// once it is done.
export function railPane(els: Els, view: View, card: Card, width: number, actions: Actions): ReturnType<Els['Box']> {
  const { Box, Text } = els
  const t = TOKENS
  const inner = Math.max(10, width - 6)
  const stops = stopsOfView(view, card)
  const step = (dot: RenderChildren, stop: Stop, body: RenderChildren[]) => (
    <Box flexDirection="column" marginTop={1}>
      <Box>
        {dot}
        <Text bold color={stop.state === 'todo' ? t.faint : t.fg}>{` ${stop.name}`}</Text>
      </Box>
      {body.length > 0 && <Box flexDirection="column" paddingLeft={2}>{body}</Box>}
    </Box>
  )
  const words = (name: (typeof DESIGN_SECTIONS)[number]) => (name === 'Goal'
    ? wrappedRows(els, card.goal === '' ? '—' : card.goal, t.dim, inner)
    : designRows(els, card, name, inner))
  const sections = stops.sections.map((stop, index) => {
    const name = DESIGN_SECTIONS[index] ?? 'Goal'
    return step(dotOf(els, view, stop), stop, stop.state === 'done' ? words(name) : [])
  })
  return (
    <Box flexDirection="column">
      <Box>
        {clawdNode(els, view)}
        <Box flexDirection="column" marginLeft={1}>
          <Text bold color={t.fg}>dry-run</Text>
          {gatePill(els, view)}
        </Box>
      </Box>
      {sections}
      {step(coachDot(els, view, stops.coach), stops.coach, [coachLine(els, view, false)])}
      {step(dotOf(els, view, stops.go), stops.go, [goRow(els, view, actions)])}
    </Box>
  )
}
