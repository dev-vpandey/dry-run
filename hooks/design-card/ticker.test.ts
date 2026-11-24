import { expect, test } from 'claude-code/testing'
import { startTicker } from './ticker'
import type { Tickable } from './ticker'

// A surface that records what the ticker asks of it.
function fakeSurface(overrides: Partial<Tickable> = {}) {
  const periods: number[] = []
  const states: number[] = []
  const calls = { periods, states, tick: () => {} }
  const surface: Tickable = {
    state: undefined,
    isWindowFocused: true,
    isMotionReduced: false,
    every: (ms, fn) => {
      calls.periods.push(ms)
      calls.tick = fn
      return () => {}
    },
    setState: next => {
      calls.states.push(next)
    },
    ...overrides,
  }
  return { surface, calls }
}

test('the first call starts one 150 ms timer and sets the state to 0', () => {
  const { surface, calls } = fakeSurface()

  startTicker(surface)

  expect(calls.periods).toEqual([150])
  expect(calls.states).toEqual([0])
})

test('each tick counts up', () => {
  const { surface, calls } = fakeSurface()
  startTicker(surface)

  calls.tick()
  calls.tick()

  expect(calls.states).toEqual([0, 1, 2])
})

test('a call with a state already set starts no second timer', () => {
  const { surface, calls } = fakeSurface({ state: 3 })

  startTicker(surface)

  expect(calls.periods).toEqual([])
  expect(calls.states).toEqual([])
})

test('the ticker rests while the window has no focus', () => {
  const { surface, calls } = fakeSurface({ isWindowFocused: false })
  startTicker(surface)

  calls.tick()

  expect(calls.states).toEqual([0])
})

test('the ticker stays on the first frame for a person who asked for less motion', () => {
  const { surface, calls } = fakeSurface({ isMotionReduced: true })
  startTicker(surface)

  calls.tick()

  expect(calls.states).toEqual([0])
})
