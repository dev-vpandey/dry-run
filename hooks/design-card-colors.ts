// Color tokens of the Design Card: the dark `:root` set of the look-and-feel prototype. The
// engine gives a mod no signal for the person's color mode, so there is no light set.
// The tinted backgrounds are the prototype's rgba tints blended over its terminal color,
// because a terminal paints solid colors.

export type Tokens = {
  claude: string
  claudeBg: string
  blue: string
  blueBg: string
  green: string
  greenBg: string
  amber: string
  amberBg: string
  red: string
  redBg: string
  violet: string
  violetBg: string
  dim: string
  faint: string
  fg: string
  claudeHi: string
  // The terminal's own color, for text on a solid pill.
  term: string
}

export const DARK: Tokens = {
  claude: '#d77757',
  claudeBg: '#302320',
  blue: '#8fb3ff',
  blueBg: '#242833',
  green: '#4eba65',
  greenBg: '#1d2c22',
  amber: '#f2c14e',
  amberBg: '#322b1e',
  red: '#ff6b80',
  redBg: '#332025',
  violet: '#b9a6ff',
  violetBg: '#2a2835',
  dim: '#8a877f',
  faint: '#4a4844',
  fg: '#e6e3dc',
  claudeHi: '#ffcfb8',
  term: '#151517',
}
