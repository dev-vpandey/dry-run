// Pure check: is an assistant message a dry run? No engine calls here.
// Rules: SPEC section 2. Keep the heading names in step with templates/dry-run-format.md.

const DRY_RUN_HEADING = '## Dry run'
const CHANGE_TABLE_HEADING = '### 2. Change table'
const LANGUAGE_HEADING = '### 8. Language explainer'

const ALWAYS_REQUIRED = [
  DRY_RUN_HEADING,
  '### 1. Bug and goal',
  CHANGE_TABLE_HEADING,
  '### 3. SOLID',
  '### 4. Pattern',
  '### 5. DSA',
  '### 6. Worked example',
  '### 7. Open decisions',
]

// File ending -> language, for the locked endings only. Keep in step with
// LOCKED_ENDINGS in gate-path.ts: a new locked ending needs a row here.
const LANGUAGE_OF_ENDING = new Map<string, string>([
  ['.java', 'java'],
  ['.kt', 'kotlin'],
  ['.scala', 'scala'],
  ['.py', 'python'],
  ['.ipynb', 'python'],
  ['.ts', 'typescript'],
  ['.tsx', 'typescript'],
  ['.js', 'javascript'],
  ['.jsx', 'javascript'],
  ['.go', 'go'],
  ['.rs', 'rust'],
  ['.rb', 'ruby'],
  ['.sql', 'sql'],
  ['.sh', 'shell'],
])

const FENCE = '```'

// The lines of a message outside code fences. A heading shown inside a fence is
// an example, not a heading. trimEnd drops the "\r" of a Windows line end.
function linesOf(text: string): string[] {
  const lines: string[] = []
  let isInFence = false
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trimEnd()
    if (line.trimStart().startsWith(FENCE)) {
      isInFence = !isInFence
    } else if (!isInFence) {
      lines.push(line)
    }
  }
  return lines
}

function isHeading(line: string): boolean {
  return line.startsWith('## ') || line.startsWith('### ')
}

// The lines under the change table heading, up to the next heading.
// A line like "# note" inside the table does not end it.
function changeTableLines(lines: string[]): string[] {
  const rows: string[] = []
  let isInside = false
  for (const line of lines) {
    if (line === CHANGE_TABLE_HEADING) {
      isInside = true
    } else if (isInside && isHeading(line)) {
      break
    } else if (isInside) {
      rows.push(line)
    }
  }
  return rows
}

// The first cell of a table row: text between the row edge and the next | or ║.
function firstCell(row: string): string {
  let rest = row.trim()
  if (rest.startsWith('|') || rest.startsWith('║')) {
    rest = rest.slice(1)
  }
  const pipe = rest.indexOf('|')
  const box = rest.indexOf('║')
  let end = rest.length
  if (pipe >= 0) {
    end = Math.min(end, pipe)
  }
  if (box >= 0) {
    end = Math.min(end, box)
  }
  return rest.slice(0, end)
}

// "src/a.py:12", "a.py," and "(a.py)." all name a .py file.
function cleanToken(token: string): string {
  let cleaned = token.replaceAll('`', '')
  const colon = cleaned.indexOf(':')
  if (colon >= 0) {
    cleaned = cleaned.slice(0, colon)
  }
  let end = cleaned.length
  while (end > 0 && ',.;)'.includes(cleaned.charAt(end - 1))) {
    end--
  }
  return cleaned.slice(0, end).replaceAll('(', '')
}

function languageOfToken(token: string): string | undefined {
  const cleaned = cleanToken(token)
  const dot = cleaned.lastIndexOf('.')
  if (dot < 0) {
    return undefined
  }
  return LANGUAGE_OF_ENDING.get(cleaned.slice(dot).toLowerCase())
}

// True when a path in the change table is in a language other than explainLanguage.
function hasOtherLanguage(lines: string[], explainLanguage: string): boolean {
  for (const row of changeTableLines(lines)) {
    for (const token of firstCell(row).split(' ')) {
      const language = languageOfToken(token)
      if (language !== undefined && language !== explainLanguage) {
        return true
      }
    }
  }
  return false
}

// Section 8 is required only when explainLanguage is set AND a changed file is in another language.
export function isDryRun(text: unknown, explainLanguage: string = ''): boolean {
  if (typeof text !== 'string') {
    return false
  }
  const lines = linesOf(text)
  const required = [...ALWAYS_REQUIRED]
  const language = explainLanguage.trim().toLowerCase()
  if (language !== '' && hasOtherLanguage(lines, language)) {
    required.push(LANGUAGE_HEADING)
  }
  for (const heading of required) {
    if (!lines.includes(heading)) {
      return false
    }
  }
  return true
}
