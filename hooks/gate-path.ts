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

// A run of folder names, for example ['.scratch'].
type Run = string[]

// Folders where any file is free, wherever they sit in the path.
const FREE_ANYWHERE: Run[] = [['.scratch']]

// The scratchpad of a session sits in a folder called "scratchpad" under one
// of these temp folders. No `$` call gives its exact path, so match this shape.
const TEMP_ROOTS: Run[] = [['tmp'], ['private', 'tmp'], ['var', 'folders']]
const SCRATCHPAD = 'scratchpad'

// Splits a path into folder names. Drops "" and ".". Resolves "..".
// A ".." with nothing to remove stays, so "../x.py" keeps its "..".
export function splitPath(path: string): string[] {
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

// True when `run` appears inside `folders`, anywhere.
function containsRun(folders: string[], run: Run): boolean {
  for (let start = 0; start + run.length <= folders.length; start++) {
    if (startsWithRun(folders.slice(start), run)) {
      return true
    }
  }
  return false
}

// True when `folders` begins with `run`. An empty `run` never matches,
// so an unknown home folder frees nothing.
function startsWithRun(folders: string[], run: Run): boolean {
  if (run.length === 0 || run.length > folders.length) {
    return false
  }
  for (let i = 0; i < run.length; i++) {
    if (folders[i] !== run[i]) {
      return false
    }
  }
  return true
}

// "~/x" becomes "<home>/x". Without a home folder the "~" stays as it is.
function expandHome(path: string, home: string): string {
  if (home !== '' && (path === '~' || path.startsWith('~/'))) {
    return home + path.slice(1)
  }
  return path
}

// True when the folders sit in a free place.
function isFreeFolder(folders: string[], home: string): boolean {
  for (const run of FREE_ANYWHERE) {
    if (containsRun(folders, run)) {
      return true
    }
  }
  // ~/.claude/plans, only under the real home folder.
  if (startsWithRun(folders, [...splitPath(home), '.claude', 'plans'])) {
    return true
  }
  // The session scratchpad: <temp folder>/.../scratchpad/...
  for (const root of TEMP_ROOTS) {
    if (startsWithRun(folders, root) && folders.slice(root.length).includes(SCRATCHPAD)) {
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
// `home` is the user's home folder. "" means unknown, so no plans folder is free.
export function isLocked(path: unknown, home: string = ''): boolean {
  if (typeof path !== 'string' || path.trim() === '') {
    throw new Error('gate: no file path in the tool call')
  }
  const names = splitPath(expandHome(path, home))
  if (names.length === 0) {
    throw new Error(`gate: not a file path: ${path}`)
  }
  const fileName = names.pop() ?? ''
  if (isFreeFolder(names, home)) {
    return false
  }
  return LOCKED_ENDINGS.has(endingOf(fileName))
}
