import { expect, test } from 'claude-code/testing'
import { captionOf, faultNote, faultToast, frameAt, framesOf, moodOf, MOODS, moodOfSection, TICK_MS } from './clawd-frames'
import type { Frame, Mood } from './clawd-frames'
import { SECTION_NAMES } from './design-card'

const LEFT = 3
const CLAWD = 9
const RIGHT = 12

function rowText(row: Frame[number]): string {
  return row.map(seg => seg.text).join('')
}

function allFrames(): { mood: Mood; frame: Frame }[] {
  const all: { mood: Mood; frame: Frame }[] = []
  for (const mood of MOODS) {
    for (const frame of framesOf(mood, 2)) {
      all.push({ mood, frame })
    }
  }
  return all
}

test('the tick is 150 ms', () => {
  expect(TICK_MS).toBe(150)
})

test('every frame has 4 rows, each at most 3 + 9 + 12 columns wide', () => {
  for (const { mood, frame } of allFrames()) {
    expect(frame.length, mood).toBe(4)
    for (const row of frame) {
      expect(rowText(row).length, `${mood}: "${rowText(row)}"`).toBeLessThanOrEqual(LEFT + CLAWD + RIGHT)
    }
  }
})

test('the body of every frame is at the same columns: rows 1-3 are at least 3 + 9 wide', () => {
  for (const { mood, frame } of allFrames()) {
    for (const row of frame.slice(1)) {
      expect(rowText(row).length, `${mood}: "${rowText(row)}"`).toBeGreaterThanOrEqual(LEFT + CLAWD)
    }
  }
})

test('the art is single-width: no emoji and no wide characters', () => {
  for (const { mood, frame } of allFrames()) {
    for (const row of frame) {
      for (const char of rowText(row)) {
        const code = char.codePointAt(0) ?? 0
        expect(code < 0x1100 || (code >= 0x2190 && code < 0x2E80), `${mood}: U+${code.toString(16)}`).toBe(true)
      }
    }
  }
})

test('every mood has at least one frame', () => {
  for (const mood of MOODS) {
    expect(framesOf(mood, 0).length, mood).toBeGreaterThan(0)
  }
})

test('the 10 states of the spec table have their captions', () => {
  expect(captionOf('goal')).toBe('Setting the goal')
  expect(captionOf('solid')).toBe('Lifting SOLID')
  expect(captionOf('pattern')).toBe('Picking a pattern')
  expect(captionOf('dsa')).toBe('Writing the algorithm')
  expect(captionOf('reviewing')).toBe('Architect review')
  expect(captionOf('done')).toBe('Review done')
  expect(captionOf('down')).toBe('Coach is down')
  expect(captionOf('skipped')).toBe('Coach skipped')
  expect(captionOf('locked')).toBe('Gate locked · napping')
  expect(captionOf('open')).toBe('Gate open · edits on')
})

test('the other four sections have a costume and a caption too', () => {
  expect(captionOf('table')).toBe('Listing the changes')
  expect(captionOf('example')).toBe('Working an example')
  expect(captionOf('decisions')).toBe('Weighing the options')
  expect(captionOf('lang')).toBe('Translating to Java')
})

test('soft mode keeps its caption', () => {
  expect(captionOf('soft')).toBe('Soft mode · no gate')
})

test('every section name has a mood', () => {
  const moods = SECTION_NAMES.map(name => moodOfSection(name))
  expect(moods).toEqual(['goal', 'table', 'solid', 'pattern', 'dsa', 'example', 'decisions', 'lang'])
})

test('a section being written wins over the coach and the gate', () => {
  expect(moodOf({ live: 'SOLID', coach: 'reviewing', gate: 'open' })).toBe('solid')
  expect(moodOf({ live: 'Goal', coach: 'idle', gate: 'locked' })).toBe('goal')
})

test('with no live section, a coach at work wins over the gate', () => {
  expect(moodOf({ live: '', coach: 'reviewing', gate: 'open' })).toBe('reviewing')
  expect(moodOf({ live: '', coach: 'reviewing', gate: 'locked' })).toBe('reviewing')
})

test('a finished coach shows while the gate is locked, and the open gate takes over', () => {
  expect(moodOf({ live: '', coach: 'done', gate: 'locked' })).toBe('done')
  expect(moodOf({ live: '', coach: 'down', gate: 'locked' })).toBe('down')
  expect(moodOf({ live: '', coach: 'skipped', gate: 'locked' })).toBe('skipped')
  expect(moodOf({ live: '', coach: 'done', gate: 'open' })).toBe('open')
})

