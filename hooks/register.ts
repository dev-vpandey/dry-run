import type { Args, EngineInterface, PluginOptions, Register } from 'claude-code'
import { namesLockedFile, namesSwitchFile } from './edit-lock/bash-scan'
import { isDryRun } from './edit-lock/dry-run-check'
import { isLocked } from './edit-lock/gate-path'
import type { LockRules } from './edit-lock/gate-path'
import { lockRulesFor } from './edit-lock/lock-rules'
import { emptyRepoFile, parseRepoFile, restoreRepoFile } from './repo-config/repo-file'
import type { ParseResult, RepoFile } from './repo-config/repo-file'
import { goWordKind } from './edit-lock/go-word'
import { PANE_ID, PANE_TITLE, sectionCount, statusLineText } from './design-card/design-card'
import { LAYOUT_NAMES, layoutNamed, layoutOf } from './design-card/layout-model'
import { soundSteps } from './design-card/sound'
import type { SoundKind } from './design-card/sound'
import {
  bundledFiles,
  indexText,
  fallbackFiles,
  GENERIC_PACK,
  isRuleName,
  joinRules,
  overridePath,
  RULE_NAMES,
  statusLine,
  withReaderLine,
} from './edit-lock/rules'
import type { RuleName, RulesState } from './edit-lock/rules'
import { candidateRoots, isSwitchFile, UNKNOWN_ROOT } from './edit-lock/switch-file'
import { isOlderThan } from './compat/version'

// The version floor. ci.yml names the same version; a test checks they match.
export const MIN_VERSION = '2.1.304'

const DENY_TEXT =
  'dry-run mod: edits locked. Post a "## Dry run" and wait for /go. (User escape: /dry-run off)'

// State keys. Both must be literals in source. A value never written reads
// as undefined, so "not open" is the safe default.
const IS_OPEN = { plugin: 'dry-run', key: 'isOpen' } as const
const IS_OFF = { plugin: 'dry-run', key: 'isOff' } as const
const IS_REGISTERED = { plugin: 'dry-run', key: 'isRegistered' } as const
// A dry run was posted and no go has covered it yet.
const IS_WAITING = { plugin: 'dry-run', key: 'isWaiting' } as const
// The gate was opened by "just do it" with no dry run. The pane shows "skipped".
const IS_SKIPPED = { plugin: 'dry-run', key: 'isSkipped' } as const

// The person ran /dry-run on or off this session. Without it the source is "default".
const IS_SESSION_SET = { plugin: 'dry-run', key: 'isSessionSet' } as const
// The working folder of the session, and the git root found from it ("" when none).
const CWD = { plugin: 'dry-run', key: 'cwd' } as const
const GIT_ROOT = { plugin: 'dry-run', key: 'gitRoot' } as const

// The repo file set `soft`: dry runs, no gate. The person's /dry-run on clears it.
const IS_SOFT = { plugin: 'dry-run', key: 'isSoft' } as const
// The engine is older than the floor. The mod stays off, whatever the repo file says.
const IS_TOO_OLD = { plugin: 'dry-run', key: 'isTooOld' } as const
// The parsed repo file as JSON text, and its platform block (for ticket 34).
const REPO_FILE = { plugin: 'dry-run', key: 'repoFile' } as const
const PLATFORM = { plugin: 'dry-run', key: 'platform' } as const
const IS_GATE_TOAST_SHOWN = { plugin: 'dry-run', key: 'isGateToastShown' } as const
const LAST_PROBLEMS = { plugin: 'dry-run', key: 'lastProblems' } as const
// The layout the person chose with /dry-run layout. "" means the setting decides.
const LAYOUT_NAME = { plugin: 'dry-run', key: 'layoutName' } as const
// The last gate changes, newest last, joined with ">". A dropped go shows it, to find why the gate was not waiting.
const GATE_TRACE = { plugin: 'dry-run', key: 'gateTrace' } as const
const TRACE_LENGTH = 6

// The index went into this thread. It resets with a new session and a clear.
const IS_INDEX_SENT = { plugin: 'dry-run', key: 'isIndexSent' } as const
// The engine refused `$.tool.register`: the rule text rides on each prompt instead.
const IS_TOOL_BLOCKED = { plugin: 'dry-run', key: 'isToolBlocked' } as const
// The main thread posted a dry run since the session started or was cleared.
const IS_DRY_RUN_SEEN = { plugin: 'dry-run', key: 'isDryRunSeen' } as const

