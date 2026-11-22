#!/bin/sh
# Same typecheck as CI (.github/workflows/ci.yml). Keep the version in step with it.
# Exit 2 makes a Claude Code hook show stderr to Claude. Git treats any non-zero as a block.
if ! output=$(npx --yes -p typescript@5.6.3 tsc --noEmit -p . 2>&1); then
  echo "$output" 1>&2
  exit 2
fi
