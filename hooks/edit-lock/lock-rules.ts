import { splitPath } from './gate-path'
import type { LockRules } from './gate-path'
import { isAbsolute, UNKNOWN_ROOT } from './switch-file'

// True when `names` begins with `prefix`.
function startsWith(names: string[], prefix: string[]): boolean {
  if (prefix.length > names.length) {
    return false
  }
  for (let i = 0; i < prefix.length; i++) {
    if (names[i] !== prefix[i]) {
      return false
    }
  }
  return true
}

// The path check rules of a repo file. A relative path counts from `cwd`.
// "" or UNKNOWN_ROOT as `gitRoot` means folders free nothing.
export function lockRulesFor(file: { lock: string[]; unlock: string[] }, cwd: string, gitRoot: string): LockRules {
  const hasRoot = gitRoot !== '' && gitRoot !== UNKNOWN_ROOT
  const rootNames = hasRoot ? splitPath(gitRoot.toLowerCase()) : []
  const relativeNames = (path: string): string[] | null => {
    if (!hasRoot) {
      return null
    }
    const full = isAbsolute(path) ? path : cwd + '/' + path
    const names = splitPath(full.toLowerCase())
    return startsWith(names, rootNames) ? names.slice(rootNames.length) : null
  }
  return { lock: file.lock, unlock: file.unlock, relativeNames }
}
