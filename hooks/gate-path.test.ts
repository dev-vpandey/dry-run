import { expect, test } from 'claude-code/testing'
import { isLocked } from './gate-path'
import { lockRulesFor } from './repo-file'

const HOME = '/Users/me'

const LOCKED_PATHS = [
  'src/Foo.py',
  'src/Foo.PY',
  'src/Main.java',
  'a/b/c.kt',
  'a/b/c.scala',
  'app.ts',
  'app.tsx',
  'app.js',
  'app.jsx',
  'main.go',
  'lib.rs',
  'a.rb',
  'q.sql',
  'run.sh',
  'nb.ipynb',
  '/abs/path/to/foo.py',
  '../outside-repo/bar.py',
  '.scratch/../src/foo.py',
  'foo.md/../foo.py',
  'foo.md.py',
  // .claude/plans is free only under the home folder.
  '/repo/.claude/plans/x.py',
  '/Users/other/.claude/plans/x.py',
  '/Users/me/../other/.claude/plans/x.py',
  // "scratchpad" outside a temp folder is not free.
  '/repo/scratchpad/a.py',
  '/tmp/../repo/scratchpad/a.py',
  '/tmp/other/a.py',
]

const FREE_PATHS = [
  'README.md',
  'config.yaml',
  'config.yml',
  'data.json',
  'pyproject.toml',
  'notes.txt',
  'table.csv',
  'Makefile',
  'Dockerfile',
  '.gitignore',
  'foo.py.md',
  'page.html',
  '.scratch/try.py',
  '/repo/.scratch/try.py',
  '~/.claude/plans/x/demo.py',
  '/Users/me/.claude/plans/x/demo.py',
  '/Users/me/.claude/plans/x.py',
  // The session scratchpad.
  '/private/tmp/claude-501/proj/s1/scratchpad/a.py',
  '/tmp/claude-501/scratchpad/a.py',
  '/var/folders/ab/cd/T/claude/scratchpad/a.py',
]

const BAD_INPUT = [undefined, null, 42, '', '   ', {}]

test('a locked ending is locked, in any case', async () => {
  for (const path of LOCKED_PATHS) {
    expect(isLocked(path, HOME), path).toBe(true)
  }
})

test('free endings, no ending and free folders are not locked', async () => {
  for (const path of FREE_PATHS) {
    expect(isLocked(path, HOME), path).toBe(false)
  }
})

test('bad input throws', async () => {
  for (const input of BAD_INPUT) {
    expect(() => isLocked(input as never), String(input)).toThrow()
  }
})

test('without a home folder, no plans folder is free', async () => {
  expect(isLocked('~/.claude/plans/x.py', '')).toBe(true)
  expect(isLocked('/Users/me/.claude/plans/x.py', '')).toBe(true)
  expect(isLocked('/Users/me/.claude/plans/x.py', HOME)).toBe(false)
})

// Rules from a repo file at /repo, session in /repo/src.
const RULES = lockRulesFor(
  { mode: 'on', hasMode: true, lock: ['.yaml'], unlock: ['generated/', '.sql', 'docs/api/'], platform: null },
  '/repo/src',
  '/repo',
)

test('repo lock: an extra ending is locked, in any case', () => {
  expect(isLocked('/repo/config.yaml', HOME, RULES)).toBe(true)
  expect(isLocked('deploy/K8S.YAML', HOME, RULES)).toBe(true)
  expect(isLocked('/repo/config.yaml', HOME)).toBe(false)
})

test('repo unlock: an ending is free', () => {
  expect(isLocked('/repo/db/schema.sql', HOME, RULES)).toBe(false)
  expect(isLocked('/repo/db/schema.sql', HOME)).toBe(true)
})

test('repo unlock: a folder is free, counted from the git root', () => {
  expect(isLocked('/repo/generated/a.py', HOME, RULES)).toBe(false)
  expect(isLocked('/repo/docs/api/x/b.py', HOME, RULES)).toBe(false)
  // A relative path counts from the working folder, /repo/src.
  expect(isLocked('../generated/a.py', HOME, RULES)).toBe(false)
  expect(isLocked('generated/a.py', HOME, RULES)).toBe(true)
  // The same folder name deeper in the tree, or outside the repo, is not free.
  expect(isLocked('/repo/src/generated/a.py', HOME, RULES)).toBe(true)
  expect(isLocked('/other/generated/a.py', HOME, RULES)).toBe(true)
  expect(isLocked('/repo/docs/b.py', HOME, RULES)).toBe(true)
  // A ".." that climbs out of the folder does not stay free.
  expect(isLocked('/repo/generated/../src/a.py', HOME, RULES)).toBe(true)
})

test('repo unlock beats repo lock and the built-in endings', () => {
  const both = lockRulesFor(
    { mode: 'on', hasMode: true, lock: ['.yaml'], unlock: ['.yaml', '.py'], platform: null },
    '/repo',
    '/repo',
  )
  expect(isLocked('/repo/a.yaml', HOME, both)).toBe(false)
  expect(isLocked('/repo/a.py', HOME, both)).toBe(false)
})

test('repo rules do not free the fixed free places or lock them harder', () => {
  expect(isLocked('/repo/.scratch/x.yaml', HOME, RULES)).toBe(false)
  expect(isLocked('README.md', HOME, RULES)).toBe(false)
})

test('with no git root, repo folders free nothing but endings still work', () => {
  const noRoot = lockRulesFor(
    { mode: 'on', hasMode: true, lock: ['.yaml'], unlock: ['generated/', '.sql'], platform: null },
    '/repo',
    '',
  )
  expect(isLocked('/repo/generated/a.py', HOME, noRoot)).toBe(true)
  expect(isLocked('/repo/a.sql', HOME, noRoot)).toBe(false)
  expect(isLocked('/repo/a.yaml', HOME, noRoot)).toBe(true)
})

test('bad input still throws with repo rules', () => {
  expect(() => isLocked(undefined as never, HOME, RULES)).toThrow()
})
