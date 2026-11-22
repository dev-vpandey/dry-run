// The Design Card: a one-row band above the prompt and a pane. Static art only here.
// The pure parts (boxes, status text) are in design-card.ts, the colors in design-card-colors.ts.
// Rules: SPEC section 6.

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderChildren } from 'claude-code'
import { DARK } from './design-card-colors'
import type { Tokens } from './design-card-colors'
import { DECISION_LABELS, EXPLAINER_SECTION, foldAll, listOf, namesOf, PANE_ID, parseCard, repoUnlockLine, SECTION_NAMES, SECTION_TOTAL, sectionCount, toggleFold, topFill, wrapWords } from './design-card'
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

const TOKENS = DARK

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
    folded: listOf(await read($, foldedBoxes)),
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
      {count === 0 ? <Text color={t.amber}>{` ◇ ${label} `}</Text> : pillOf(els, `◆ ${label}`, t.claude, t.claudeBg)}
    </Box>
  )
}

function levelColor(level: 'E' | 'M' | 'H', t: Tokens): string {
  if (level === 'E') {
    return t.green
  }
  return level === 'M' ? t.amber : t.red
}

// The frame of a box is drawn here in text, not by the Box border: this renderer clips
// anything laid over a border, and a Box has no title. So the title is part of the top line.
// Every row is one line, so the right edge lines up: long text is wrapped by wrapWords.
function paneTree($: EngineInterface, els: Els, view: View, card: Card, width: number): ReturnType<Els['Box']> {
  const { Box, Text, Button, Link } = els
  const t = TOKENS
  const gate = gateOf(view, t)
  const inner = Math.max(10, width - 4)
  const pill = (label: string, color: string, bg: string) => pillOf(els, label, color, bg)
  const text = (value: string, color: string) => <Text color={color}>{value}</Text>
  // Rows of wrapped words. `prefix` is the room an element before the first line takes.
  const wrapped = (value: string, color: string, prefix = 0) =>
    wrapWords(value, inner - prefix, inner).map(line => text(line, color))
  const dash = '—'
  // The boxes shown. The explainer is shown only when the dry run has it.
  const shown = SECTION_NAMES.filter(name => name !== EXPLAINER_SECTION || card.done.includes(name))
  // A badge, then the text after it on the same line; the rest of the text wraps below it.
  const badgeRows = (badge: RenderChildren, badgeWidth: number, value: string, color: string) => {
    const [first = '', ...rest] = wrapWords(value, inner - badgeWidth, inner)
    return [
      <Box>
        {badge}
        {text(` ${first}`, color)}
      </Box>,
      ...rest.map(line => text(line, color)),
    ]
  }
  const section = (name: SectionName, color: string, rows: RenderChildren[]) => {
    const isFolded = view.folded.includes(name)
    const body = card.done.includes(name) ? rows : [text('waiting for dry run', t.amber)]
    const title = ` ${isFolded ? '▸' : '▾'} ${name} `
    const edge = (left: string, right: string) => <Text color={color}>{`${left}${'─'.repeat(width - 2)}${right}`}</Text>
    return (
      <Box flexDirection="column" marginTop={1}>
        <Box>
          <Text color={color}>╭─</Text>
          <Button key={`fold-${name}`} plain onPress={() => update($, foldedBoxes, value => toggleFold(value, name))}>
            <Text color={color} bold>{title}</Text>
          </Button>
          <Text color={color}>{`${'─'.repeat(topFill(title, width))}╮`}</Text>
        </Box>
        {(isFolded ? [text('…', color)] : body).map(row => (
          <Box>
            <Text color={color}>│ </Text>
            <Box width={inner}>{row}</Box>
            <Text color={color}> │</Text>
          </Box>
        ))}
        {edge('╰', '╯')}
      </Box>
    )
  }
  const nameRow = (name: string, color: string, bg: string) => (name === '' ? text(dash, t.fg) : pill(name, color, bg))
  const solid = card.solid.rows.length === 0
    ? wrapped(card.solid.note === '' ? dash : card.solid.note, t.fg)
    : card.solid.rows.flatMap(row => badgeRows(pill(row.name, t.term, t.claude), row.name.length + 3, row.why, t.fg))
  const changes = card.changes.length === 0
    ? [text(dash, t.fg)]
    : card.changes.flatMap(row => [
        <Box>
          {pill(row.tag, t.term, row.tag === 'new' ? t.green : t.amber)}
          <Text color={t.blue} bold>{` ${row.path}`}</Text>
        </Box>,
        ...wrapped(`${row.what} · ${row.why}`, t.fg),
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
        return badgeRows(badge, mark.length + 3, `${DECISION_LABELS[index] ?? ''}. ${decision.text}`, t.fg)
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
  const isAllFolded = shown.every(name => view.folded.includes(name))
  // Go stays above the boxes: the pane is taller than a short screen, and Go must stay in view.
  return (
    <Box flexDirection="column">
      <Box flexDirection="column">
        {clawdRows(view.gate).map(row => <Text color={t.claude}>{row}</Text>)}
        <Text color={t.claudeHi}>{CAPTIONS.get(view.gate) ?? ''}</Text>
      </Box>
      <Box>
        <Text bold color={t.fg}>dry-run</Text>
        <Text color={t.claudeHi}>{' · Design Card  '}</Text>
        <Button
          key="fold-all"
          plain
          hotkey="f"
          label={isAllFolded ? 'unfold all' : 'fold all'}
          onPress={() => update($, foldedBoxes, value => foldAll(value, shown))}
        />
      </Box>
      {pill(gate.label, gate.color, gate.bg)}
      <Box>
        {view.gate === 'open' ? (
          <Box>
            {pill(view.isSkipped ? '✓ Gate open · dry run skipped' : '✓ Approved for this dry run', t.green, t.greenBg)}
            <Button key="stop" label="/stop" onPress={async () => { await lockGate($) }} />
          </Box>
        ) : view.isWaiting ? (
          <Box>
            <Button key="go" label="▶ Go [g]" hotkey="g" variant="primary" onPress={() => openGate($, false)} />
            {text(' or type /go · "go ahead"', t.fg)}
          </Box>
        ) : (
          text('▶ Go [g] needs a dry run', t.amber)
        )}
      </Box>
      {section('Goal', t.fg, wrapped(card.goal === '' ? dash : card.goal, t.fg))}
      {section('Change table', t.green, changes)}
      {section('SOLID', t.claude, solid)}
      {section('Pattern', t.violet, [
        nameRow(card.pattern.name, t.violet, t.violetBg),
        ...(card.pattern.note === '' ? [] : wrapped(card.pattern.note, t.amber)),
        ...(card.pattern.why === '' ? [] : wrapped(card.pattern.why, t.fg)),
      ])}
      {section('DSA', t.blue, [
        nameRow(card.dsa.name, t.blue, t.blueBg),
        ...(card.dsa.note === '' ? [] : wrapped(card.dsa.note, t.amber)),
        ...(card.dsa.why === '' ? [] : wrapped(card.dsa.why, t.fg)),
        ...(card.dsa.bigO === '' ? [] : wrapped(card.dsa.bigO, t.green)),
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
      {card.done.includes(EXPLAINER_SECTION) && section(EXPLAINER_SECTION, t.violet, explainer)}
      {view.unlocked > 0 && text(repoUnlockLine(view.unlocked), t.amber)}
    </Box>
  )
}

// The pane is opened by register.ts at session start: the engine takes one session.start hook.
export const register: Register = on => {
  // A box title folds its box when pressed. The focus ring would also invert it, a colored
  // block the person did not ask for, so the ring never lands on a title. Go and /stop keep it.
  on('ui.focus', { requestId: PANE_ID }, ($, e, next) => (e.element?.startsWith('fold-') ? {} : next(e)))

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
    return paneTree($, $.ui.resolve(e), view, parseCard(view.text, await namesFrom($)), e.props.bodyColumns)
  })
}