// The text of the newest dry run, for the Design Card. "" when none was posted.
const DRY_RUN_TEXT = { plugin: 'dry-run', key: 'dryRunText' } as const

// The section Claude is writing, for Clawd. The Design Card view writes it; a finished turn
// and a new thread clear it. The sound setting is on and the platform is macOS.
const LIVE_SECTION = { plugin: 'dry-run', key: 'liveSection' } as const
const IS_SOUND_ON = { plugin: 'dry-run', key: 'isSoundOn' } as const
// A Client of the Design Card failed this session (the view writes it): a new session retries.
const CLIENT_FAULT = { plugin: 'dry-run', key: 'clientFault' } as const

const REPO_FILE_PATH = '/.claude/dry-run.json'

const GO_NAME = 'go'
const DRY_RUN_NAME = 'dry-run'
const STOP_NAME = 'stop'
const STOP_FALLBACK_NAME = 'hold'

// True only when the flag was written as true. A flag never written reads as false.
// One function per flag on purpose: the engine needs each state key written
// out as a literal at the call site, so a shared helper cannot take the key.
async function isOff($: EngineInterface): Promise<boolean> {
  const read = await $.state.get(IS_OFF)
  return read.value === true
}

async function isOpen($: EngineInterface): Promise<boolean> {
  const read = await $.state.get(IS_OPEN)
  return read.value === true
}

async function isRegistered($: EngineInterface): Promise<boolean> {
  const read = await $.state.get(IS_REGISTERED)
  return read.value === true
}

async function isWaiting($: EngineInterface): Promise<boolean> {
  const read = await $.state.get(IS_WAITING)
  return read.value === true
}

async function isSoft($: EngineInterface): Promise<boolean> {
  const read = await $.state.get(IS_SOFT)
  return read.value === true
}

async function isTooOld($: EngineInterface): Promise<boolean> {
  const read = await $.state.get(IS_TOO_OLD)
  return read.value === true
}

async function isIndexSent($: EngineInterface): Promise<boolean> {
  const read = await $.state.get(IS_INDEX_SENT)
  return read.value === true
}

async function isToolBlocked($: EngineInterface): Promise<boolean> {
  const read = await $.state.get(IS_TOOL_BLOCKED)
  return read.value === true
}

async function isDryRunSeen($: EngineInterface): Promise<boolean> {
  const read = await $.state.get(IS_DRY_RUN_SEEN)
  return read.value === true
}

async function dryRunTextOf($: EngineInterface): Promise<string> {
  const read = await $.state.get(DRY_RUN_TEXT)
  return typeof read.value === 'string' ? read.value : ''
}

async function isSoundOn($: EngineInterface): Promise<boolean> {
  const read = await $.state.get(IS_SOUND_ON)
  return read.value === true
}

async function isGateToastShown($: EngineInterface): Promise<boolean> {
  const read = await $.state.get(IS_GATE_TOAST_SHOWN)
  return read.value === true
}

// The repo file of this session. A file never read, or text that does not parse,
// gives the defaults.
async function repoFileOf($: EngineInterface): Promise<RepoFile> {
  const read = await $.state.get(REPO_FILE)
  if (typeof read.value !== 'string' || read.value === '') {
    return emptyRepoFile()
  }
  return restoreRepoFile(read.value)
}

async function isSessionSet($: EngineInterface): Promise<boolean> {
  const read = await $.state.get(IS_SESSION_SET)
  return read.value === true
}

async function cwdOf($: EngineInterface): Promise<string> {
  const read = await $.state.get(CWD)
  return typeof read.value === 'string' ? read.value : ''
}

// A git root never written reads as unknown, so the switch file stays locked.
async function gitRootOf($: EngineInterface): Promise<string> {
  const read = await $.state.get(GIT_ROOT)
  return typeof read.value === 'string' ? read.value : UNKNOWN_ROOT
}

// A test for one path or word: is it the switch file of this session's repo?
async function switchFileCheck($: EngineInterface): Promise<(word: unknown) => boolean> {
  const cwd = await cwdOf($)
  const gitRoot = await gitRootOf($)
  return word => isSwitchFile(word, cwd, gitRoot)
}

