// Layout "card": a band with one count pill, and a pane of boxes. Prototype v2, variant A.
// Rules: SPEC section 6.

import type { RenderChildren } from 'claude-code'
import { DECISION_LABELS, EXPLAINER_SECTION, repoUnlockLine, SECTION_NAMES, SECTION_TOTAL, sectionCount, topFill } from './design-card'
import type { Card, SectionName } from './design-card'
import { badgeRows, clawdNode, coachLine, designRows, gatePill, goRow, pillOf, spinnerNode, TOKENS, wrappedRows } from './layout-kit'
import type { Actions, Els, View } from './layout-kit'

// The band: `✻ dry-run`, the gate, how many sections are written and the one being written, then
// the coach. The sections before the one being written are written already, though the text of
// the dry run is stored only when the turn ends.
export function cardBand(els: Els, view: View): ReturnType<Els['Box']> {
  const { Box, Text } = els
  const t = TOKENS
  const before = view.live === '' ? 0 : SECTION_NAMES.indexOf(view.live)
  const count = Math.min(SECTION_TOTAL, Math.max(sectionCount(view.text), before))
  const label = `${count}/${SECTION_TOTAL}`
  let counter = pillOf(els, `◆ ${label}`, t.claude, t.claudeBg)
  if (view.live !== '') {
    counter = spinnerNode(els, view, 'count', label, t.claude, t.claudeBg)
  } else if (count === 0) {
    counter = <Text color={t.dim}>{` ◇ ${label} `}</Text>
  }
  return (
    <Box>
      <Text color={t.claude}>✻ </Text>
      <Text bold color={t.fg}>dry-run </Text>
      {gatePill(els, view)}
      {counter}
      {view.live === '' ? null : <Text bold color={t.claudeHi}>{` ${view.live}`}</Text>}
      <Text color={t.faint}> │ </Text>
      {coachLine(els, view, true)}
    </Box>
  )
}

