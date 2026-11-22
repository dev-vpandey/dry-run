// The Design Card: a one-row band above the prompt and a pane. Static art only here.
// The pure parts (boxes, status text) are in design-card.ts, the colors in design-card-colors.ts.
// Rules: SPEC section 6.

import { atom, read } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'
import { tokensFor } from './design-card-colors'
import type { Tokens } from './design-card-colors'
import { namesOf, PANE_ID, parseCard, repoUnlockLine, sectionPills } from './design-card'
import type { Card, Names } from './design-card'
import { emptyRepoFile, restoreRepoFile } from './repo-file'
import { lockGate, openGate } from './register'

// The same state the gate module writes. Both name each key as a literal.
const isOpen = atom({ plugin: 'dry-run', key: 'isOpen' } as const, false)
const isOff = atom({ plugin: 'dry-run', key: 'isOff' } as const, false)
const isSoft = atom({ plugin: 'dry-run', key: 'isSoft' } as const, false)
const isWaiting = atom({ plugin: 'dry-run', key: 'isWaiting' } as const, false)
const isSkipped = atom({ plugin: 'dry-run', key: 'isSkipped' } as const, false)
const dryRunText = atom({ plugin: 'dry-run', key: 'dryRunText' } as const, '')
const repoFile = atom({ plugin: 'dry-run', key: 'repoFile' } as const, '')

type Els = ReturnType<EngineInterface['ui']['resolve']>

type View = {
  gate: 'locked' | 'open' | 'soft'
  isWaiting: boolean
  isSkipped: boolean
  text: string
  unlocked: number
}

// This build gives a mod no signal for the person's color mode. Dark until it does.
const TOKENS = tokensFor(false)

// A part of the gate pill: its words and colors.
function gateOf(view: View, t: Tokens): { label: string; color: string; bg: string } {
  if (view.gate === 'open') {
    return { label: '✓ open', color: t.green, bg: t.greenBg }
  }
  if (view.gate === 'soft') {
    return { label: '◇ soft', color: t.amber, bg: t.amberBg }
  }
  return { label: '⊘ locked', color: t.red, bg: t.redBg }
}

// Four rows of Clawd: prop, eyes, body, legs. Asleep by a red ⊘ when locked.
function clawdRows(gate: View['gate']): string[] {
  const prop = gate === 'open' ? ' ✻' : ' ⊘ zZ'
  const eyes = gate === 'open' ? '▐▛ ● ● ▜▌' : '▐▛ - - ▜▌'
  return [prop, eyes, ' ▝█████▘', '  ▘▘ ▝▝']
}

const CAPTIONS = new Map<View['gate'], string>([
  ['locked', 'Gate locked · napping'],
  ['open', 'Gate open · edits on'],
  ['soft', 'Soft mode · no gate'],
])

// The state the drawing needs, read while drawing so a write redraws it.
async function viewOf($: EngineInterface): Promise<View | null> {
  if (await read($, isOff)) {
    return null
  }
  let gate: View['gate'] = (await read($, isOpen)) ? 'open' : 'locked'
  if (await read($, isSoft)) {
    gate = 'soft'
  }
  const repo = await read($, repoFile)
  const file = repo === '' ? emptyRepoFile() : restoreRepoFile(repo)
  return {
    gate,
    isWaiting: await read($, isWaiting),
    isSkipped: await read($, isSkipped),
    text: await read($, dryRunText),
    unlocked: file.unlock.length,
  }
}

// The Patterns and DSA names, or null when the names file cannot be read.
async function namesFrom($: EngineInterface): Promise<Names | null> {
  try {
    const text = await $.fs.read(`${$.plugin.root}/templates/dry-run-names.md`)
    return typeof text === 'string' ? namesOf(text) : null
  } catch {
    return null
  }
}

function bandTree(els: Els, view: View): ReturnType<Els['Box']> {
  const { Box, Text } = els
  const t = TOKENS
  const gate = gateOf(view, t)
  const card = parseCard(view.text, null)
  return (
    <Box>
      <Text color={t.claude}>✻ dry-run </Text>
      <Text color={gate.color} backgroundColor={gate.bg}>{` ${gate.label} `}</Text>
      {sectionPills(card.done).map(pill => (
        <Text color={pill.isDone ? t.green : t.dim}>{` ${pill.isDone ? '◆' : '◇'} ${pill.name}`}</Text>
      ))}
    </Box>
  )
}

