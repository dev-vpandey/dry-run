// The Design Card: a one-row band above the prompt and a pane. Static art only here.
// The pure parts (boxes, status text) are in design-card.ts, the colors in design-card-colors.ts.
// Rules: SPEC section 6.

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderChildren } from 'claude-code'
import { tokensFor } from './design-card-colors'
import type { Tokens } from './design-card-colors'
import { foldAll, foldedNames, namesOf, PANE_ID, parseCard, repoUnlockLine, SECTION_TOTAL, sectionCount, toggleFold } from './design-card'
import type { Card, Gate, Names, SectionName } from './design-card'
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
// The names of the folded boxes, joined with commas. Only the pane writes it.
const foldedBoxes = atom({ plugin: 'dry-run', key: 'foldedBoxes' } as const, '')

type Els = ReturnType<EngineInterface['ui']['resolve']>

type View = {
  gate: Gate | 'soft'
  isWaiting: boolean
  isSkipped: boolean
  text: string
  unlocked: number
  folded: string[]
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
    folded: foldedNames(await read($, foldedBoxes)),
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
  return <Text color={color} backgroundColor={bg} bold>{` ${label} `}</Text>
}

function bandTree(els: Els, view: View): ReturnType<Els['Box']> {
  const { Box, Text } = els
  const t = TOKENS
  const gate = gateOf(view, t)
  const count = sectionCount(view.text)
  const label = `${count}/${SECTION_TOTAL}`
  return (
    <Box>
      <Text color={t.claude}>✻ </Text>
      <Text bold color={t.fg}>dry-run </Text>
      {pillOf(els, gate.label, gate.color, gate.bg)}
      {count === 0 ? <Text color={t.dim}>{` ◇ ${label} `}</Text> : pillOf(els, `◆ ${label}`, t.claude, t.claudeBg)}
    </Box>
  )
}

function levelColor(level: 'E' | 'M' | 'H', t: Tokens): string {
  if (level === 'E') {
    return t.green
  }
  return level === 'M' ? t.amber : t.red
}

// A digit folds the box of that section number: the numbers of a dry run's headings.
const FOLD_KEYS = new Map<SectionName, string>([
  ['Goal', '1'],
  ['Change table', '2'],
  ['SOLID', '3'],
  ['Pattern', '4'],
  ['DSA', '5'],
  ['Worked example', '6'],
  ['Open decisions', '7'],
  ['Language explainer', '8'],
])

