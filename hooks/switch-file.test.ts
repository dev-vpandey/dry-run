import { expect, test } from 'claude-code/testing'
import { candidateRoots, isSwitchFile, UNKNOWN_ROOT } from './switch-file'

const ROOT = '/repo'
const CWD = '/repo/src'

const SWITCH_PATHS = [
  '/repo/.claude/dry-run.json',
  '/repo/.CLAUDE/Dry-Run.JSON',
  '/repo/src/../.claude/dry-run.json',
  '/repo/./.claude/dry-run.json',
  // Relative paths resolve against the working folder.
  '../.claude/dry-run.json',
  '../../repo/.claude/dry-run.json',
]

const OTHER_PATHS = [
  '/repo/.claude/settings.json',
  '/repo/.claude/dry-run.json.md',
  '/repo/dry-run.json',
  '/repo/src/.claude/dry-run.json',
  '.claude/dry-run.json',
  '/other/.claude/dry-run.json',
  '/repo/.claude/sub/dry-run.json',
  'README.md',
]

test('the switch file is found by path, any case, any spelling', () => {
  for (const path of SWITCH_PATHS) {
    expect(isSwitchFile(path, CWD, ROOT), path).toBe(true)
  }
})

test('other files are not the switch file', () => {
  for (const path of OTHER_PATHS) {
    expect(isSwitchFile(path, CWD, ROOT), path).toBe(false)
  }
})

test('with no git root there is no switch file', () => {
  expect(isSwitchFile('/repo/.claude/dry-run.json', CWD, '')).toBe(false)
})

test('a path that is not a string is not the switch file', () => {
  expect(isSwitchFile(undefined, CWD, ROOT)).toBe(false)
  expect(isSwitchFile('', CWD, ROOT)).toBe(false)
})

test('candidate roots: the working folder, then each parent up to /', () => {
  expect(candidateRoots('/repo/src/deep')).toEqual(['/repo/src/deep', '/repo/src', '/repo', '/'])
  expect(candidateRoots('/')).toEqual(['/'])
  expect(candidateRoots('/repo/')).toEqual(['/repo', '/'])
})

test('when the git root is unknown, any path ending in .claude/dry-run.json is the switch file', () => {
  expect(isSwitchFile('/anywhere/.claude/dry-run.json', CWD, UNKNOWN_ROOT)).toBe(true)
  expect(isSwitchFile('.claude/dry-run.json', CWD, UNKNOWN_ROOT)).toBe(true)
  expect(isSwitchFile('/anywhere/.CLAUDE/Dry-Run.json', CWD, UNKNOWN_ROOT)).toBe(true)
  expect(isSwitchFile('/anywhere/.claude/other.json', CWD, UNKNOWN_ROOT)).toBe(false)
  expect(isSwitchFile('/anywhere/dry-run.json', CWD, UNKNOWN_ROOT)).toBe(false)
})
