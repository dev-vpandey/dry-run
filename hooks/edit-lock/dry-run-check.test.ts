import { expect, test } from 'claude-code/testing'
import { isDryRun } from './dry-run-check'

const HEADINGS = [
  '## Dry run',
  '### 1. Bug and goal',
  '### 2. Change table',
  '### 3. SOLID',
  '### 4. Pattern',
  '### 5. DSA',
  '### 6. Worked example',
  '### 7. Open decisions',
]

// Builds a message from headings. `tableRows` go under the change table heading.
function message(headings: string[], tableRows: string[] = ['| `src/Foo.java` | edit | why |']): string {
  const lines: string[] = []
  for (const heading of headings) {
    lines.push(heading, 'text')
    if (heading === '### 2. Change table') {
      lines.push(...tableRows)
    }
  }
  return lines.join('\n')
}

function without(heading: string): string[] {
  return HEADINGS.filter(h => h !== heading)
}

const SECTION_8 = '### 8. Language explainer'

test('all required headings make a dry run', async () => {
  expect(isDryRun(message(HEADINGS))).toBe(true)
})

test('a message missing any one required heading is not a dry run', async () => {
  for (const heading of HEADINGS) {
    expect(isDryRun(message(without(heading))), heading).toBe(false)
  }
})

test('a heading must match exactly', async () => {
  const wrong = message(HEADINGS).replace('### 3. SOLID', '### 3. Solid')
  expect(isDryRun(wrong)).toBe(false)
  const indented = message(HEADINGS).replace('### 5. DSA', '  ### 5. DSA')
  expect(isDryRun(indented)).toBe(false)
})

test('a heading inside a longer line does not count', async () => {
  const inline = message(without('### 4. Pattern')) + '\nsee ### 4. Pattern above'
  expect(isDryRun(inline)).toBe(false)
})

test('Windows line ends still match', async () => {
  expect(isDryRun(message(HEADINGS).replaceAll('\n', '\r\n'))).toBe(true)
})

test('no explainLanguage: section 8 is never required', async () => {
  expect(isDryRun(message(HEADINGS, ['| `a.py` | x | y |']), '')).toBe(true)
})

test('section 8 is required when a changed file is in another language', async () => {
  const table = ['| `src/job.py` | edit | why |']
  expect(isDryRun(message(HEADINGS, table), 'java')).toBe(false)
  expect(isDryRun(message([...HEADINGS, SECTION_8], table), 'java')).toBe(true)
})

test('section 8 is not required when every changed file is in the reader language', async () => {
  const table = ['| `src/Foo.java` | edit | why |', '| `src/FooTest.java` | edit | why |']
  expect(isDryRun(message(HEADINGS, table), 'java')).toBe(true)
})

test('free files do not need section 8', async () => {
  const table = ['| `README.md` | edit | why |', '| `config.yaml` | edit | why |']
  expect(isDryRun(message(HEADINGS, table), 'java')).toBe(true)
})

test('one other-language file among Java files needs section 8', async () => {
  const table = ['| `src/Foo.java` | edit | why |', '| `scripts/run.sh` | edit | why |']
  expect(isDryRun(message(HEADINGS, table), 'java')).toBe(false)
})

test('the explainLanguage match ignores case, and the path ending too', async () => {
  const table = ['| `src/Foo.JAVA` | edit | why |']
  expect(isDryRun(message(HEADINGS, table), ' Java ')).toBe(true)
})

test('a box table change table is read too', async () => {
  const table = ['║ `src/job.py`  ║ edit ║ why ║']
  expect(isDryRun(message(HEADINGS, table), 'java')).toBe(false)
})

test('only the first column counts for the language', async () => {
  const table = ['| `src/Foo.java` | rename from job.py | why |']
  expect(isDryRun(message(HEADINGS, table), 'java')).toBe(true)
})

test('text that is not a message is not a dry run', async () => {
  for (const input of [undefined, null, 42, {}, '']) {
    expect(Reflect.apply(isDryRun, undefined, [input]), String(input)).toBe(false)
  }
})

test('a dry run quoted inside a code fence is not a dry run', async () => {
  const quoted = '```\n' + message(HEADINGS) + '\n```'
  expect(isDryRun(quoted)).toBe(false)
})

test('a fenced block inside a real dry run does not hide its headings', async () => {
  const withCode = message(HEADINGS) + '\n```java\nclass A {}\n```'
  expect(isDryRun(withCode)).toBe(true)
})

test('a "#" line inside the change table does not end the table', async () => {
  const table = ['# a note', '| `src/job.py` | edit | why |']
  expect(isDryRun(message(HEADINGS, table), 'java')).toBe(false)
})

test('a path with a line number or end punctuation still has its language', async () => {
  for (const cell of ['src/job.py:12', 'src/job.py.', '`src/job.py`,', '(src/job.py)']) {
    const table = [`| ${cell} | edit | why |`]
    expect(isDryRun(message(HEADINGS, table), 'java'), cell).toBe(false)
  }
})
