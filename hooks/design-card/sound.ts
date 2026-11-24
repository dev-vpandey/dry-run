// The sounds of the mod: macOS system sounds played with `afplay`. Pure: this file only says
// what to run. The caller plays each step in order, only on macOS and with the setting on.
// Rules: SPEC section 6 (sound).

export type SoundKind = 'open' | 'coach' | 'blocked'

const DIR = '/System/Library/Sounds/'

const NOTES = new Map<SoundKind, string[]>([
  ['open', ['Tink', 'Glass']],
  ['coach', ['Ping']],
  ['blocked', ['Funk', 'Basso']],
])

// The commands to run, one after another.
export function soundSteps(kind: SoundKind): string[][] {
  return (NOTES.get(kind) ?? []).map(note => ['afplay', `${DIR}${note}.aiff`])
}
