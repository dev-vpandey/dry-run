import { expect, test } from 'claude-code/testing'
import { parseRepoFile, restoreRepoFile } from './repo-file'

// What a repo without a usable file gets.
const DEFAULTS = { mode: 'on', hasMode: false, lock: [], unlock: [], platform: null }

test('a good file is read key by key', () => {
  const text = '{ "mode": "soft", "lock": [".yaml"], "unlock": ["generated/", ".SQL"] }'
  const result = parseRepoFile(text)
  expect(result.problems).toEqual([])
  expect(result.file).toEqual({
    mode: 'soft',
    hasMode: true,
    lock: ['.yaml'],
    unlock: ['generated/', '.sql'],
    platform: null,
  })
})

test('an empty object is a good file with the defaults', () => {
  const result = parseRepoFile('{}')
  expect(result.problems).toEqual([])
  expect(result.file).toEqual(DEFAULTS)
})

const BAD_FILES: [string, string][] = [
  ['bad JSON', '{ "mode": '],
  ['empty text', ''],
  ['an array', '[]'],
  ['null', 'null'],
  ['an unknown key', '{ "mode": "off", "mod": "on" }'],
  ['a bad mode value', '{ "mode": "loud" }'],
  ['a mode that is not text', '{ "mode": 1 }'],
  ['lock that is not a list', '{ "lock": ".py" }'],
  ['unlock with a non-text item', '{ "unlock": [1] }'],
]

test('a bad file is ignored whole: defaults and one problem', () => {
  for (const [name, text] of BAD_FILES) {
    const result = parseRepoFile(text)
    expect(result.file, name).toEqual(DEFAULTS)
    expect(result.problems.length, name).toBe(1)
  }
})

test('the problem for an unknown key names the key', () => {
  const result = parseRepoFile('{ "mod": "on" }')
  expect(result.problems[0]).toContain('mod')
})

const BAD_UNLOCK_ITEMS = [
  '../secret/',
  'a/../b/',
  '/etc/',
  '/abs/path.py',
  'C:\\work\\',
  '.claude/dry-run.json',
  './.CLAUDE/Dry-Run.json',
  '.claude/../.claude/dry-run.json',
]

test('unlock: items with .., an absolute path or the switch file are ignored and named', () => {
  for (const item of BAD_UNLOCK_ITEMS) {
    const result = parseRepoFile(JSON.stringify({ unlock: [item, 'generated/'] }))
    expect(result.file.unlock, item).toEqual(['generated/'])
    expect(result.problems.length, item).toBe(1)
    expect(result.problems[0], item).toContain(item)
  }
})

test('unlock: the other good items stay when one is bad', () => {
  const result = parseRepoFile('{ "unlock": [".sql", "../x/", "gen/"] }')
  expect(result.file.unlock).toEqual(['.sql', 'gen/'])
})

test('lock: an item with .. is not special, only unlock has limits', () => {
  const result = parseRepoFile('{ "lock": [".yaml"] }')
  expect(result.file.lock).toEqual(['.yaml'])
  expect(result.problems).toEqual([])
})

test('lock: a folder item is ignored and named, endings stay', () => {
  for (const item of ['generated/', 'src/gen/', './x/']) {
    const result = parseRepoFile(JSON.stringify({ lock: [item, '.yaml'] }))
    expect(result.file.lock, item).toEqual(['.yaml'])
    expect(result.problems.length, item).toBe(1)
    expect(result.problems[0], item).toContain(item)
    expect(result.problems[0], item).toContain('lock')
  }
})

test('platform: a good block is read', () => {
  const text = '{ "platform": { "agent": "research", "paths": ["src/**", "infra/*.tf"] } }'
  const result = parseRepoFile(text)
  expect(result.problems).toEqual([])
  expect(result.file.platform).toEqual({ agent: 'research', paths: ['src/**', 'infra/*.tf'] })
})

const BAD_PLATFORMS: [string, string][] = [
  ['not an object', '"x"'],
  ['null', 'null'],
  ['an array', '[]'],
  ['no agent', '{ "paths": ["a"] }'],
  ['an empty agent', '{ "agent": " ", "paths": ["a"] }'],
  ['an agent that is not text', '{ "agent": 1, "paths": ["a"] }'],
  ['no paths', '{ "agent": "r" }'],
  ['paths that are not a list', '{ "agent": "r", "paths": "a" }'],
  ['a path that is not text', '{ "agent": "r", "paths": [1] }'],
  ['an empty paths list', '{ "agent": "r", "paths": [] }'],
  ['an extra key', '{ "agent": "r", "paths": ["a"], "x": 1 }'],
]

test('platform: a bad shape ignores only platform, with one problem', () => {
  for (const [name, platform] of BAD_PLATFORMS) {
    const text = `{ "mode": "soft", "lock": [".yaml"], "platform": ${platform} }`
    const result = parseRepoFile(text)
    expect(result.file.platform, name).toBe(null)
    expect(result.file.mode, name).toBe('soft')
    expect(result.file.lock, name).toEqual(['.yaml'])
    expect(result.problems.length, name).toBe(1)
    expect(result.problems[0], name).toContain('platform')
  }
})

test('a stored repo file reads back whole, with a platform block', () => {
  const file = parseRepoFile('{ "mode": "off", "lock": [".yaml"], "unlock": [".sql"], "platform": { "agent": "r", "paths": ["a/"] } }').file
  expect(restoreRepoFile(JSON.stringify(file))).toEqual(file)
  expect(restoreRepoFile(JSON.stringify(parseRepoFile('{}').file))).toEqual(DEFAULTS)
})

test('stored text that is not a whole repo file gives the defaults', () => {
  const bad = [
    'not json',
    'null',
    '[]',
    '{}',
    '{ "mode": "loud", "hasMode": true, "lock": [], "unlock": [], "platform": null }',
    '{ "mode": "soft", "hasMode": "yes", "lock": [], "unlock": [], "platform": null }',
    '{ "mode": "soft", "hasMode": true, "lock": [1], "unlock": [], "platform": null }',
    '{ "mode": "soft", "hasMode": true, "lock": [], "unlock": "x", "platform": null }',
    '{ "mode": "soft", "hasMode": true, "lock": [], "unlock": [] }',
    '{ "mode": "soft", "hasMode": true, "lock": [], "unlock": [], "platform": { "agent": "" } }',
  ]
  for (const text of bad) {
    expect(restoreRepoFile(text)).toEqual(DEFAULTS)
  }
})
