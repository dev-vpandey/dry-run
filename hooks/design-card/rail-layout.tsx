// Layout "rail": a band of stops joined by a line, and a pane that reads as a timeline.
// Prototype v2, variant B. Rules: SPEC section 6.

import type { RenderChildren } from 'claude-code'
import { parseCard } from './design-card'
import type { Card } from './design-card'
import { clawdNode, coachLine, designRows, gatePill, goRow, spinnerNode, TOKENS } from './layout-kit'
import type { Actions, Els, View } from './layout-kit'
import { DESIGN_SECTIONS, stopsOf } from './layout-model'
import type { Stop } from './layout-model'

function stopsOfView(view: View, card: Card): Stop[] {
  return stopsOf({ done: card.done, live: view.live, coach: view.coach, isOpen: view.gate === 'open' })
}

function dotOf(els: Els, stop: Stop) {
  const { Text } = els
  const t = TOKENS
  if (stop.state === 'done') {
    return <Text color={t.green}>●</Text>
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
  const stops = stopsOfView(view, parseCard(view.text, null))
  return (
    <Box>
      <Text color={t.claude}>✻ </Text>
      {stops.map((stop, index) => (
        <Box>
          {stop.state === 'live' ? spinnerNode(els, view, stop.name, stop.name, t.claude) : (
            <Box>
              {dotOf(els, stop)}
              <Text color={stop.state === 'done' ? t.fg : t.faint}>{` ${stop.name}`}</Text>
            </Box>
          )}
          {index < stops.length - 1 && <Text color={lineColor(stop)}>{' ── '}</Text>}
        </Box>
      ))}
    </Box>
  )
}

// The pane: Clawd, the name and the gate, then a step for each stop. A step shows its words once
// it is done.
export function railPane(els: Els, view: View, card: Card, width: number, actions: Actions): ReturnType<Els['Box']> {
  const { Box, Text } = els
  const t = TOKENS
  const inner = Math.max(10, width - 6)
  const stops = stopsOfView(view, card)
  const step = (stop: Stop, body: RenderChildren[]) => (
    <Box flexDirection="column" marginTop={1}>
      <Box>
        {stop.state === 'live' ? spinnerNode(els, view, `step-${stop.name}`, '', t.claude) : dotOf(els, stop)}
        <Text bold color={stop.state === 'todo' ? t.faint : t.fg}>{` ${stop.name}`}</Text>
      </Box>
      {body.length > 0 && <Box flexDirection="column" paddingLeft={2}>{body}</Box>}
    </Box>
  )
  const sections = DESIGN_SECTIONS.map((name, index) => {
    const stop: Stop = stops[index] ?? { name, state: 'todo' }
    return step(stop, stop.state === 'done' ? designRows(els, card, name, inner) : [])
  })
  const coach: Stop = stops[4] ?? { name: 'Coach', state: 'todo' }
  const go: Stop = stops[5] ?? { name: 'Go', state: 'todo' }
  return (
    <Box flexDirection="column">
      {clawdNode(els, view)}
      <Text bold color={t.fg}>dry-run</Text>
      {gatePill(els, view)}
      {sections}
      {step(coach, [coachLine(els, view, false)])}
      {step(go, [goRow(els, view, actions)])}
    </Box>
  )
}
