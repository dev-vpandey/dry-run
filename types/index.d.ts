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
      isSoft: boolean
      isTooOld: boolean
      // The parsed repo file and its platform block, as JSON text ("" when none).
      repoFile: string
      platform: string
      // The gate-down toast was shown this session.
      isGateToastShown: boolean
      // The problem toasts last shown, so a second /clear signal does not repeat them.
      lastProblems: string
      // The index went into this thread.
      isIndexSent: boolean
      // The engine refused the rules tool, so the rule text rides on each prompt.
      isToolBlocked: boolean
      // The main thread posted a dry run this session or since the last clear.
      isDryRunSeen: boolean
      // The text of the newest dry run, for the Design Card. "" when none.
      dryRunText: string
    }
  }
}
