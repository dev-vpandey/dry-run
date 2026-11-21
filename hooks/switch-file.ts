// Pure check for the switch file `<git root>/.claude/dry-run.json`. No engine
// calls, so a table test can run it. The gate keeps this file locked in every
// mode, so Claude cannot open its own gate.

import { splitPath } from './gate-path'

const SWITCH_FOLDER = '.claude'
const SWITCH_NAME = 'dry-run.json'

// Stands for a git root we could not find out. Then any path that ends in
// `.claude/dry-run.json` is the switch file: strict, so a failed lookup fails closed.
export const UNKNOWN_ROOT = '*'

// True when the path starts at the root of a drive or of the disk.
function isAbsolute(path: string): boolean {
  const slashed = path.split('\\').join('/')
  const firstChar = slashed.charAt(0)
  const isLetter = firstChar.toLowerCase() !== firstChar.toUpperCase()
  return slashed.startsWith('/') || (isLetter && slashed.charAt(1) === ':')
}

// The folder names in lower case. A file system may ignore case, so we do too.
function lowerNames(path: string): string[] {
  const names: string[] = []
  for (const name of splitPath(path)) {
    names.push(name.toLowerCase())
  }
  return names
}

// True when the path is the switch file of the repo at `gitRoot`.
// A relative path counts from `cwd`. "" means the repo has no git root, so there
// is no switch file. UNKNOWN_ROOT means we could not tell: match by ending only.
export function isSwitchFile(path: unknown, cwd: string, gitRoot: string): boolean {
  if (typeof path !== 'string' || path.trim() === '' || gitRoot === '') {
    return false
  }
  const full = isAbsolute(path) ? path : cwd + '/' + path
  const pathNames = lowerNames(full)
  const tail = [SWITCH_FOLDER, SWITCH_NAME]
  if (gitRoot === UNKNOWN_ROOT) {
    return endsWithNames(pathNames, tail)
  }
  return sameNames(pathNames, [...lowerNames(gitRoot), ...tail])
}

// True when both lists hold the same names in the same order.
function sameNames(first: string[], second: string[]): boolean {
  return first.length === second.length && endsWithNames(first, second)
}

// True when the last names of `names` are exactly `tail`.
function endsWithNames(names: string[], tail: string[]): boolean {
  if (names.length < tail.length) {
    return false
  }
  const offset = names.length - tail.length
  for (let i = 0; i < tail.length; i++) {
    if (names[offset + i] !== tail[i]) {
      return false
    }
  }
  return true
}

// The working folder, then each parent folder up to the top. The caller asks
// the engine which one holds a `.git` entry. The first one that does is the git root.
export function candidateRoots(cwd: string): string[] {
  const names = splitPath(cwd)
  const roots: string[] = []
  for (let count = names.length; count > 0; count--) {
    roots.push('/' + names.slice(0, count).join('/'))
  }
  roots.push('/')
  return roots
}
