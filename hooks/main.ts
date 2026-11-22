import type { Register } from 'claude-code'
import { register as registerCard } from './design-card-view'
import { register as registerGate } from './register'

// The engine loads one hooks module per plugin. This one joins the gate and the Design Card.
export const register: Register = (on, options) => {
  registerGate(on, options)
  registerCard(on, options)
}
