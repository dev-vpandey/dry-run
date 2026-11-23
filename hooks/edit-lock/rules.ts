// Rule delivery: which files each rule name reads, and the text that rides on a prompt.
// Pure functions only. The engine calls (reading files, sending context) live in register.ts.

export type RuleName = 'index' | 'design' | 'examples' | 'dsa' | 'platform'

export const RULE_NAMES: readonly RuleName[] = ['index', 'design', 'examples', 'dsa', 'platform']

// The state of the gate, as the status line names it.
export type RulesState = 'locked' | 'open' | 'off' | 'off-repo' | 'soft'

const STATUS_PREFIX = 'dry-run mod:'
export const FORMAT_FILE = 'dry-run-format.md'
const NAMES_FILE = 'dry-run-names.md'
export const GENERIC_PACK = 'generic'
const PACKS = [GENERIC_PACK, 'data-pipeline']

// The files of the names that read one fixed set. `examples` depends on the pack.
const FIXED_FILES = new Map<RuleName, string[]>([
  ['index', [FORMAT_FILE, NAMES_FILE]],
  ['design', ['dry-run-design.md']],
  ['dsa', ['dry-run-dsa.md']],
  ['platform', ['dry-run-platform.md']],
])

// One line per rule file the model can fetch. The model reads these in the index.
// `platform` joins in ticket 34, when its file exists.
const INDEX_LINES = new Map<RuleName, string>([
  ['design', 'SOLID and pattern rules. Call before sections 3 and 4.'],
  ['examples', 'Java and Python example per rule, from the chosen pack.'],
  ['dsa', 'DSA entries with Big-O and verified links. Skip when the change has no DSA choice.'],
])

export function isRuleName(value: unknown): value is RuleName {
  return RULE_NAMES.some(name => name === value)
}

// The files, relative to `templates/`, that one name reads. An unknown pack is not
// used as a path: it reads as the generic pack.
export function bundledFiles(name: RuleName, pack: string): string[] {
  if (name !== 'examples') {
    return FIXED_FILES.get(name) ?? []
  }
  if (pack === GENERIC_PACK || !PACKS.includes(pack)) {
    return [`examples/${GENERIC_PACK}.md`]
  }
  // The pack may lack an entry. Generic follows, so the model can use its entry.
  return [`examples/${pack}.md`, `examples/${GENERIC_PACK}.md`]
}

// Every file the fallback sends, in order: the format, the names, then the rule files.
export function fallbackFiles(pack: string): string[] {
  const files = [FORMAT_FILE, NAMES_FILE]
  for (const name of ['design', 'examples', 'dsa'] as const) {
    files.push(...bundledFiles(name, pack))
  }
  return files
}

// Where a user's copy of one file sits. null when the home folder is not known.
export function overridePath(home: string, relative: string): string | null {
  if (home === '') {
    return null
  }
  return `${home}/.claude/dry-run/templates/${relative}`
}

// The one line every prompt carries. While the tool is blocked the hint to call it is
// dropped, because the rule text rides along instead.
export function statusLine(state: RulesState, isToolBlocked: boolean): string {
  switch (state) {
    case 'open':
      return `${STATUS_PREFIX} open`
    case 'off':
      return `${STATUS_PREFIX} off`
    case 'off-repo':
      return `${STATUS_PREFIX} off (repo)`
    case 'locked':
    case 'soft':
      return isToolBlocked ? `${STATUS_PREFIX} ${state}` : `${STATUS_PREFIX} ${state}; call dry_run_rules`
  }
}

// The language the setting names, or "" when none is set. `off` is the default.
export function languageOf(value: unknown): string {
  if (typeof value !== 'string') {
    return ''
  }
  const name = value.trim()
  return name.toLowerCase() === 'off' ? '' : name
}

// The reader's-language line, or "" when no language is set.
export function readerLine(language: unknown): string {
  const name = languageOf(language)
  if (name === '') {
    return ''
  }
  return `Reader's language: ${name}. Write code for a ${name} reader: plain loops, a few short methods, split before regex.`
}

export function withReaderLine(text: string, language: unknown): string {
  const line = readerLine(language)
  return line === '' ? text : `${text}\n\n${line}`
}

// The index: the file texts it holds (format, names), then one line per file the tool serves.
export function indexText(parts: string[]): string {
  const lines: string[] = []
  for (const [name, what] of INDEX_LINES) {
    lines.push(`- dry_run_rules("${name}"): ${what}`)
  }
  return [...parts, 'More rules, one tool call each:\n' + lines.join('\n')].join('\n\n')
}

// Several file texts as one text, in the order given.
export function joinRules(texts: string[]): string {
  return texts.join('\n\n')
}
