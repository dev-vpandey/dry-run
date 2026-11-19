// Pure check: is a user message a go word? No engine calls here.

export type GoKind = 'go' | 'just-do-it' | 'none'

const JUST_DO_IT = 'just do it'

// The go words. Match the whole message only, after cleanup.
const GO_WORDS = new Set([
  'go',
  'go ahead',
  JUST_DO_IT,
  'do it',
  'approved',
  'lgtm',
  'ship it',
  'yes go',
  'yes, go ahead',
])

// No "?": a question is not an approval.
const END_PUNCTUATION = '.!'

function isSpace(char: string): boolean {
  return char === ' ' || char === '\t' || char === '\n' || char === '\r'
}

// Lower case, one space between words, no end punctuation, no edge spaces.
function clean(text: string): string {
  const words: string[] = []
  let word = ''
  for (const char of text.toLowerCase()) {
    if (isSpace(char)) {
      if (word !== '') {
        words.push(word)
        word = ''
      }
    } else {
      word += char
    }
  }
  if (word !== '') {
    words.push(word)
  }
  const joined = words.join(' ')
  // Cut end punctuation and the spaces around it: "go !" becomes "go".
  let end = joined.length
  while (end > 0 && isEndMark(joined.charAt(end - 1))) {
    end--
  }
  return joined.slice(0, end)
}

function isEndMark(char: string): boolean {
  return char === ' ' || END_PUNCTUATION.includes(char)
}

// 'just-do-it' is the one go word that works with no dry run waiting.
export function goWordKind(text: unknown): GoKind {
  if (typeof text !== 'string') {
    return 'none'
  }
  const cleaned = clean(text)
  if (cleaned === JUST_DO_IT) {
    return 'just-do-it'
  }
  return GO_WORDS.has(cleaned) ? 'go' : 'none'
}