// The path check rules from the repo file of this session.
async function lockRulesOf($: EngineInterface): Promise<LockRules> {
  return lockRulesFor(await repoFileOf($), await cwdOf($), await gitRootOf($))
}

// The first folder, from the working folder up, that holds a `.git` entry.
// "" when there is none. UNKNOWN_ROOT when the lookup itself failed.
async function findGitRoot($: EngineInterface, cwd: string): Promise<string> {
  try {
    for (const folder of candidateRoots(cwd)) {
      const prefix = folder === '/' ? '' : folder
      if (await $.fs.exists(prefix + '/.git')) {
        return folder
      }
    }
  } catch {
    // A failed lookup must not stop the session start, and must not free the switch file.
    return UNKNOWN_ROOT
  }
  return ''
}

// The home folder, or "" when the environment does not say. Names are literals
// because the engine lists them. HOME first, then USERPROFILE (Windows).
async function homeDir($: EngineInterface): Promise<string> {
  const home = await $.env.get('HOME')
  if (home !== undefined && home !== '') {
    return home
  }
  return (await $.env.get('USERPROFILE')) ?? ''
}

const GATE_OPEN_TOAST = '✓ Gate open. Edits allowed for this dry run.'

// One sound at a time: a run of blocked edits would otherwise stack their thuds.
let isSoundPlaying = false

// Plays the notes of a sound one after another, when the setting is on and no other sound is
// playing. It never throws: a sound that cannot play costs nothing else. Callers do not wait
// for it (`void playSound`).
export async function playSound($: EngineInterface, kind: SoundKind): Promise<void> {
  if (isSoundPlaying) {
    return
  }
  isSoundPlaying = true
  try {
    if (await isSoundOn($)) {
      for (const argv of soundSteps(kind)) {
        await $.process.run(argv)
      }
    }
  } catch {
    // No sound is not an error.
  } finally {
    isSoundPlaying = false
  }
}

// The deny answer of an edit tool, with the toast that names the blocked path.
function denyEdit($: EngineInterface, path: string): { deny: string } {
  $.ui.toast(`⊘ Blocked Update(${path}) — Post a dry run, then say "go".`)
  void playSound($, 'blocked')
  return { deny: DENY_TEXT }
}

// True when this edit must be denied. Throws when the tool call has no path.
// The switch file is locked in every mode, so /dry-run off does not free it.
// A bad path throws even when the mod is off: fail closed.
async function mustDeny($: EngineInterface, path: unknown): Promise<boolean> {
  const isSwitch = (await switchFileCheck($))(path)
  const isLockedFile = isLocked(path, await homeDir($), await lockRulesOf($))
  if (isSwitch) {
    return !(await isOpen($))
  }
  if ((await isOff($)) || (await isSoft($)) || !isLockedFile) {
    return false
  }
  return !(await isOpen($))
}

// Fail closed. If the guard threw before next, answer with the deny. If next
// already ran, replay it.
function failClosed<E, R>(next: ((e: E) => Promise<R>) & { called: boolean }, e: E, deny: R): Promise<R> | R {
  return next.called ? next(e) : deny
}

// The answer of a tool.call hook that threw before next: deny the call.
const FAIL_CLOSED_CALL = { deny: DENY_TEXT }

// The `command` of a Bash input, or undefined when the input has none.
function commandOf(input: unknown): unknown {
  if (typeof input === 'object' && input !== null && 'command' in input) {
    return input.command
  }
  return undefined
}

// True when this Bash call must be denied. Throws when the call has no command.
// A call with `isReadOnly` set is a read, so it is never denied.
async function mustDenyBash($: EngineInterface, e: Args<'tool.check'>): Promise<boolean> {
  if (e.isReadOnly === true) {
    return false
  }
  const command = commandOf(e.input)
  // The switch file is locked in every mode. No command throws, even when off.
  if (namesSwitchFile(command, await switchFileCheck($))) {
    return !(await isOpen($))
  }
  if ((await isOff($)) || (await isSoft($))) {
    return false
  }
  return namesLockedFile(command, await homeDir($), await lockRulesOf($)) && !(await isOpen($))
}

// The answer of a tool.check hook that threw before next: deny the check.
const FAIL_CLOSED_CHECK: { decision: 'deny'; reason: string } = { decision: 'deny', reason: DENY_TEXT }

