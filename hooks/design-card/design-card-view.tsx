// The Design Card: a one-row band above the prompt and a pane, in one of three layouts (card,
// rail, buddy). This file reads the state and picks the layout; each layout draws in its own file.
// The pure parts (boxes, status text) are in design-card.ts, the colors in design-card-colors.ts.
// Rules: SPEC section 6.

import { atom, read, update } from 'claude-code'
import type { EngineInterface, PluginOptions, Register } from 'claude-code'
import { faultNote, faultToast } from './clawd-frames'
import type { CoachState, GateState } from './clawd-frames'
import { liveSectionOf } from './live-section'
import { foldAll, listOf, namesOf, PANE_ID, parseCard, SECTION_NAMES, toggleFold } from './design-card'
import type { Names, SectionName } from './design-card'
import { buddyBand, buddyPane } from './buddy-layout'
import { cardBand, cardPane } from './card-layout'
import { railBand, railPane } from './rail-layout'
import type { Actions, View } from './layout-kit'
import { layoutFor } from './layout-model'
import type { LayoutName } from './layout-model'
import { emptyRepoFile, restoreRepoFile } from '../repo-config/repo-file'
import { lockGate, openGate } from '../register'

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
// The section Claude is writing now ("" when none), the Design Coach's state and its flag count.
// This file writes liveSection; register.ts clears it; ticket 29 writes the other two.
const liveSection = atom({ plugin: 'dry-run', key: 'liveSection' } as const, '')
const coachState = atom({ plugin: 'dry-run', key: 'coachState' } as const, 'idle')
// A Client of this card failed: the card then draws still art. Set by the ui.fault hook below.
const clientFault = atom({ plugin: 'dry-run', key: 'clientFault' } as const, '')
const coachFlags = atom({ plugin: 'dry-run', key: 'coachFlags' } as const, 0)
// The layout the person chose in this session with /dry-run layout. "" means the setting decides.
const layoutName = atom({ plugin: 'dry-run', key: 'layoutName' } as const, '')

const COACH_STATES = new Map<string, CoachState>([
  ['reviewing', 'reviewing'],
  ['done', 'done'],
  ['down', 'down'],
  ['skipped', 'skipped'],
])

// The state the drawing needs, read while drawing so a write redraws it.
async function viewOf($: EngineInterface, surface: string, options: PluginOptions): Promise<View | null> {
  if (await read($, isOff)) {
    return null
  }
  let gate: GateState = (await read($, isOpen)) ? 'open' : 'locked'
  if (await read($, isSoft)) {
    gate = 'soft'
  }
  const repo = await read($, repoFile)
  const file = repo === '' ? emptyRepoFile() : restoreRepoFile(repo)
  const chosen = await read($, layoutName)
  return {
    layout: layoutFor(chosen, options.layout),
    gate,
    isWaiting: await read($, isWaiting),
    isSkipped: await read($, isSkipped),
    text: await read($, dryRunText),
    unlocked: file.unlock.length,
    folded: listOf(await read($, foldedBoxes)),
    hasClient: hasClient(surface) && (await read($, clientFault)) === '',
    live: sectionOfName(await read($, liveSection)),
    coach: COACH_STATES.get(await read($, coachState)) ?? 'idle',
    flags: await read($, coachFlags),
  }
}

// The section a stored name stands for, or "" when it names none.
function sectionOfName(name: string): SectionName | '' {
  return SECTION_NAMES.find(section => section === name) ?? ''
}

// Only the terminal and the desktop draw a Client; VS Code and mobile get still art.
function hasClient(surface: string): boolean {
  return surface === 'terminal' || surface === 'desktop'
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

// What a press in the pane does. The layouts only name the press.
function actionsOf($: EngineInterface): Actions {
  return {
    fold: async name => {
      await update($, foldedBoxes, value => toggleFold(value, name))
    },
    foldAll: async names => {
      await update($, foldedBoxes, value => foldAll(value, names))
    },
    go: () => openGate($, false),
    stop: async () => {
      await lockGate($)
    },
  }
}

// How each layout draws the band and the pane. A layout is added here and in layout-model.ts.
const LAYOUTS: Record<LayoutName, { band: typeof cardBand; pane: typeof cardPane }> = {
  card: { band: cardBand, pane: cardPane },
  rail: { band: railBand, pane: railPane },
  buddy: { band: buddyBand, pane: buddyPane },
}

// The pane is opened by register.ts at session start: the engine takes one session.start hook.
export const register: Register = (on, options) => {
  // Claude's text, as it streams: the `###` heading being written sets Clawd's costume and the
  // spinner pill. The hook passes every chunk on unchanged and writes only when the section
  // changes. A subagent's steps are not the main loop's, so they are left alone.
  on('turn.step', async function* ($, e, next) {
    if (e.agentId !== undefined) {
      return yield* next(e)
    }
    // A turn that was interrupted never reached turn.complete, so its section is cleared here.
    if (e.index === 0) {
      update($, liveSection, () => '').catch(() => undefined)
    }
    let text = ''
    let last = ''
    for await (const chunk of next(e)) {
      if (chunk.kind === 'text') {
        text += chunk.text
        const section = liveSectionOf(text)
        if (section !== '' && section !== last) {
          last = section
          // A failed write only leaves the costume as it was; it must not break the reply.
          update($, liveSection, () => section).catch(() => undefined)
        }
      }
      yield chunk
    }
  })

  // A Client of this card failed. The engine draws the site again and asks the card to leave the
  // Client out: the view does, once the fault is stored. The toast names why.
  on('ui.fault', async ($, e, next) => {
    $.ui.toast(faultToast(e.phase, e.reason))
    await update($, clientFault, () => faultNote(e.phase, e.reason))
    return next(e)
  })

  // A box title folds its box when pressed. The focus ring would also invert it, a colored
  // block the person did not ask for, so the ring never lands on a title. Go and /stop keep it.
  on('ui.focus', { requestId: PANE_ID }, ($, e, next) => (e.element?.startsWith('fold-') ? {} : next(e)))

  // Not drawn while the mod is off. VS Code may not paint the band at all: that is the engine's call.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const view = await viewOf($, e.surface, options)
    if (view === null || e.props.hasSurvey) {
      return next(e)
    }
    return LAYOUTS[view.layout].band($.ui.resolve(e), view)
  })

  on('ui.render', { component: 'Pane', requestId: PANE_ID }, async ($, e, next) => {
    const view = await viewOf($, e.surface, options)
    if (view === null) {
      return next(e)
    }
    const card = parseCard(view.text, await namesFrom($))
    return LAYOUTS[view.layout].pane($.ui.resolve(e), view, card, e.props.bodyColumns, actionsOf($))
  })
}
