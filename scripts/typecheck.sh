#!/bin/sh
# Same checks as CI (.github/workflows/ci.yml): typecheck, lint, structure. Versions live in package.json.
# Exit 2 makes a Claude Code hook show stderr to Claude. Git treats any non-zero as a block.
[ -d node_modules ] || npm ci --silent > /dev/null 2>&1
if ! output=$(npm run --silent check 2>&1); then
  echo "$output" 1>&2
  exit 2
fi