async function registerStopCommand($: EngineInterface): Promise<void> {
  const description = 'Lock the gate again. Edits to code files need a new /go.'
  try {
    await $.command.register({ name: STOP_NAME, description, immediate: true })
  } catch {
    await $.command.register({ name: STOP_FALLBACK_NAME, description, immediate: true })
    $.ui.toast(`dry-run mod: /${STOP_NAME} is taken. Use /${STOP_FALLBACK_NAME} instead.`)
  }
}

// Sound is on when the setting says so and the platform is macOS (`afplay`). The platform is
// asked only when the setting is on.
async function soundWanted($: EngineInterface, options: PluginOptions): Promise<boolean> {
  if (options.sound !== true) {
    return false
  }
  try {
    return (await $.session.info()).platform === 'macos'
  } catch {
    return false
  }
}

// Adds one gate step to the trace: the last few steps, newest last.
async function trace($: EngineInterface, step: string): Promise<void> {
  const read = await $.state.get(GATE_TRACE)
  const steps = typeof read.value === 'string' && read.value !== '' ? read.value.split('>') : []
  await $.state.set(GATE_TRACE, [...steps, step].slice(-TRACE_LENGTH).join('>'))
}

async function startSession($: EngineInterface, cwd: string, options: PluginOptions): Promise<void> {
  await $.state.set(IS_SOUND_ON, await soundWanted($, options))
  await $.state.set(CLIENT_FAULT, '')
  await $.state.set(LAYOUT_NAME, '')
  await $.state.set(GATE_TRACE, '')
  await $.state.set(IS_OPEN, false)
  await $.state.set(IS_SESSION_SET, false)
  await $.state.set(CWD, cwd)
  await $.state.set(GIT_ROOT, await findGitRoot($, cwd))
  await $.state.set(IS_WAITING, false)
  await trace($, 'start')
  await $.state.set(IS_SKIPPED, false)
  await $.state.set(IS_SOFT, false)
  await $.state.set(IS_GATE_TOAST_SHOWN, false)
  await $.state.set(LAST_PROBLEMS, '')
  await resetThread($)
  await $.state.set(IS_TOOL_BLOCKED, false)
  const engine = await $.session.version()
  const isOld = isOlderThan(engine.version, MIN_VERSION)
  await $.state.set(IS_TOO_OLD, isOld)
  await $.state.set(IS_OFF, isOld)
  if (isOld) {
    $.ui.toast(`dry-run mod needs Claude Code ${MIN_VERSION} or newer. It is off for this session.`)
    await refreshStatus($)
    return
  }
  await loadRepoFile($)
  await registerCommands($)
  await registerRulesTool($)
  // The pane is a view: a session without it still gates edits, so a failed open is not an error.
  await $.ui.open({ id: PANE_ID, title: PANE_TITLE }).catch(() => undefined)
}

// A new thread gets the index again, and the fallback text until a dry run is posted.
async function resetThread($: EngineInterface): Promise<void> {
  await $.state.set(IS_INDEX_SENT, false)
  await $.state.set(IS_DRY_RUN_SEEN, false)
  await $.state.set(DRY_RUN_TEXT, '')
  await $.state.set(LIVE_SECTION, '')
}

const RULES_TOOL_NAME = 'dry_run_rules'
const RULES_TOOL = 'mcp__dry-run__dry_run_rules'
const BLOCKED_TOAST = 'Rules tool blocked by your org. Using fallback text.'

// The tool serves the rule text with no permission prompt. An org that sets
// allowedMcpServers refuses the register: then the text rides on each prompt.
async function registerRulesTool($: EngineInterface): Promise<void> {
  try {
    await $.tool.register({
      name: RULES_TOOL_NAME,
      description:
        'Rule text for the dry-run mod. name: index (format and names), design, examples, dsa or platform. Call it before you post a dry run.',
      inputSchema: {
        type: 'object',
        properties: { name: { type: 'string', enum: [...RULE_NAMES] } },
        required: ['name'],
      },
      isDeferred: false,
    })
  } catch {
    await $.state.set(IS_TOOL_BLOCKED, true)
    $.ui.toast(BLOCKED_TOAST)
  }
}

// The example pack the setting names, generic when it is missing or not text.
function packOf(options: PluginOptions): string {
  const value = options.examplePack
  return typeof value === 'string' ? value : GENERIC_PACK
}

