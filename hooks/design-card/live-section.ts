// The section Claude is writing, read from the text streamed so far, and the spinner shown
// in its pill. Pure. Rules: SPEC section 6 (live section, spinner).

import { SECTION_NAMES } from './design-card'
import type { SectionName } from './design-card'

// Claude Code's spinner, forward then back.
export const SPINNER: readonly string[] = ['·', '✢', '✳', '✶', '✻', '✽', '✽', '✻', '✶', '✳', '✢', '·']

export function spinnerAt(tick: number): string {
  return SPINNER[tick % SPINNER.length] ?? '·'
}

const HEADING = '### '

// The section of a line like "### 3. SOLID", by its number, or '' when the number is missing,
// not finished ("### 3" has no dot yet) or not one of the sections.
function sectionOfLine(line: string): SectionName | '' {
  if (!line.startsWith(HEADING)) {
    return ''
  }
  const word = line.slice(HEADING.length).split('.')
  if (word.length < 2) {
    return ''
  }
  const number = Number(word[0])
  return Number.isInteger(number) ? (SECTION_NAMES[number - 1] ?? '') : ''
}

const DRY_RUN_HEADING = '## Dry run'

// The section of the last known heading in the text, once a "## Dry run" line has come: an
// ordinary answer with a "### 3." heading is not a dry run. A heading still being written,
// with no number yet, leaves the section before it.
export function liveSectionOf(text: string): SectionName | '' {
  const lines = text.split('\n')
  if (!lines.includes(DRY_RUN_HEADING)) {
    return ''
  }
  for (let index = lines.length - 1; index >= 0; index--) {
    const section = sectionOfLine(lines[index] ?? '')
    if (section !== '') {
      return section
    }
  }
  return ''
}
