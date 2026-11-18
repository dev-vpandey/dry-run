import { expect, test } from 'claude-code/testing'
import { isLocked } from './gate-path'

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
]

const BAD_INPUT = [undefined, null, 42, '', '   ', {}]

test('a locked ending is locked, in any case', async () => {
  for (const path of LOCKED_PATHS) {
    expect(isLocked(path), path).toBe(true)
  }
})

test('free endings, no ending and free folders are not locked', async () => {
  for (const path of FREE_PATHS) {
    expect(isLocked(path), path).toBe(false)
  }
})

test('bad input throws', async () => {
  for (const input of BAD_INPUT) {
    expect(() => isLocked(input as never), String(input)).toThrow()
  }
})
