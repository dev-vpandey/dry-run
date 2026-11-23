import { expect, test } from 'claude-code/testing'
import { namesLockedFile, namesSwitchFile } from './bash-scan'
import { lockRulesFor } from './lock-rules'

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

// ---- the switch file in a Bash command (ticket 24) ----

const isSwitchWord = (word: string) => word === '/repo/.claude/dry-run.json'

test('a Bash command that names the switch file is caught, runners included', () => {
  expect(namesSwitchFile('echo {} > /repo/.claude/dry-run.json', isSwitchWord)).toBe(true)
  expect(namesSwitchFile('python /repo/.claude/dry-run.json', isSwitchWord)).toBe(true)
  expect(namesSwitchFile('cp a.json "/repo/.claude/dry-run.json"', isSwitchWord)).toBe(true)
  expect(namesSwitchFile('pytest && sed -i x /repo/.claude/dry-run.json', isSwitchWord)).toBe(true)
  expect(namesSwitchFile('echo x > notes.md', isSwitchWord)).toBe(false)
})

test('a switch file scan with no command throws', () => {
  expect(() => namesSwitchFile(undefined, isSwitchWord)).toThrow()
  expect(() => namesSwitchFile('', isSwitchWord)).toThrow()
})

test('gap: cd into the folder, then a bare name, is not caught', () => {
  expect(namesSwitchFile('cd /repo/.claude && echo {} > dry-run.json', isSwitchWord)).toBe(false)
})

test('gap: a symlink to the switch file is not caught', () => {
  expect(namesSwitchFile('echo {} > link.json', isSwitchWord)).toBe(false)
})

test('gap: a glob that expands to the switch file is not caught', () => {
  expect(namesSwitchFile('echo {} > /repo/.claude/dry-*.json', isSwitchWord)).toBe(false)
})

const RULES = lockRulesFor(
  { lock: ['.yaml'], unlock: ['generated/', '.sql'] },
  '/repo',
  '/repo',
)

test('repo rules: an extra locked ending is named, an unlocked one is not', () => {
  expect(namesLockedFile('echo x > /repo/ci.yaml', HOME, RULES)).toBe(true)
  expect(namesLockedFile('echo x > /repo/ci.yaml', HOME)).toBe(false)
  expect(namesLockedFile('sed -i s/a/b/ /repo/db/q.sql', HOME, RULES)).toBe(false)
  expect(namesLockedFile('sed -i s/a/b/ /repo/db/q.sql', HOME)).toBe(true)
  expect(namesLockedFile('echo x > /repo/generated/a.py', HOME, RULES)).toBe(false)
  expect(namesLockedFile('echo x > /repo/src/a.py', HOME, RULES)).toBe(true)
})
