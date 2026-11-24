import { expect, test } from 'claude-code/testing'
import { designDone, LAYOUT_NAMES, layoutFor, layoutNamed, layoutOf, sayOf, stopList, stopsOf } from './layout-model'

test('there are three layouts: card, rail and buddy', () => {
  expect(LAYOUT_NAMES).toEqual(['card', 'rail', 'buddy'])
})

test('a layout name is taken as it is, in any case; anything else gives the card', () => {
  expect(layoutOf('rail')).toBe('rail')
  expect(layoutOf(' Buddy ')).toBe('buddy')
  expect(layoutOf('card')).toBe('card')
  expect(layoutOf('')).toBe('card')
  expect(layoutOf('grid')).toBe('card')
  expect(layoutOf(undefined)).toBe('card')
  expect(layoutOf(7)).toBe('card')
})

test('layoutNamed gives the layout, or nothing when the name is not one', () => {
  expect(layoutNamed('RAIL')).toBe('rail')
  expect(layoutNamed('grid')).toBeUndefined()
  expect(layoutNamed(3)).toBeUndefined()
})

test('the layout in force is the one chosen in the session, else the setting, else the card', () => {
  expect(layoutFor('buddy', 'rail')).toBe('buddy')
  expect(layoutFor('', 'rail')).toBe('rail')
  expect(layoutFor(undefined, 'buddy')).toBe('buddy')
  expect(layoutFor('grid', 'rail')).toBe('rail')
  expect(layoutFor('', undefined)).toBe('card')
  expect(layoutFor('', 'grid')).toBe('card')
})

test('the design sections done are the four of the rail, in order, and nothing else', () => {
  expect(designDone(['Goal', 'Change table', 'SOLID', 'Worked example'], '')).toEqual(['Goal', 'SOLID'])
  expect(designDone([], '')).toEqual([])
})

test('the sections before the one being written count as done', () => {
  expect(designDone([], 'DSA')).toEqual(['Goal', 'SOLID', 'Pattern'])
  expect(designDone([], 'Change table')).toEqual(['Goal'])
  expect(designDone([], 'Language explainer')).toEqual(['Goal', 'SOLID', 'Pattern', 'DSA'])
})

test('the rail has six stops: the four sections, the coach and go', () => {
  const stops = stopList(stopsOf({ done: [], live: '', coach: 'idle', isOpen: false }))
  expect(stops.map(stop => stop.name)).toEqual(['Goal', 'SOLID', 'Pattern', 'DSA', 'Coach', 'Go'])
  expect(stops.every(stop => stop.state === 'todo')).toBe(true)
})

test('a done section is done and the one being written is live', () => {
  const stops = stopList(stopsOf({ done: ['Goal'], live: 'SOLID', coach: 'idle', isOpen: false }))
  expect(stops.map(stop => stop.state)).toEqual(['done', 'live', 'todo', 'todo', 'todo', 'todo'])
})

test('the coach stop is live while reviewing, done when done or skipped, down when down', () => {
  const state = (coach: 'reviewing' | 'done' | 'skipped' | 'down' | 'idle') => stopsOf({ done: [], live: '', coach, isOpen: false }).coach.state
  expect(state('reviewing')).toBe('live')
  expect(state('done')).toBe('done')
  expect(state('skipped')).toBe('done')
  expect(state('down')).toBe('down')
  expect(state('idle')).toBe('todo')
})

test('the go stop is done once the gate is open', () => {
  expect(stopsOf({ done: [], live: '', coach: 'idle', isOpen: true }).go.state).toBe('done')
})

test('the buddy says what it is doing, in the prototype words', () => {
  const say = (live: '' | 'Goal', coach: 'idle' | 'reviewing' | 'done' | 'down' | 'skipped', gate: 'locked' | 'open' | 'soft', flags = 0) =>
    sayOf({ live, coach, gate, flags })
  expect(say('Goal', 'idle', 'locked')).toBe('Drafting the dry run…')
  expect(say('', 'reviewing', 'locked')).toBe('The coach is reading your files.')
  expect(say('', 'idle', 'open')).toBe('Go! Edits are open for this dry run.')
  expect(say('', 'idle', 'locked')).toBe('Gate locked. Ask for a change and I will post a dry run first.')
  expect(say('', 'done', 'locked', 2)).toBe('Coach says: 2 things to check.')
  expect(say('', 'done', 'locked', 1)).toBe('Coach says: 1 thing to check.')
  expect(say('', 'done', 'locked', 0)).toBe('Coach says: all clear.')
  expect(say('', 'down', 'locked')).toBe('The coach did not answer. You can still say go.')
  expect(say('', 'skipped', 'locked')).toBe('No coach this time. Say go when ready.')
  expect(say('', 'idle', 'soft')).toBe('Soft mode. No gate.')
})

test('an open gate takes over from a finished coach, as it does for Clawd', () => {
  expect(sayOf({ live: '', coach: 'done', gate: 'open', flags: 2 })).toBe('Go! Edits are open for this dry run.')
})
