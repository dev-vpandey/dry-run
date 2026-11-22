import { expect, test } from 'claude-code/testing'
import {
  bundledFiles,
  joinRules,
  indexText,
  isRuleName,
  languageOf,
  overridePath,
  readerLine,
  statusLine,
  withReaderLine,
} from './rules'

test('only the five rule names are names', () => {
  for (const name of ['index', 'design', 'examples', 'dsa', 'platform']) {
    expect(isRuleName(name), name).toBe(true)
  }
  for (const name of ['coach', 'format', '', 'DSA', undefined, 3, null]) {
    expect(isRuleName(name), String(name)).toBe(false)
  }
})

test('each name maps to its bundled files', () => {
  expect(bundledFiles('index', 'generic')).toEqual(['dry-run-format.md', 'dry-run-names.md'])
  expect(bundledFiles('design', 'generic')).toEqual(['dry-run-design.md'])
  expect(bundledFiles('dsa', 'generic')).toEqual(['dry-run-dsa.md'])
  expect(bundledFiles('platform', 'generic')).toEqual(['dry-run-platform.md'])
})

test('examples gives the pack, then generic for the entries the pack lacks', () => {
  expect(bundledFiles('examples', 'generic')).toEqual(['examples/generic.md'])
  expect(bundledFiles('examples', 'data-pipeline')).toEqual(['examples/data-pipeline.md', 'examples/generic.md'])
  // An unknown pack is not a path: it falls back to generic.
  expect(bundledFiles('examples', '../../etc/passwd')).toEqual(['examples/generic.md'])
})

test('the override path sits under the home folder, same relative path', () => {
  expect(overridePath('/Users/me', 'examples/generic.md')).toBe('/Users/me/.claude/dry-run/templates/examples/generic.md')
  // No home folder: no override.
  expect(overridePath('', 'dry-run-dsa.md')).toBeNull()
})

test('the status line starts with the prefix in every state', () => {
  expect(statusLine('locked', false)).toBe('dry-run mod: locked; call dry_run_rules')
  expect(statusLine('open', false)).toBe('dry-run mod: open')
  expect(statusLine('off', false)).toBe('dry-run mod: off')
  expect(statusLine('off-repo', false)).toBe('dry-run mod: off (repo)')
  expect(statusLine('soft', false)).toBe('dry-run mod: soft; call dry_run_rules')
})

test('a blocked tool drops the call-the-tool hint, the text rides along instead', () => {
  expect(statusLine('locked', true)).toBe('dry-run mod: locked')
  expect(statusLine('soft', true)).toBe('dry-run mod: soft')
})

test('the reader line shows only when a language is set', () => {
  expect(readerLine('java')).toContain('java')
  expect(readerLine('java')).toContain('split')
  expect(readerLine('')).toBe('')
  expect(readerLine('off')).toBe('')
  expect(readerLine(' OFF ')).toBe('')
})

test('withReaderLine adds the line after the text only when set', () => {
  expect(withReaderLine('rules', 'off')).toBe('rules')
  expect(withReaderLine('rules', 'java')).toBe('rules\n\n' + readerLine('java'))
})

test('the index holds the format text, the names and one line per tool file', () => {
  const text = indexText(['FORMAT', 'NAMES'])
  expect(text).toContain('FORMAT')
  expect(text).toContain('NAMES')
  for (const name of ['design', 'examples', 'dsa']) {
    expect(text, name).toContain(`dry_run_rules("${name}")`)
  }
})

test('rule texts join in order, with a blank line between', () => {
  expect(joinRules(['A', 'B', 'C'])).toBe('A\n\nB\n\nC')
})

test('the language setting: a name, or "" for off, empty or not text', () => {
  expect(languageOf(' java ')).toBe('java')
  expect(languageOf('off')).toBe('')
  expect(languageOf('')).toBe('')
  expect(languageOf(true)).toBe('')
  expect(languageOf(undefined)).toBe('')
})