async function readText($: EngineInterface, path: string): Promise<string> {
  const text = await $.fs.read(path)
  if (typeof text !== 'string') {
    throw new Error(`rule file: not text: ${path}`)
  }
  return text
}

// The text of one file, or throws. The user's copy wins over the bundled one. A copy
// that cannot be read is skipped: a bad override must not take the rules away.
async function readRuleFile($: EngineInterface, relative: string): Promise<string> {
  const override = overridePath(await homeDir($), relative)
  if (override !== null && (await $.fs.exists(override))) {
    try {
      return await readText($, override)
    } catch {
      // Fall through to the bundled file.
    }
  }
  return readText($, `${$.plugin.root}/templates/${relative}`)
}

async function readRuleFiles($: EngineInterface, files: string[]): Promise<string[]> {
  const texts: string[] = []
  for (const file of files) {
    texts.push(await readRuleFile($, file))
  }
  return texts
}

// The text one rule name returns, with the reader's-language line when set.
async function ruleText($: EngineInterface, name: RuleName, options: PluginOptions): Promise<string> {
  const pack = packOf(options)
  const language = options.explainLanguage
  if (name === 'index') {
    return withReaderLine(indexText(await readRuleFiles($, bundledFiles('index', pack))), language)
  }
  return withReaderLine(joinRules(await readRuleFiles($, bundledFiles(name, pack))), language)
}

// Everything the model needs to write a dry run, for the fallback.
async function fallbackRuleText($: EngineInterface, options: PluginOptions): Promise<string> {
  const files = fallbackFiles(packOf(options))
  return withReaderLine(joinRules(await readRuleFiles($, files)), options.explainLanguage)
}

// The state the status line names. `off (repo)` is an off the repo file set and
// the person did not change.
async function rulesState($: EngineInterface): Promise<RulesState> {
  if (await isOff($)) {
    const isRepoOff = !(await isSessionSet($)) && (await repoFileOf($)).mode === 'off'
    return isRepoOff ? 'off-repo' : 'off'
  }
  if (await isSoft($)) {
    return 'soft'
  }
  return (await isOpen($)) ? 'open' : 'locked'
}

// What one prompt carries for the model: the rule text when it is due, then the
// status line. A rule file that cannot be read costs the text, never the prompt.
// `hasIndex` is true when the index is in `texts`: the caller marks it sent only
// once the prompt has entered.
async function rulesContext(
  $: EngineInterface,
  options: PluginOptions,
): Promise<{ texts: string[]; hasIndex: boolean }> {
  const state = await rulesState($)
  const isBlocked = await isToolBlocked($)
  const status = statusLine(state, isBlocked)
  if (state === 'off' || state === 'off-repo') {
    return { texts: [status], hasIndex: false }
  }
  try {
    if (isBlocked) {
      const isFallbackDue = state !== 'open' && !(await isDryRunSeen($))
      return { texts: isFallbackDue ? [await fallbackRuleText($, options), status] : [status], hasIndex: false }
    }
    if (await isIndexSent($)) {
      return { texts: [status], hasIndex: false }
    }
    return { texts: [await ruleText($, 'index', options), status], hasIndex: true }
  } catch {
    return { texts: [status], hasIndex: false }
  }
}

// The name the model passed to the rules tool. Anything may arrive.
function ruleNameOf(input: object): unknown {
  return 'name' in input ? input.name : undefined
}

// The text of the repo file, or null when the session has no git root or the
// file is not there. Throws when the file cannot be read.
async function readRepoFileText($: EngineInterface): Promise<string | null> {
  const gitRoot = await gitRootOf($)
  if (gitRoot === '' || gitRoot === UNKNOWN_ROOT) {
    return null
  }
  const path = (gitRoot === '/' ? '' : gitRoot) + REPO_FILE_PATH
  if (!(await $.fs.exists(path))) {
    return null
  }
  const text = await $.fs.read(path)
  if (typeof text !== 'string') {
    throw new Error('repo file: not text')
  }
  return text
}

// Parses the repo file. A file that cannot be read is a bad file.
async function parseRepoFileOf($: EngineInterface): Promise<ParseResult> {
  try {
    const text = await readRepoFileText($)
    return text === null ? { file: emptyRepoFile(), problems: [] } : parseRepoFile(text)
  } catch {
    return { file: emptyRepoFile(), problems: ['Repo file ignored: it could not be read.'] }
  }
}

