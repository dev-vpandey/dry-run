import { expect, test } from 'claude-code/testing'
import { namesLockedFile } from './bash-scan'

const HOME = '/Users/me'

const DENIED = [
  'sed -i s/a/b/ src/foo.py',
  "sed -i '' 's/a/b/' foo.py",
  'echo x > foo.py',
  'echo x >foo.py',
  'echo x >> foo.py',
  'cat <<EOF > foo.py\nhello\nEOF',
  'echo x | tee foo.py',
  'tee -a src/Main.java',
  'cp a.txt foo.py',
  'mv old.py new.py',
  'mv old.txt new.py',
  'pytest tests/ && echo x > foo.py',
  'python gen.py > out.py',
  'echo x > SRC/Foo.PY',
  // Accepted false block: no quote stripping, kept strict.
  'git commit -m "fix foo.py"',
]

const ALLOWED = [
  'echo x > notes.md',
  'pytest tests/',
  'git status',
  'ls -la',
  'echo x > .scratch/try.py',
  'cp a.txt foo.py.md',
  'make test 2>&1',
  // Known gaps: each hole is open, so each command is allowed.
  'ruff --fix src',
  'python gen.py',
  'git apply fix.patch',
  'git stash pop',
  'f=foo; echo x > "$f.py"',
]

test('Bash commands that write a locked file are named', () => {
  for (const command of DENIED) {
    expect(namesLockedFile(command, HOME), command).toBe(true)
  }
})

test('tests, git, read-only and free-file commands are not named', () => {
  for (const command of ALLOWED) {
    expect(namesLockedFile(command, HOME), command).toBe(false)
  }
})

// Each gap test passes while the hole is open. When the hole closes it fails.
test('gap: ruff --fix src is not caught', () => {
  expect(namesLockedFile('ruff --fix src', HOME)).toBe(false)
})

test('gap: python gen.py, a script that writes code, is not caught', () => {
  expect(namesLockedFile('python gen.py', HOME)).toBe(false)
})

test('gap: git apply and git stash pop are not caught', () => {
  expect(namesLockedFile('git apply fix.patch', HOME)).toBe(false)
  expect(namesLockedFile('git stash pop', HOME)).toBe(false)
})

test('gap: a shell-built name is not caught', () => {
  expect(namesLockedFile('f=foo; echo x > "$f.py"', HOME)).toBe(false)
})

test('accepted false block: a commit message that names foo.py is denied', () => {
  expect(namesLockedFile('git commit -m "fix foo.py"', HOME)).toBe(true)
})

test('bad input throws, so the hook fails closed', () => {
  expect(() => namesLockedFile(undefined, HOME)).toThrow()
  expect(() => namesLockedFile('', HOME)).toThrow()
  expect(() => namesLockedFile(42, HOME)).toThrow()
})
