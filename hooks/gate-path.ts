// Pure path check for the gate. No engine calls, so a table test can run it.

const LOCKED_ENDINGS = new Set([
  '.py',
  '.java',
  '.kt',
  '.scala',
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.go',
  '.rs',
  '.rb',
  '.sql',
  '.sh',
  '.ipynb',
])

// Folders where any file is free. Each is a run of folder names.
// Known gaps against SPEC section 3:
// - The session scratchpad is not free yet. No `$` call gives its path.
// - `.claude/plans` matches anywhere in the path, not only under the home folder.
const FREE_FOLDERS = [['.scratch'], ['.claude', 'plans']]

// Splits a path into folder names. Drops "" and ".". Resolves "..".
// A ".." with nothing to remove stays, so "../x.py" keeps its "..".
function splitPath(path: string): string[] {
  const parts = path.split('\\').join('/').split('/')
  const names: string[] = []
  for (const part of parts) {
    if (part === '' || part === '.') {
      continue
    }
    const canGoUp = names.length > 0 && names[names.length - 1] !== '..'
    if (part === '..' && canGoUp) {
      names.pop()
    } else {
      names.push(part)
    }
  }
  return names
}

// True when `folder` appears as a run of names in the path, before the file name.
function isUnderFolder(folders: string[], folder: string[]): boolean {
  for (let start = 0; start + folder.length <= folders.length; start++) {
    let matches = true
    for (let i = 0; i < folder.length; i++) {
      if (folders[start + i] !== folder[i]) {
        matches = false
      }
    }
    if (matches) {
      return true
    }
  }
  return false
}

// The ending of a file name in lower case, or "" when it has none.
// ".gitignore" and "Makefile" have no ending. "foo.py.md" ends in ".md".
function endingOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  if (dot <= 0) {
    return ''
  }
  return fileName.slice(dot).toLowerCase()
}

// True when the gate must lock this path. Throws when the input is not a path.
export function isLocked(path: unknown): boolean {
  if (typeof path !== 'string' || path.trim() === '') {
    throw new Error('gate: no file path in the tool call')
  }
  const names = splitPath(path)
  if (names.length === 0) {
    throw new Error(`gate: not a file path: ${path}`)
  }
  const fileName = names.pop() ?? ''
  for (const folder of FREE_FOLDERS) {
    if (isUnderFolder(names, folder)) {
      return false
    }
  }
  return LOCKED_ENDINGS.has(endingOf(fileName))
}