// One toast per problem. The same set of problems is not shown twice in a row,
// because a /clear raises two signals.
async function showProblems($: EngineInterface, problems: string[]): Promise<void> {
  const key = problems.join('\n')
  const last = await $.state.get(LAST_PROBLEMS)
  if (key === last.value) {
    return
  }
  await $.state.set(LAST_PROBLEMS, key)
  for (const problem of problems) {
    $.ui.toast(problem)
  }
}

// Once per session, when the repo file takes the gate down.
async function showGateDown($: EngineInterface, file: RepoFile): Promise<void> {
  const isDown = file.mode !== 'on' || file.unlock.length > 0
  if (!isDown || (await isGateToastShown($)) || (await isSessionSet($))) {
    return
  }
  await $.state.set(IS_GATE_TOAST_SHOWN, true)
  $.ui.toast(`Repo sets dry-run mod: ${file.mode}. \`/dry-run on\` to lock.`)
}

// Reads the repo file at session start and after /clear. The repo sets the start
// state. The person's /dry-run on or off wins, so it is never overwritten here.
async function loadRepoFile($: EngineInterface): Promise<void> {
  // An engine below the floor keeps the mod off, so the repo file means nothing.
  if (await isTooOld($)) {
    return
  }
  const result = await parseRepoFileOf($)
  await $.state.set(REPO_FILE, JSON.stringify(result.file))
  await $.state.set(PLATFORM, result.file.platform === null ? '' : JSON.stringify(result.file.platform))
  await showProblems($, result.problems)
  if (!(await isSessionSet($))) {
    await $.state.set(IS_OFF, result.file.mode === 'off')
    await $.state.set(IS_SOFT, result.file.mode === 'soft')
  }
  await showGateDown($, result.file)
  await refreshStatus($)
}

// Register /go and /stop once. A second session.start must not register them again.
async function registerCommands($: EngineInterface): Promise<void> {
  if (await isRegistered($)) {
    return
  }
  await $.command.register({ name: GO_NAME, description: 'Approve the dry run. Edits open.' })
  await registerStopCommand($)
  await $.command.register({ name: DRY_RUN_NAME, description: 'Show, or set, the dry-run mod: on or off.' })
  await $.state.set(IS_REGISTERED, true)
}

// One go opens the gate. It ends the waiting mark and sets the skipped mark
// to the given value (true only for "just do it" with no dry run).
export async function openGate($: EngineInterface, isSkipped: boolean): Promise<void> {
  await $.state.set(IS_OPEN, true)
  await $.state.set(IS_WAITING, false)
  await $.state.set(IS_SKIPPED, isSkipped)
  await trace($, 'open')
  $.ui.toast(GATE_OPEN_TOAST)
  void playSound($, 'open')
  await refreshStatus($)
}

// The UI status line: gate, sections done, and (repo) when the repo file set the mode.
// The line is cleared while the mod is off or soft: there is no gate to show.
async function refreshStatus($: EngineInterface): Promise<void> {
  const state = await rulesState($)
  if (state !== 'locked' && state !== 'open') {
    await $.ui.status(undefined)
    return
  }
  const isRepo = !(await isSessionSet($)) && (await repoFileOf($)).hasMode
  await $.ui.status(statusLineText({ gate: state, count: sectionCount(await dryRunTextOf($)), isRepo }))
}

// The text /dry-run shows: the mode, where it came from, and the gate.
async function statusText($: EngineInterface): Promise<string> {
  let source = 'default'
  if (await isSessionSet($)) {
    source = 'session'
  } else if ((await repoFileOf($)).hasMode) {
    source = 'repo'
  }
  if (await isOff($)) {
    return `dry-run mod: off (source: ${source}).`
  }
  if (await isSoft($)) {
    return `dry-run mod: soft (source: ${source}). No gate.`
  }
  const gate = (await isOpen($)) ? 'open' : 'locked'
  return `dry-run mod: on (source: ${source}). Gate ${gate}.`
}

const LAYOUT_USAGE = `Use /dry-run layout ${LAYOUT_NAMES.slice(0, -1).join(', ')} or ${LAYOUT_NAMES[LAYOUT_NAMES.length - 1]}.`

