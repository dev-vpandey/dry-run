// Clawd drawn as a Client module: its own 150 ms timer redraws only these rows, never the pane.
// The pane hands it the costume and the colors as plain data. Rules: SPEC section 6.

import type { ClientElements, ClientModule, ClientSurface } from 'claude-code'
import { captionOf, frameAt } from './clawd-frames'
import type { Hue, Mood } from './clawd-frames'
import { startTicker } from './ticker'

// The props a Client takes are plain data. The colors are the pane's tokens, by hue.
export type ClawdProps = {
  mood: Mood
  flags: number
  colors: Record<Hue, string>
  captionColor: string
}

// The rows of one frame and the caption under it, at a tick.
export function drawClawd(elements: ClientElements, props: ClawdProps, tick: number) {
  const { Box, Text } = elements
  const rows = frameAt(props.mood, tick, props.flags).map(row => (
    <Box>
      {row.map(piece => <Text color={props.colors[piece.hue]} bold={piece.bold}>{piece.text}</Text>)}
    </Box>
  ))
  return (
    <Box flexDirection="column">
      {rows}
      <Text color={props.captionColor}>{captionOf(props.mood)}</Text>
    </Box>
  )
}

// A tick counts up on the surface's own clock. It rests while the window has no focus, and
// stays on the first frame for a person who asked for less motion.
const Clawd: ClientModule<ClawdProps, number> = (props, surface: ClientSurface<number>) => {
  startTicker(surface)
  return drawClawd(surface.elements, props, surface.state ?? 0)
}

export default Clawd
