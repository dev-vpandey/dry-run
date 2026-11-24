import { expect, test } from 'claude-code/testing'
import { soundSteps } from './sound'

const DIR = '/System/Library/Sounds/'

test('gate open is a rising two-note chime', () => {
  expect(soundSteps('open')).toEqual([['afplay', `${DIR}Tink.aiff`], ['afplay', `${DIR}Glass.aiff`]])
})

test('coach done is one ping', () => {
  expect(soundSteps('coach')).toEqual([['afplay', `${DIR}Ping.aiff`]])
})

test('a blocked edit is a low two-note thud', () => {
  expect(soundSteps('blocked')).toEqual([['afplay', `${DIR}Funk.aiff`], ['afplay', `${DIR}Basso.aiff`]])
})
