// Layout "buddy": Clawd says what is going on. A band of one sentence, and a pane with a big
// Clawd, three tiles, the coach and Go. Prototype v2, variant C. Rules: SPEC section 6.

import type { RenderChildren } from 'claude-code'
import { parseCard } from './design-card'
import type { Card } from './design-card'
import { clawdNode, coachLine, designRows, gatePill, goRow, linkRows, spinnerNode, TOKENS } from './layout-kit'
import type { Actions, Els, View } from './layout-kit'
import { DESIGN_SECTIONS, designDone, sayOf } from './layout-model'
import type { DesignName } from './layout-model'

// The tiles: the three sections with a choice. Goal is the dry run's own first line, not a tile.
const TILES: readonly Exclude<DesignName, 'Goal'>[] = ['SOLID', 'Pattern', 'DSA']

function sentenceOf(view: View): string {
  return sayOf({ live: view.live, coach: view.coach, gate: view.gate, flags: view.flags })
}

// The band: the sentence, the gate and how many of the four sections are written. The sentence
// spins while a section or the coach is at work.
export function buddyBand(els: Els, view: View): ReturnType<Els['Box']> {
  const { Box, Text } = els
  const t = TOKENS
  const count = designDone(parseCard(view.text, null).done, view.live).length
  const isBusy = view.live !== '' || view.coach === 'reviewing'
  return (
    <Box>
      {isBusy ? spinnerNode(els, view, 'say', sentenceOf(view), t.claude) : <Text color={t.fg}>{`✻ ${sentenceOf(view)}`}</Text>}
      <Text color={t.faint}> │ </Text>
      {gatePill(els, view)}
      <Text color={t.dim}>{` ${count}/4`}</Text>
    </Box>
  )
}

// The pane. Each tile shows ✓ and its words once written, the spinner while it is being written.
export function buddyPane(els: Els, view: View, card: Card, width: number, actions: Actions): ReturnType<Els['Box']> {
  const { Box, Text } = els
  const t = TOKENS
  const inner = Math.max(10, width - 6)
  const written = designDone(card.done, view.live)
  const tile = (name: Exclude<DesignName, 'Goal'>) => {
    const isDone = written.includes(name)
    let mark: RenderChildren = <Text color={t.faint}>○</Text>
    if (isDone) {
      mark = <Text color={t.green}>✓</Text>
    } else if (view.live === name) {
      mark = spinnerNode(els, view, `tile-${name}`, '', t.claude)
    }
    return (
      <Box flexDirection="column" marginTop={1}>
        <Box>
          {mark}
          <Text color={isDone ? t.dim : t.faint}>{` ${name.toUpperCase()}`}</Text>
        </Box>
        {isDone && <Box flexDirection="column" paddingLeft={2}>{designRows(els, card, name, inner, false)}</Box>}
      </Box>
    )
  }
  return (
    <Box flexDirection="column" alignItems="center">
      {clawdNode(els, view)}
      <Text color={t.fg}>{sentenceOf(view)}</Text>
      {gatePill(els, view)}
      <Box flexDirection="column" alignItems="flex-start">
        {TILES.map(tile)}
        <Box marginTop={1}>{coachLine(els, view, false)}</Box>
        {written.length === DESIGN_SECTIONS.length && (
          <Box flexDirection="column" marginTop={1}>
            <Text bold color={t.fg}>Practice</Text>
            {linkRows(els, card)}
          </Box>
        )}
      </Box>
      <Box marginTop={1}>{goRow(els, view, actions)}</Box>
    </Box>
  )
}
