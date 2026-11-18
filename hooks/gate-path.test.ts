import { expect, test } from 'claude-code/testing'
import { isLocked } from './gate-path'

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