function paneTree($: EngineInterface, els: Els, view: View, card: Card): ReturnType<Els['Box']> {
  const { Box, Text, Button, Link } = els
  const t = TOKENS
  const gate = gateOf(view, t)
  const pill = (label: string, color: string, bg: string) => (
    <Text color={color} backgroundColor={bg}>{` ${label} `}</Text>
  )
  // One box: a pill, then lines of text. A line of '' is skipped.
  const box = (label: string, color: string, bg: string, lines: string[], dim: string[] = []) => (
    <Box flexDirection="column" borderStyle="round" borderColor={color} paddingX={1}>
      {pill(label, color, bg)}
      {lines.filter(line => line !== '').map(line => <Text>{line}</Text>)}
      {dim.filter(line => line !== '').map(line => <Text dimColor>{line}</Text>)}
    </Box>
  )
  const choiceLine = (choice: Card['pattern']) => (choice.name === '' ? '—' : choice.name)
  return (
    <Box flexDirection="column">
      <Box flexDirection="column">
        {clawdRows(view.gate).map(row => <Text color={t.claude}>{row}</Text>)}
        <Text dimColor>{CAPTIONS.get(view.gate) ?? ''}</Text>
      </Box>
      <Box>
        <Text bold>{'dry-run · Design Card '}</Text>
        {pill(gate.label, gate.color, gate.bg)}
      </Box>
      {box('Goal', t.claude, t.claudeBg, [card.goal === '' ? '—' : card.goal])}
      {box('SOLID', t.claude, t.claudeBg, [card.solid === '' ? '—' : card.solid])}
      {box('Pattern', t.violet, t.violetBg, [choiceLine(card.pattern)], [card.pattern.note, card.pattern.why])}
      <Box flexDirection="column" borderStyle="round" borderColor={t.blue} paddingX={1}>
        {pill('DSA', t.blue, t.blueBg)}
        <Text>{choiceLine(card.dsa)}</Text>
        {card.dsa.note !== '' && <Text dimColor>{card.dsa.note}</Text>}
        {card.dsa.why !== '' && <Text dimColor>{card.dsa.why}</Text>}
        {card.dsa.bigO !== '' && <Text>{`Big-O: ${card.dsa.bigO}`}</Text>}
        {card.dsa.rows.map(row => (
          <Box>
            <Text color={row.difficulty === 'E' ? t.green : row.difficulty === 'M' ? t.amber : t.red}>{`○ ${row.difficulty} `}</Text>
            <Link href={row.url} label={row.title} />
          </Box>
        ))}
      </Box>
      {view.gate === 'open' ? (
        <Box>
          <Text color={t.green}>{view.isSkipped ? '✓ Gate open · dry run skipped ' : '✓ Approved for this dry run '}</Text>
          <Button key="stop" label="/stop" onPress={async () => { await lockGate($) }} />
        </Box>
      ) : view.isWaiting ? (
        <Button key="go" label="▶ Go [g]" hotkey="g" variant="primary" onPress={() => openGate($, false)} />
      ) : (
        <Text dimColor>▶ Go [g] needs a dry run</Text>
      )}
      {view.unlocked > 0 && <Text dimColor>{repoUnlockLine(view.unlocked)}</Text>}
    </Box>
  )
}

// The pane is opened by register.ts at session start: the engine takes one session.start hook.
export const register: Register = on => {
  // Not drawn while the mod is off, and the engine leaves VS Code without a band.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const view = await viewOf($)
    if (view === null || e.props.hasSurvey) {
      return next(e)
    }
    return bandTree($.ui.resolve(e), view)
  })

  on('ui.render', { component: 'Pane', requestId: PANE_ID }, async ($, e, next) => {
    const view = await viewOf($)
    if (view === null) {
      return next(e)
    }
    return paneTree($, $.ui.resolve(e), view, parseCard(view.text, await namesFrom($)))
  })
}