// The pane. Go stays above the boxes: the pane is taller than a short screen, and Go must stay in view.
export function cardPane(els: Els, view: View, card: Card, width: number, actions: Actions): ReturnType<Els['Box']> {
  const { Box, Text, Button } = els
  const t = TOKENS
  const inner = Math.max(10, width - 4)
  const pill = (label: string, color: string, bg: string) => pillOf(els, label, color, bg)
  const text = (value: string, color: string) => <Text color={color}>{value}</Text>
  const wrapped = (value: string, color: string) => wrappedRows(els, value, color, inner)
  const dash = '—'
  // The boxes shown. The explainer is shown only when the dry run has it.
  const shown = SECTION_NAMES.filter(name => name !== EXPLAINER_SECTION || card.done.includes(name))
  // The frame of a box is drawn here in text, not by the Box border: this renderer clips
  // anything laid over a border, and a Box has no title. So the title is part of the top line.
  // Every row is one line, so the right edge lines up: long text is wrapped by wrapWords.
  const frame = (title: string, titleNode: RenderChildren, color: string, rows: RenderChildren[]) => (
    <Box flexDirection="column" marginTop={1}>
      <Box>
        <Text color={color}>╭─</Text>
        {titleNode}
        <Text color={color}>{`${'─'.repeat(topFill(title, width))}╮`}</Text>
      </Box>
      {rows.map(row => (
        <Box>
          <Text color={color}>│ </Text>
          <Box width={inner}>{row}</Box>
          <Text color={color}> │</Text>
        </Box>
      ))}
      <Text color={color}>{`╰${'─'.repeat(width - 2)}╯`}</Text>
    </Box>
  )
  // A box not written yet is faint, with no fold arrow; the one being written spins.
  const section = (name: SectionName, color: string, rows: RenderChildren[]) => {
    if (!card.done.includes(name)) {
      const waiting = view.live === name ? spinnerNode(els, view, `box-${name}`, 'writing…', t.claude) : text('waiting for dry run', t.faint)
      return frame(` ${name} `, <Text color={t.faint} bold>{` ${name} `}</Text>, t.faint, [waiting])
    }
    const isFolded = view.folded.includes(name)
    const title = ` ${isFolded ? '▸' : '▾'} ${name} `
    const button = (
      <Button key={`fold-${name}`} plain onPress={() => actions.fold(name)}>
        <Text color={color} bold>{title}</Text>
      </Button>
    )
    return frame(title, button, color, isFolded ? [text('…', color)] : rows)
  }
  const changes = card.changes.length === 0
    ? [text(dash, t.fg)]
    : card.changes.flatMap(row => [
        <Box>
          {pill(row.tag, t.term, row.tag === 'new' ? t.green : t.amber)}
          <Text color={t.blue} bold>{` ${row.path}`}</Text>
        </Box>,
        ...wrapped(`${row.what} · ${row.why}`, t.dim),
      ])
  const example = card.example.input === '' && card.example.old === ''
    ? [text(dash, t.fg)]
    : [
        ...wrapped(card.example.input, t.blue),
        <Box>
          <Text color={t.red} bold>{'old → '}</Text>
          {text(card.example.old, t.fg)}
        </Box>,
        <Box>
          <Text color={t.green} bold>{'new → '}</Text>
          {text(card.example.now, t.fg)}
        </Box>,
      ]
  const decisions = card.decisions.length === 0
    ? [text(card.done.includes('Open decisions') ? 'none' : dash, t.fg)]
    : card.decisions.flatMap((decision, index) => {
        const mark = decision.isPick ? '★ pick' : '○'
        const badge = decision.isPick ? pill(mark, t.amber, t.amberBg) : text(mark, t.fg)
        return badgeRows(els, badge, mark.length + 3, `${DECISION_LABELS[index] ?? ''}. ${decision.text}`, t.fg, inner)
      })
  const explainer = [
    ...card.explainer.rows.map(row => (
      <Box>
        <Text color={t.blue}>{row.construct}</Text>
        <Text color={t.claude}>{' → '}</Text>
        <Text color={t.green}>{row.java}</Text>
      </Box>
    )),
    ...wrapped(card.explainer.flow === '' ? '' : `Flow: ${card.explainer.flow}`, t.violet),
  ]
  const isAnyWritten = shown.some(name => card.done.includes(name))
  const isAllFolded = shown.every(name => view.folded.includes(name))
  return (
    <Box flexDirection="column">
      <Box>
        {clawdNode(els, view)}
        <Box flexDirection="column" marginLeft={1}>
          <Box>
            <Text bold color={t.fg}>dry-run</Text>
            <Text color={t.claudeHi}>{' · Design Card'}</Text>
          </Box>
          {gatePill(els, view)}
          {isAnyWritten && (
            <Button key="fold-all" plain hotkey="f" label={isAllFolded ? 'unfold all' : 'fold all'} onPress={() => actions.foldAll(shown)} />
          )}
        </Box>
      </Box>
      <Box>{goRow(els, view, actions)}</Box>
      {section('Goal', t.fg, wrapped(card.goal === '' ? dash : card.goal, t.fg))}
      {section('Change table', t.green, changes)}
      {section('SOLID', t.claude, designRows(els, card, 'SOLID', inner))}
      {section('Pattern', t.violet, designRows(els, card, 'Pattern', inner))}
      {section('DSA', t.blue, designRows(els, card, 'DSA', inner))}
      {section('Worked example', t.fg, example)}
      {section('Open decisions', t.amber, decisions)}
      {card.done.includes(EXPLAINER_SECTION) && section(EXPLAINER_SECTION, t.violet, explainer)}
      {frame(' Design Coach ', <Text color={t.amber} bold>{' Design Coach '}</Text>, t.amber, [coachLine(els, view, false)])}
      {view.unlocked > 0 && text(repoUnlockLine(view.unlocked), t.amber)}
    </Box>
  )
}
