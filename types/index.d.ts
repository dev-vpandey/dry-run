export type Flag = boolean

declare module 'claude-code' {
  interface PluginState {
    'dry-run': { isOpen: Flag; isOff: Flag }
  }
}