test('with nothing else, the gate sets the mood', () => {
  expect(moodOf({ live: '', coach: 'idle', gate: 'locked' })).toBe('locked')
  expect(moodOf({ live: '', coach: 'idle', gate: 'open' })).toBe('open')
  expect(moodOf({ live: '', coach: 'idle', gate: 'soft' })).toBe('soft')
})

test('the SOLID costume lifts the letters one at a time', () => {
  const frames = framesOf('solid', 0).map(frame => rowText(frame[0] ?? []).trim())
  expect(frames).toContain('S')
  expect(frames).toContain('S O')
  expect(frames).toContain('S O L I D')
})

test('the DSA costume types set.add(k) and ends on O(n) ✓', () => {
  const frames = framesOf('dsa', 0)
  const text = frames.map(frame => frame.map(rowText).join('\n'))
  expect(text.some(item => item.includes('set.add(k)'))).toBe(true)
  expect(text[text.length - 1]).toContain('O(n) ✓')
})

test('the finished coach holds up the flag count', () => {
  const text = (flags: number) => framesOf('done', flags).map(frame => frame.map(rowText).join('\n')).join('\n')
  expect(text(2)).toContain('⚑ 2 flags')
  expect(text(1)).toContain('⚑ 1 flag')
  expect(text(0)).toContain('⚑ 0 flags')
})

test('the locked costume sleeps by a red ⊘ and the open one shows ✓', () => {
  const locked = framesOf('locked', 0).map(frame => frame.map(rowText).join('\n')).join('\n')
  expect(locked).toContain('⊘')
  expect(locked).toContain('z')
  const open = framesOf('open', 0).map(frame => frame.map(rowText).join('\n')).join('\n')
  expect(open).toContain('✓')
})

test('frameAt loops over the frames of the costume', () => {
  const frames = framesOf('goal', 0)
  expect(frameAt('goal', 0, 0)).toEqual(frames[0])
  expect(frameAt('goal', frames.length, 0)).toEqual(frames[0])
  expect(frameAt('goal', frames.length + 1, 0)).toEqual(frames[1])
})

test('a failed Client is told in one line with its phase and reason', () => {
  expect(faultToast('load', 'module not found')).toBe('✗ Clawd animation failed (load): module not found')
})

test('the stored fault keeps the phase and the reason', () => {
  expect(faultNote('run', 'RangeError')).toBe('run: RangeError')
})

function segsOf(mood: Mood) {
  return framesOf(mood, 2).flatMap(frame => frame.flat())
}

test('the props of the costumes are the light peach, as the prototype draws them', () => {
  for (const [mood, glyph] of [['goal', '◎'], ['solid', '✦'], ['solid', '✧'], ['dsa', '▌']] as const) {
    const found = segsOf(mood).filter(piece => piece.text === glyph)
    expect(found.length, `${mood} ${glyph}`).toBeGreaterThan(0)
    for (const piece of found) {
      expect(piece.hue, `${mood} ${glyph}`).toBe('claudeHi')
    }
  }
})

test('the open costume draws its sparkles in the light peach', () => {
  const sparkles = segsOf('open').filter(piece => '✢✳✶✻✽'.includes(piece.text.trim()) && piece.text.trim() !== '')
  expect(sparkles.length).toBeGreaterThan(0)
  for (const piece of sparkles) {
    expect(piece.hue).toBe('claudeHi')
  }
})

test('the SOLID letters are plain text color and bold', () => {
  const letters = segsOf('solid').filter(piece => piece.text.includes('S'))
  expect(letters.length).toBeGreaterThan(0)
  for (const piece of letters) {
    expect(piece.hue).toBe('fg')
    expect(piece.bold).toBe(true)
  }
})

test('Clawd himself is the Claude color and not bold', () => {
  const bodies = framesOf('goal', 0).flatMap(frame => (frame[2] ?? []).slice(1, 2))
  for (const piece of bodies) {
    expect(piece.hue).toBe('claude')
    expect(piece.bold).toBeUndefined()
  }
})

test('the language costume looks right, left, right while it types', () => {
  const eyes = framesOf('lang', 0).map(frame => rowText(frame[1] ?? []).slice(LEFT, LEFT + CLAWD))
  const typing = [eyes[0], eyes[2], eyes[4]]
  expect(typing).toEqual([' ▐▛███▛▌ ', ' ▐▜███▜▌ ', ' ▐▛███▛▌ '])
})
