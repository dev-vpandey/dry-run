import { expect, test } from 'claude-code/testing'
import { linesDone, liveSectionOf, SPINNER, spinnerAt, streamedDryRun } from './live-section'

const DRY = '## Dry run\n'

test('no heading yet gives no section', () => {
  expect(liveSectionOf('')).toBe('')
  expect(liveSectionOf('## Dry run\n')).toBe('')
})

test('the last ### heading names the section', () => {
  expect(liveSectionOf('## Dry run\n### 1. Bug and goal\n**Goal:** x')).toBe('Goal')
  expect(liveSectionOf(DRY + '### 1. Bug and goal\nx\n### 3. SOLID\n| a |')).toBe('SOLID')
})

test('a heading is known by its number once the dot has arrived', () => {
  expect(liveSectionOf(DRY + '### 1. Bug and goal\n### 4.')).toBe('Pattern')
})

test('a heading cut before its number is complete keeps the section before it', () => {
  expect(liveSectionOf(DRY + '### 1. Bug and goal\nx\n### ')).toBe('Goal')
  expect(liveSectionOf(DRY + '### 1. Bug and goal\nx\n### 3')).toBe('Goal')
})

test('all eight headings are known', () => {
  const names = ['Goal', 'Change table', 'SOLID', 'Pattern', 'DSA', 'Worked example', 'Open decisions', 'Language explainer']
  for (let number = 1; number <= 8; number++) {
    expect(liveSectionOf(DRY + `### ${number}. x`)).toBe(names[number - 1])
  }
})

test('a ### in the middle of a line is not a heading', () => {
  expect(liveSectionOf(DRY + '### 1. Bug and goal\nuse ### 3. here')).toBe('Goal')
})

test('headings outside a dry run are not sections', () => {
  expect(liveSectionOf('### 3. Setup\nsteps')).toBe('')
  expect(liveSectionOf('Some answer\n### 1. Bug and goal')).toBe('')
})

test('the dry run heading may come after a few lines of text', () => {
  expect(liveSectionOf('Here it is.\n## Dry run\n### 5. DSA')).toBe('DSA')
})

test('an unknown number is not a section', () => {
  expect(liveSectionOf(DRY + '### 9. Extra')).toBe('')
})

test('the spinner goes forward then back', () => {
  expect(SPINNER).toEqual(['·', '✢', '✳', '✶', '✻', '✽', '✽', '✻', '✶', '✳', '✢', '·'])
  expect(spinnerAt(0)).toBe('·')
  expect(spinnerAt(5)).toBe('✽')
  expect(spinnerAt(12)).toBe('·')
})

test('a streamed dry run is kept up to its last whole line', () => {
  expect(streamedDryRun('## Dry run\n### 1. Bug and goal\n**Goal:** sho')).toBe('## Dry run\n### 1. Bug and goal\n')
  expect(streamedDryRun('## Dry run\n### 1. Bug and goal\n')).toBe('## Dry run\n### 1. Bug and goal\n')
})

test('text with no dry run heading, or with the heading not finished, is not kept', () => {
  expect(streamedDryRun('Setup:\n### 3. Setup\nsteps\n')).toBe('')
  expect(streamedDryRun('## Dry run')).toBe('')
  expect(streamedDryRun('')).toBe('')
})

test('the lines finished so far are counted by their line ends', () => {
  expect(linesDone('')).toBe(0)
  expect(linesDone('a\nb')).toBe(1)
  expect(linesDone('a\nb\n')).toBe(2)
})
