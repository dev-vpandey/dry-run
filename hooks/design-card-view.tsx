// The Design Card: a one-row band above the prompt and a pane. Static art only here.
// The pure parts (boxes, status text) are in design-card.ts, the colors in design-card-colors.ts.
// Rules: SPEC section 6.

import { atom, read } from 'claude-code'
import type { EngineInterface, Register, RenderChildren } from 'claude-code'
import { tokensFor } from './design-card-colors'
import type { Tokens } from './design-card-colors'
import { namesOf, PANE_ID, parseCard, repoUnlockLine, sectionPills } from './design-card'
import type { Card, Gate, Names } from './design-card'
import { emptyRepoFile, restoreRepoFile } from './repo-file'
import { lockGate, openGate } from './register'

// The same state the gate module writes. The engine needs each key spelled as a literal at the
// atom call, so these cannot share the constants of register.ts. Keep the keys in step.
const isOpen = atom({ plugin: 'dry-run', key: 'isOpen' } as const, false)
const isOff = atom({ plugin: 'dry-run', key: 'isOff' } as const, false)
const isSoft = atom({ plugin: 'dry-run', key: 'isSoft' } as const, false)
const isWaiting = atom({ plugin: 'dry-run', key: 'isWaiting' } as const, false)
const isSkipped = atom({ plugin: 'dry-run', key: 'isSkipped' } as const, false)
const dryRunText = atom({ plugin: 'dry-run', key: 'dryRunText' } as const, '')
const repoFile = atom({ plugin: 'dry-run', key: 'repoFile' } as const, '')

type Els = ReturnType<EngineInterface['ui']['resolve']>

type View = {
  gate: Gate | 'soft'
  isWaiting: boolean
  isSkipped: boolean
  text: string
  unlocked: number
}

// This build gives a mod no signal for the person's color mode. Dark until it does.
const TOKENS = tokensFor(false)

// A part of the gate pill: its words and colors. The words are the prototype's.
function gateOf(view: View, t: Tokens): { label: string; color: string; bg: string } {
  if (view.gate === 'open') {
    return { label: '✓ GATE OPEN', color: t.green, bg: t.greenBg }
  }
  if (view.gate === 'soft') {
    return { label: '◇ GATE SOFT', color: t.amber, bg: t.amberBg }
  }
  return { label: '⊘ GATE LOCKED', color: t.red, bg: t.redBg }
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

// A word on a colored background. A terminal paints a solid color, so the prototype's
// soft tint is a blended solid (design-card-colors.ts), and its dashed border is not drawn.
function pillOf(els: Els, label: string, color: string, bg: string) {
  const { Text } = els
  return <Text color={color} backgroundColor={bg}>{` ${label} `}</Text>
}

function bandTree(els: Els, view: View): ReturnType<Els['Box']> {
  const { Box, Text } = els
  const t = TOKENS
  const gate = gateOf(view, t)
  const card = parseCard(view.text, null)
  return (
    <Box>
      <Text color={t.claude}>✻ </Text>
      <Text bold>dry-run </Text>
      {pillOf(els, gate.label, gate.color, gate.bg)}
      {sectionPills(card.done).map(pill =>
        pill.isDone ? pillOf(els, `◆ ${pill.name}`, t.claude, t.claudeBg) : <Text color={t.dim}>{` ◇ ${pill.name} `}</Text>
      )}
    </Box>
  )
}

function levelColor(level: 'E' | 'M' | 'H', t: Tokens): string {
  if (level === 'E') {
    return t.green
  }
  return level === 'M' ? t.amber : t.red
}

function paneTree($: EngineInterface, els: Els, view: View, card: Card): ReturnType<Els['Box']> {
  const { Box, Text, Button, Link } = els
  const t = TOKENS
  const gate = gateOf(view, t)
  const pill = (label: string, color: string, bg: string) => pillOf(els, label, color, bg)
  const outline = (color: string, children: RenderChildren) => (
    <Box flexDirection="column" borderStyle="round" borderColor={color} paddingX={1}>
      {children}
    </Box>
  )
  const nameLine = (name: string, color: string, bg: string) => (name === '' ? <Text>—</Text> : pill(name, color, bg))
  const solid = card.solid.rows.length === 0
    ? [<Text>{card.solid.note === '' ? '—' : card.solid.note}</Text>]
    : card.solid.rows.map(row => (
        <Box>
          {pill(row.name, t.term, t.claude)}
          <Text dimColor>{` ${row.why}`}</Text>
        </Box>
      ))
  return (
    <Box flexDirection="column">
      <Box flexDirection="column">
        {clawdRows(view.gate).map(row => <Text color={t.claude}>{row}</Text>)}
        <Text dimColor>{CAPTIONS.get(view.gate) ?? ''}</Text>
      </Box>
      <Box>
        <Text bold>dry-run</Text>
        <Text dimColor>{' · Design Card'}</Text>
      </Box>
      {pill(gate.label, gate.color, gate.bg)}
      {outline(t.fg, [pill('Goal', t.fg, t.claudeBg), <Text>{card.goal === '' ? '—' : card.goal}</Text>])}
      {outline(t.claude, [pill('SOLID', t.claude, t.claudeBg), ...solid])}
      {outline(t.violet, [
        pill('Pattern', t.violet, t.violetBg),
        nameLine(card.pattern.name, t.violet, t.violetBg),
        ...[card.pattern.note, card.pattern.why].filter(line => line !== '').map(line => <Text dimColor>{line}</Text>),
      ])}
      {outline(t.blue, [
        pill('DSA', t.blue, t.blueBg),
        nameLine(card.dsa.name, t.blue, t.blueBg),
        ...[card.dsa.note, card.dsa.why, card.dsa.bigO].filter(line => line !== '').map(line => <Text dimColor>{line}</Text>),
        ...card.dsa.rows.map(row => (
          <Box>
            <Text color={t.blue}>○ </Text>
            <Text color={levelColor(row.difficulty, t)}>{`${row.difficulty} `}</Text>
            <Link href={row.url} label={row.title} />
          </Box>
        )),
      ])}
      {view.gate === 'open' ? (
        <Box>
          {pill(view.isSkipped ? '✓ Gate open · dry run skipped' : '✓ Approved for this dry run', t.green, t.greenBg)}
          <Button key="stop" label="/stop" onPress={async () => { await lockGate($) }} />
        </Box>
      ) : view.isWaiting ? (
        <Box>
          <Button key="go" label="▶ Go [g]" hotkey="g" variant="primary" onPress={() => openGate($, false)} />
          <Text dimColor>{' or type /go · "go ahead"'}</Text>
        </Box>
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
