// Color tokens of the Design Card: the `:root` sets of the look-and-feel prototype.
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
}

export const LIGHT: Tokens = {
  claude: '#c45f3d',
  claudeBg: '#f4e8e2',
  blue: '#2f62d0',
  blueBg: '#e8ebf3',
  green: '#1f8a46',
  greenBg: '#e4eee4',
  amber: '#9a6a00',
  amberBg: '#f0ebdd',
  red: '#c8304a',
  redBg: '#f6e7e7',
  violet: '#6a4fd1',
  violetBg: '#edeaf3',
  dim: '#6f6c66',
}

export function tokensFor(isLight: boolean): Tokens {
  return isLight ? LIGHT : DARK
}
