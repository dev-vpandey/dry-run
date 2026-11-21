declare module 'claude-code' {
  interface PluginState {
    'dry-run': {
      isOpen: boolean
      isOff: boolean
      isRegistered: boolean
      isWaiting: boolean
      isSkipped: boolean
      isSessionSet: boolean
      cwd: string
      gitRoot: string
    }
  }
}