function paneTree($: EngineInterface, els: Els, view: View, card: Card): ReturnType<Els['Box']> {
  const { Box, Text, Button, Link } = els
  const t = TOKENS
  const gate = gateOf(view, t)
  const pill = (label: string, color: string, bg: string) => pillOf(els, label, color, bg)
  const words = (text: string) => <Text color={t.fg}>{text === '' ? '—' : text}</Text>
  const soft = (text: string) => <Text color={t.dim}>{text}</Text>
  // The boxes shown. The explainer is shown only when the dry run has it.
  const shown = [...FOLD_KEYS.keys()].filter(name => name !== 'Language explainer' || card.done.includes(name))
  // One box. Its title is laid over the top border, as a button that folds the box.
  // A terminal cannot put text in a border, so the title is a Box placed on the border row.
  const section = (name: SectionName, color: string, children: RenderChildren) => {
    const isFolded = view.folded.includes(name)
    return (
      <Box flexDirection="column" borderStyle="round" borderColor={color} paddingX={1} marginTop={1}>
        <Box position="absolute" top={-1} left={1}>
          <Button key={`fold-${name}`} hotkey={FOLD_KEYS.get(name)} onPress={() => update($, foldedBoxes, text => toggleFold(text, name))}>
            <Text color={color} bold>{` ${isFolded ? '▸' : '▾'} ${name} `}</Text>
          </Button>
        </Box>
        {isFolded ? <Text color={t.faint}>…</Text> : children}
      </Box>
    )
  }
  const nameLine = (name: string, color: string, bg: string) => (name === '' ? <Text>—</Text> : pill(name, color, bg))
  const solid = card.solid.rows.length === 0
    ? [words(card.solid.note)]
    : card.solid.rows.map(row => (
        <Box>
          {pill(row.name, t.term, t.claude)}
          {soft(` ${row.why}`)}
        </Box>
      ))
  const changes = card.changes.length === 0
    ? [words('')]
    : card.changes.map(row => (
        <Box flexDirection="column">
          <Box>
            {pill(row.tag, t.term, row.tag === 'new' ? t.green : t.amber)}
            <Text color={t.blue} bold>{` ${row.path}`}</Text>
          </Box>
          {soft(`${row.what} · ${row.why}`)}
        </Box>
      ))
  const example = card.example.input === '' && card.example.old === ''
    ? [words('')]
    : [
        soft(card.example.input),
        <Box>
          <Text color={t.red} bold>{'old → '}</Text>
          {words(card.example.old)}
        </Box>,
        <Box>
          <Text color={t.green} bold>{'new → '}</Text>
          {words(card.example.now)}
        </Box>,
      ]
  const decisions = card.decisions.length === 0
    ? [soft(card.done.includes('Open decisions') ? 'none' : '—')]
    : card.decisions.map((decision, index) => (
        <Box>
          <Text color={decision.isPick ? t.amber : t.dim}>{decision.isPick ? '★ ' : '○ '}</Text>
          {words(`${'AB'.charAt(index)}. ${decision.text} `)}
          {decision.isPick && pill('★ pick', t.amber, t.amberBg)}
        </Box>
      ))
  const explainer = [
    ...card.explainer.rows.map(row => (
      <Box>
        <Text color={t.blue}>{row.construct}</Text>
        <Text color={t.faint}>{' → '}</Text>
        <Text color={t.green}>{row.java}</Text>
      </Box>
    )),
    soft(card.explainer.flow === '' ? '' : `Flow: ${card.explainer.flow}`),
  ]
  const isAllFolded = shown.every(name => view.folded.includes(name))
  return (
    <Box flexDirection="column">
      <Box flexDirection="column">
        {clawdRows(view.gate).map(row => <Text color={t.claude}>{row}</Text>)}
        <Text color={t.dim}>{CAPTIONS.get(view.gate) ?? ''}</Text>
      </Box>
      <Box>
        <Text bold color={t.fg}>dry-run</Text>
        <Text color={t.dim}>{' · Design Card  '}</Text>
        <Button
          key="fold-all"
          hotkey="f"
          label={isAllFolded ? 'unfold all [f]' : 'fold all [f]'}
          onPress={() => update($, foldedBoxes, text => foldAll(text, shown))}
        />
      </Box>
      {pill(gate.label, gate.color, gate.bg)}
      {section('Goal', t.fg, words(card.goal))}
      {section('Change table', t.green, changes)}
      {section('SOLID', t.claude, solid)}
      {section('Pattern', t.violet, [
        nameLine(card.pattern.name, t.violet, t.violetBg),
        ...[card.pattern.note, card.pattern.why].filter(line => line !== '').map(soft),
      ])}
      {section('DSA', t.blue, [
        nameLine(card.dsa.name, t.blue, t.blueBg),
        ...[card.dsa.note, card.dsa.why, card.dsa.bigO].filter(line => line !== '').map(soft),
        ...card.dsa.rows.map(row => (
          <Box>
            <Text color={t.blue}>○ </Text>
            <Text color={levelColor(row.difficulty, t)} bold>{`${row.difficulty} `}</Text>
            <Link href={row.url} label={row.title} />
          </Box>
        )),
      ])}
      {section('Worked example', t.fg, example)}
      {section('Open decisions', t.amber, decisions)}
      {card.done.includes('Language explainer') && section('Language explainer', t.violet, explainer)}
      <Box marginTop={1}>
        {view.gate === 'open' ? (
          <Box>
            {pill(view.isSkipped ? '✓ Gate open · dry run skipped' : '✓ Approved for this dry run', t.green, t.greenBg)}
            <Button key="stop" label="/stop" onPress={async () => { await lockGate($) }} />
          </Box>
        ) : view.isWaiting ? (
          <Box>
            <Button key="go" label="▶ Go [g]" hotkey="g" variant="primary" onPress={() => openGate($, false)} />
            {soft(' or type /go · "go ahead"')}
          </Box>
        ) : (
          soft('▶ Go [g] needs a dry run')
        )}
      </Box>
      {view.unlocked > 0 && soft(repoUnlockLine(view.unlocked))}
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
