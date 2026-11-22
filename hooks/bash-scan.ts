// Pure scan of a Bash command for the gate. No engine calls, so a table test can run it.
//
// It is strict on purpose. It names a locked file anywhere in the text, so
// `git commit -m "fix foo.py"` is a false block we accept. Known gaps, each with a
// `gap:` test: `ruff --fix src`, `python gen.py`, `git apply`, `git stash pop`,
// and names built by the shell (`f=foo; echo x > "$f.py"`).

import { isLocked } from './gate-path'
import type { LockRules } from './gate-path'

// A runner executes a script. A locked name after it means "run", not "write".
// Only a `>` target counts in a part that starts with a runner.
const RUNNERS = new Set(['python', 'python3', 'node', 'bash', 'sh', 'zsh', 'ruby', 'java'])

// Characters that wrap a word but are not part of the file name.
const WRAPPERS = new Set(['"', "'", '`', '(', ')', '{', '}'])

// Puts a line break between parts: `;`, `&&`, `||`, `|` and line breaks.
// `>&` goes first so `2>&1` does not look like a `&` split.
function splitParts(command: string): string[] {
  let text = command.split('>&').join(' ')
  for (const separator of ['&&', '||', '|', ';']) {
    text = text.split(separator).join('\n')
  }
  return text.split('\n')
}

// Splits a part into words. `>` stands alone, so `>foo.py` and `>> foo.py` work.
// `>>` becomes two `>` words. The scan treats both the same.
function splitWords(part: string): string[] {
  const spaced = part.split('>').join(' > ')
  const words: string[] = []
  for (const raw of spaced.split(/\s+/)) {
    const word = stripWrappers(raw)
    if (word !== '') {
      words.push(word)
    }
  }
  return words
}

// Removes quotes and brackets from both ends of a word.
function stripWrappers(word: string): string {
  let start = 0
  let end = word.length
  while (start < end && WRAPPERS.has(word[start])) {
    start++
  }
  while (end > start && WRAPPERS.has(word[end - 1])) {
    end--
  }
  return word.slice(start, end)
}

// True when this word is a locked file. A word built by the shell (`$f.py`)
// is a known gap, so it is not named. A word that is no path, like ".", is not locked.
function isLockedWord(word: string, home: string, rules?: LockRules): boolean {
  if (word.includes('$')) {
    return false
  }
  try {
    return isLocked(word, home, rules)
  } catch {
    return false
  }
}

// True when one part of the command names a locked file in a way that writes.
function partNamesLocked(part: string, home: string, rules?: LockRules): boolean {
  const words = splitWords(part)
  const isRunner = words.length > 0 && RUNNERS.has(words[0])
  for (let i = 0; i < words.length; i++) {
    const isTarget = i > 0 && words[i - 1] === '>'
    if ((isTarget || !isRunner) && isLockedWord(words[i], home, rules)) {
      return true
    }
  }
  return false
}

// The command text. Throws when the call has no command.
function requireCommand(command: unknown): string {
  if (typeof command !== 'string' || command.trim() === '') {
    throw new Error('gate: no command in the Bash call')
  }
  return command
}

// True when the command names a locked file. Throws when there is no command.
// `home` is the user's home folder, "" when unknown. `rules` come from the repo file.
export function namesLockedFile(command: unknown, home: string = '', rules?: LockRules): boolean {
  for (const part of splitParts(requireCommand(command))) {
    if (partNamesLocked(part, home, rules)) {
      return true
    }
  }
  return false
}

// True when any word of the command is the switch file. `isSwitchWord` is the
// path check, so this file needs no git root. A runner gets no pass here: the
// switch file is locked for every kind of command. Throws when there is no command.
export function namesSwitchFile(command: unknown, isSwitchWord: (word: string) => boolean): boolean {
  const text = requireCommand(command)
  for (const part of splitParts(text)) {
    for (const word of splitWords(part)) {
      if (isSwitchWord(word)) {
        return true
      }
    }
  }
  return false
}
