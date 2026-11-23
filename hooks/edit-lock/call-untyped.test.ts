import { expect, test } from 'claude-code/testing'
import { callUntyped } from './call-untyped'

test('passes the arguments through and returns the result', () => {
  expect(callUntyped((a: number, b: number) => a + b, 1, 2)).toBe(3)
})

test('lets a wrong-typed argument reach the function', () => {
  expect(callUntyped((text: string) => typeof text, 42)).toBe('number')
})

test('an error from the function is not swallowed', () => {
  const fails = () => {
    throw new Error('boom')
  }
  expect(() => callUntyped(fails)).toThrow('boom')
})
