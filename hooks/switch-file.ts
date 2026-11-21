// Pure check for the switch file `<git root>/.claude/dry-run.json`. No engine
// calls, so a table test can run it. The gate keeps this file locked in every
// mode, so Claude cannot open its own gate.

import { splitPath } from './gate-path'

const SWITCH_FOLDER = '.claude'
const SWITCH_NAME = 'dry-run.json'

// True when the path starts at the root of a drive or of the disk.
function isAbsolute(path: string): boolean {
  const slashed = path.split('\\').join('/')
  return slashed.startsWith('/') || slashed.charAt(1) === ':'
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
// A relative path counts from `cwd`. No git root means no switch file.
export function isSwitchFile(path: unknown, cwd: string, gitRoot: string): boolean {
  if (typeof path !== 'string' || path.trim() === '' || gitRoot === '') {
    return false
  }
  const full = isAbsolute(path) ? path : cwd + '/' + path
  const want = [...lowerNames(gitRoot), SWITCH_FOLDER, SWITCH_NAME]
  const got = lowerNames(full)
  if (got.length !== want.length) {
    return false
  }
  for (let i = 0; i < want.length; i++) {
    if (got[i] !== want[i]) {
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
