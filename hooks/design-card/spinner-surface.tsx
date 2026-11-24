// The spinner of the pill or the stop being written, as a Client module with its own timer, so the
// band redraws only this pill. Rules: SPEC section 6 (spinner).

import type { ClientModule, ClientSurface } from 'claude-code'
import { spinnerAt } from './live-section'
import { startTicker } from './ticker'

export type SpinnerPillProps = {
  label: string
  color: string
  // A pill has a background; without one the spinner is plain text.
  background?: string
}

const SpinnerPill: ClientModule<SpinnerPillProps, number> = (props, surface: ClientSurface<number>) => {
  startTicker(surface)
  const { Text } = surface.elements
  const word = `${spinnerAt(surface.state ?? 0)} ${props.label}`
  if (props.background === undefined) {
    return <Text color={props.color}>{word}</Text>
  }
  return <Text color={props.color} backgroundColor={props.background} bold>{` ${word} `}</Text>
}

export default SpinnerPill