// /dry-run layout shows the layout, /dry-run layout rail sets it for this session. The settings
// decide the layout of a new session.
async function runLayoutCommand($: EngineInterface, name: string, options: PluginOptions): Promise<string> {
  const wanted = name.trim()
  if (wanted === '') {
    const stored = (await $.state.get(LAYOUT_NAME)).value
    return `dry-run layout: ${layoutOf(stored === '' || stored === undefined ? options.layout : stored)}. ${LAYOUT_USAGE}`
  }
  const layout = layoutNamed(wanted)
  if (layout === undefined) {
    return LAYOUT_USAGE
  }
  await $.state.set(LAYOUT_NAME, layout)
  return `dry-run layout: ${layout}.`
}

// /dry-run, /dry-run on, /dry-run off and /dry-run layout. Anything else shows the usage.
async function runDryRunCommand($: EngineInterface, args: string, options: PluginOptions): Promise<{ text: string }> {
  const word = args.trim().toLowerCase()
  if (word === 'layout' || word.startsWith('layout ')) {
    return { text: await runLayoutCommand($, word.slice('layout'.length), options) }
  }
  if (word === 'off') {
    await $.state.set(IS_OFF, true)
    await $.state.set(IS_SESSION_SET, true)
  } else if (word === 'on') {
    await $.state.set(IS_OFF, false)
    await $.state.set(IS_SOFT, false)
    await $.state.set(IS_SESSION_SET, true)
    await lockGate($)
  } else if (word !== '') {
    return { text: 'Use /dry-run, /dry-run on, /dry-run off or /dry-run layout.' }
  }
  await refreshStatus($)
  return { text: await statusText($) }
}

// A new dry run locks the gate and waits for the next go.
async function waitForGo($: EngineInterface, dryRun: string): Promise<void> {
  await $.state.set(IS_DRY_RUN_SEEN, true)
  await $.state.set(DRY_RUN_TEXT, dryRun)
  await $.state.set(IS_OPEN, false)
  await $.state.set(IS_WAITING, true)
  await $.state.set(IS_SKIPPED, false)
  await trace($, 'wait')
  await refreshStatus($)
}

// The section 8 rule needs the explainLanguage setting. That setting is not
// built yet, so it is empty and section 8 is never required for now.
const EXPLAIN_LANGUAGE = ''

// True when this prompt is the person's own words: typed at the terminal or sent
// from a phone or web client. Not a command, not hidden, not a subagent, and not
// a notification, a peer, a plugin or an SDK host.
function isFromPerson(e: Args<'prompt.submit'>): boolean {
  const isPersonOrigin = e.origin.kind === 'composer' || e.origin.kind === 'bridge'
  return isPersonOrigin && e.command === undefined && e.isMeta !== true && isMainLoop(e)
}

// Event types do not list agentId on every event. It is set only inside a subagent.
function isMainLoop(e: object): boolean {
  return !('agentId' in e) || e.agentId === undefined
}

async function traceOf($: EngineInterface): Promise<string> {
  const read = await $.state.get(GATE_TRACE)
  return typeof read.value === 'string' ? read.value : ''
}

// A go word opens the gate. Returns why the prompt is dropped, or null to let it pass.
async function applyGoWord($: EngineInterface, e: Args<'prompt.submit'>): Promise<string | null> {
  const kind = goWordKind(e.text)
  if ((await isOff($)) || kind === 'none') {
    return null
  }
  if (await isWaiting($)) {
    await openGate($, false)
    return null
  }
  if (kind === 'just-do-it') {
    // Gate already open: nothing to unlock, and the open dry run stays as it is.
    if (!(await isOpen($))) {
      await openGate($, true)
    }
    return null
  }
  return `no dry run to approve · gate ${(await isOpen($)) ? 'open' : 'locked'}, nothing waiting (${await traceOf($)})`
}

// A clear: lock the gate and read the repo file again.
async function lockOnClear($: EngineInterface): Promise<void> {
  await resetThread($)
  await lockGate($)
  await loadRepoFile($)
}

export async function lockGate($: EngineInterface) {
  await $.state.set(IS_OPEN, false)
  await $.state.set(IS_WAITING, false)
  await $.state.set(IS_SKIPPED, false)
  await trace($, 'lock')
  await refreshStatus($)
  return { text: '⊘ Gate locked. Edits to code files are blocked.' }
}

