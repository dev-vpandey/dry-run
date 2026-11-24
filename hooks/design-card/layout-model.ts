// The look of the card is one of three layouts. This file holds the choices that need no engine:
// the names, the rail's stops and the buddy's sentence. Rules: SPEC section 6, prototype v2.

import type { CoachState, GateState } from './clawd-frames'
import { SECTION_NAMES } from './design-card'
import type { SectionName } from './design-card'

export type LayoutName = 'card' | 'rail' | 'buddy'
export const LAYOUT_NAMES: readonly LayoutName[] = ['card', 'rail', 'buddy']

// The layout a typed or stored name stands for, in any case, or undefined when it names none.
export function layoutNamed(value: unknown): LayoutName | undefined {
  if (typeof value !== 'string') {
    return undefined
  }
  const name = value.trim().toLowerCase()
  return LAYOUT_NAMES.find(layout => layout === name)
}

// The layout of a name typed by the person or set in the settings. Anything else gives the card.
export function layoutOf(value: unknown): LayoutName {
  return layoutNamed(value) ?? 'card'
}

// The layout in force: the one the person chose in this session, else the one of the settings.
export function layoutFor(chosen: unknown, setting: unknown): LayoutName {
  return layoutNamed(chosen) ?? layoutOf(setting)
}

// The four sections the rail and the buddy show, in dry-run order.
export const DESIGN_SECTIONS = ['Goal', 'SOLID', 'Pattern', 'DSA'] as const
export type DesignName = (typeof DESIGN_SECTIONS)[number]

// The design sections that are written: those with text, and those before the one being written.
// The one being written is not written yet, though its heading and first lines may be in the text.
export function designDone(done: readonly SectionName[], live: SectionName | ''): DesignName[] {
  const before = live === '' ? 0 : SECTION_NAMES.indexOf(live)
  return DESIGN_SECTIONS.filter(name => (done.includes(name) && name !== live) || SECTION_NAMES.indexOf(name) < before)
}

export type StopState = 'done' | 'live' | 'down' | 'todo'
export type Stop = { name: string; state: StopState }
export type StopInput = { done: readonly SectionName[]; live: SectionName | ''; coach: CoachState; isOpen: boolean }

function coachStop(coach: CoachState): StopState {
  if (coach === 'reviewing') {
    return 'live'
  }
  if (coach === 'done' || coach === 'skipped') {
    return 'done'
  }
  return coach === 'down' ? 'down' : 'todo'
}

export type Stops = { sections: Stop[]; coach: Stop; go: Stop }

// The rail in its order: the four sections, then the coach, then go.
export function stopList(stops: Stops): Stop[] {
  return [...stops.sections, stops.coach, stops.go]
}

export function stopsOf(input: StopInput): Stops {
  const written = designDone(input.done, input.live)
  const sections = DESIGN_SECTIONS.map((name): Stop => {
    if (written.includes(name)) {
      return { name, state: 'done' }
    }
    return { name, state: input.live === name ? 'live' : 'todo' }
  })
  return { sections, coach: { name: 'Coach', state: coachStop(input.coach) }, go: { name: 'Go', state: input.isOpen ? 'done' : 'todo' } }
}

export type SayInput = { live: SectionName | ''; coach: CoachState; gate: GateState; flags: number }

function coachSays(flags: number): string {
  if (flags === 0) {
    return 'Coach says: all clear.'
  }
  return `Coach says: ${flags} ${flags === 1 ? 'thing' : 'things'} to check.`
}

// What the buddy says, in the prototype's words. The order is the one of Clawd's costume:
// the section being written, the coach at work, the open gate, a finished coach, then the lock.
export function sayOf(input: SayInput): string {
  if (input.live !== '') {
    return 'Drafting the dry run…'
  }
  if (input.coach === 'reviewing') {
    return 'The coach is reading your files.'
  }
  if (input.gate === 'open') {
    return 'Go! Edits are open for this dry run.'
  }
  if (input.gate === 'soft') {
    return 'Soft mode. No gate.'
  }
  if (input.coach === 'done') {
    return coachSays(input.flags)
  }
  if (input.coach === 'down') {
    return 'The coach did not answer. You can still say go.'
  }
  if (input.coach === 'skipped') {
    return 'No coach this time. Say go when ready.'
  }
  return 'Gate locked. Ask for a change and I will post a dry run first.'
}
