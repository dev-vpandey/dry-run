// Turns "2.1.304" or "2.1.304-dev.2026..." into [2, 1, 304].
// Anything that is not a number counts as 0.
function parseVersion(version: string): number[] {
  const core = version.split('-')[0] ?? ''
  const numbers: number[] = []
  for (const part of core.split('.')) {
    const number = parseInt(part, 10)
    numbers.push(Number.isNaN(number) ? 0 : number)
  }
  return numbers
}

// True when `version` is lower than `floor`. Compares number by number.
export function isOlderThan(version: string, floor: string): boolean {
  const have = parseVersion(version)
  const need = parseVersion(floor)
  const length = Math.max(have.length, need.length)
  for (let i = 0; i < length; i++) {
    const a = have[i] ?? 0
    const b = need[i] ?? 0
    if (a !== b) {
      return a < b
    }
  }
  return false
}
