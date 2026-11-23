import { expect, test } from 'claude-code/testing'
import { goWordKind } from './go-word'

const GO_IN = [
  'go',
  'Go!',
  'go !',
  '  GO AHEAD.  ',
  'go   ahead',
  'go\tahead',
  'do it',
  'approved',
  'APPROVED!!',
  'lgtm',
  'LGTM.',
  'ship it',
  'yes go',
  'yes, go ahead',
  'Yes, go ahead!',
]

const JUST_DO_IT_IN = ['just do it', 'Just do it!', '  JUST   DO IT. ']

const NOT_GO = [
  'go ahead and fix tests too',
  "don't go ahead",
  'no go',
  'going',
  'go go',
  'yes',
  'ok',
  '',
  '   ',
  'go ahead\nand fix it',
  'please go ahead',
  'go?',
  'go ahead?',
  'just do it?',
]

const BAD_INPUT = [undefined, null, 42, {}]

test('go words unlock: any case, end punctuation, extra spaces', async () => {
  for (const text of GO_IN) {
    expect(goWordKind(text), text).toBe('go')
  }
})

test('just do it is its own kind', async () => {
  for (const text of JUST_DO_IT_IN) {
    expect(goWordKind(text), text).toBe('just-do-it')
  }
})

test('a longer message, or a near miss, is not a go word', async () => {
  for (const text of NOT_GO) {
    expect(goWordKind(text), text).toBe('none')
  }
})

test('a message that is not text is not a go word', async () => {
  for (const input of BAD_INPUT) {
    expect(goWordKind(input), String(input)).toBe('none')
  }
})
