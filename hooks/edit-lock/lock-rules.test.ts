import { expect, test } from 'claude-code/testing'
import { lockRulesFor } from './lock-rules'

const FILE = { lock: ['.yaml'], unlock: ['generated/'] }

test('the lock and unlock lists pass through', () => {
  const rules = lockRulesFor(FILE, '/repo', '/repo')
  expect(rules.lock).toEqual(['.yaml'])
  expect(rules.unlock).toEqual(['generated/'])
})

test('a path inside the git root gives its names counted from the root', () => {
  const rules = lockRulesFor(FILE, '/repo/src', '/repo')
  expect(rules.relativeNames('/repo/db/Q.sql')).toEqual(['db', 'q.sql'])
  expect(rules.relativeNames('a/b.py')).toEqual(['src', 'a', 'b.py'])
})

test('a path outside the git root has no names', () => {
  expect(lockRulesFor(FILE, '/repo', '/repo').relativeNames('/other/a.py')).toBe(null)
})

test('with no git root every path has no names', () => {
  expect(lockRulesFor(FILE, '/repo', '').relativeNames('/repo/a.py')).toBe(null)
})
