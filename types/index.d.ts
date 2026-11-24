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
      // The Design Card boxes the person folded: their names, joined with commas.
      foldedBoxes: string
      // The section Claude is writing now, from the streamed text. "" when none.
      liveSection: string
      liveText: string
      // The Design Coach: idle, reviewing, done, down or skipped. Ticket 29 writes it.
      coachState: string
      // The coach's flag count, for the finished costume.
      coachFlags: number
      // The sound setting is on and the platform is macOS.
      isSoundOn: boolean
      // A Client of the Design Card failed: its phase and reason. "" when none. Cleared at session start.
      clientFault: string
      // The layout the person chose with /dry-run layout: card, rail or buddy. "" means the setting decides.
      layoutName: string
      // The last few gate changes, newest last, joined with ">". Shown when a go word is dropped.
      gateTrace: string
    }
  }
}
