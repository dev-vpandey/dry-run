import { expect, test } from 'claude-code/testing'
import { isOlderThan } from './version'

const OLDER: [string, string][] = [
  ['2.1.303', '2.1.304'],
  ['2.1.200', '2.1.304'],
  ['2.0.999', '2.1.304'],
  ['1.9.9999', '2.1.304'],
  ['2.1', '2.1.304'],
  ['2.1.303-dev.20260920.t101500.sha1a2b3c4', '2.1.304'],
]

const NOT_OLDER: [string, string][] = [
  ['2.1.304', '2.1.304'],
  ['2.1.305', '2.1.304'],
  ['2.1.1000', '2.1.304'],
  ['2.2.0', '2.1.304'],
  ['3.0.0', '2.1.304'],
  ['2.1.304-dev.20260920.t101500.sha1a2b3c4', '2.1.304'],
]

test('a version below the floor is older', async () => {
  for (const [version, floor] of OLDER) {
    expect(isOlderThan(version, floor), version).toBe(true)
  }
})

test('the floor and anything above it is not older', async () => {
  for (const [version, floor] of NOT_OLDER) {
    expect(isOlderThan(version, floor), version).toBe(false)
  }
})
