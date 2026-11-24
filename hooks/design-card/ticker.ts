// The timer behind an animated Client module: a tick count kept in the instance's state.
// Rules: SPEC section 6 (150 ms tick).

import type { ClientSurface } from 'claude-code'
import { TICK_MS } from './clawd-frames'

// The parts of a surface the ticker uses.
export type Tickable = Pick<ClientSurface<number>, 'state' | 'every' | 'setState' | 'isWindowFocused' | 'isMotionReduced'>

// Starts the timer on the first call only, while `state` is still undefined. The tick rests
// while the window has no focus and stays put for a person who asked for less motion. The
// count lives in the closure, and `setState(0)` makes later calls see a state, so no second
// timer starts.
export function startTicker(surface: Tickable): void {
  if (surface.state !== undefined) {
    return
  }
  let count = 0
  surface.every(TICK_MS, () => {
    if (surface.isWindowFocused && !surface.isMotionReduced) {
      count += 1
      surface.setState(count)
    }
  })
  surface.setState(0)
}