export const register: Register = (on, options) => {
  on('session.start', async ($, e, next) => {
    await startSession($, e.cwd, options)
    return next(e)
  })

  // A real /clear raises session.end with reason "clear", and no session.start.
  // The classic SessionStart with source "clear" is the second signal. Either one
  // locks the gate. /dry-run off stays: it holds for the whole session.
  on('session.end', async ($, e, next) => {
    if (e.reason === 'clear') {
      await lockOnClear($)
    }
    return next(e)
  })
  on('classic.SessionStart', async ($, e, next) => {
    if (e.source === 'clear') {
      await lockOnClear($)
    }
    return next(e)
  })

  // One hook per edit tool. Each names its tool as a literal, so the engine can
  // narrow the call. A loop over a list of names gives it a union it cannot match.
  on('tool.call', { tool: 'Edit' }, async ($, e, next) => {
    return (await mustDeny($, e.file_path)) ? denyEdit($, e.file_path) : next(e)
  }).catch(($, e, next) => failClosed(next, e, FAIL_CLOSED_CALL))
  on('tool.call', { tool: 'Write' }, async ($, e, next) => {
    return (await mustDeny($, e.file_path)) ? denyEdit($, e.file_path) : next(e)
  }).catch(($, e, next) => failClosed(next, e, FAIL_CLOSED_CALL))
  on('tool.call', { tool: 'NotebookEdit' }, async ($, e, next) => {
    return (await mustDeny($, e.notebook_path)) ? denyEdit($, e.notebook_path) : next(e)
  }).catch(($, e, next) => failClosed(next, e, FAIL_CLOSED_CALL))

  // Bash may write a file. Deny when it names a locked file and is not read-only.
  on('tool.check', { tool: 'Bash' }, async ($, e, next) => {
    return (await mustDenyBash($, e)) ? { decision: 'deny', reason: DENY_TEXT } : next(e)
  }).catch(($, e, next) => failClosed(next, e, FAIL_CLOSED_CHECK))

  // A dry run posted by the main thread locks the gate and waits for a go.
  // Lock first, then next(e): if next throws, the gate is already locked.
  on('turn.complete', async ($, e, next) => {
    if (isMainLoop(e)) {
      await $.state.set(LIVE_SECTION, '')
    }
    if (isMainLoop(e) && !(await isOff($))) {
      if (isDryRun(e.answer, EXPLAIN_LANGUAGE)) {
        await waitForGo($, e.answer)
      } else {
        await trace($, 'turn')
      }
    }
    return next(e)
  })

  // A go word, sent as the whole message, opens the gate. Then the rules go in: the
  // status line of the prompt that opens the gate already says open. One hook, because
  // the engine takes only one prompt.submit hook without a matcher.
  on('prompt.submit', async ($, e, next) => {
    if (!isFromPerson(e)) {
      return next(e)
    }
    const dropReason = await applyGoWord($, e)
    if (dropReason !== null) {
      return { drop: dropReason }
    }
    const rules = await rulesContext($, options)
    const answer = await next({ ...e, context: [...(e.context ?? []), ...rules.texts] })
    if (rules.hasIndex && answer.drop === undefined) {
      await $.state.set(IS_INDEX_SENT, true)
    }
    return answer
  })

  // Served at tool.call and not at tool.run, so no permission prompt appears.
  on('tool.call', { tool: RULES_TOOL }, async ($, e) => {
    const name = ruleNameOf(e)
    if (!isRuleName(name)) {
      return { deny: `dry_run_rules: name must be one of ${RULE_NAMES.join(' | ')}` }
    }
    try {
      return { result: await ruleText($, name, options) }
    } catch {
      return { deny: `dry_run_rules: could not read the ${name} rules.` }
    }
  })

  on('command.run', { command: GO_NAME }, async $ => {
    await openGate($, false)
    return { text: '✓ Gate open. Edits allowed for this dry run.' }
  })

  on('command.run', { command: DRY_RUN_NAME }, ($, e) => runDryRunCommand($, e.args, options))

  for (const name of [STOP_NAME, STOP_FALLBACK_NAME]) {
    on('command.run', { command: name }, $ => lockGate($))
  }
}
