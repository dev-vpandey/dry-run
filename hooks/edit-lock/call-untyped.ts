// Calls `fn` with arguments of any type. A test feeds a function a wrong-typed value with it,
// so the test needs no `as` cast.
export function callUntyped(fn: (...args: never[]) => unknown, ...args: unknown[]): unknown {
  return Reflect.apply(fn, undefined, args)
}
