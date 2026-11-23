#!/bin/sh
# Same checks as CI (.github/workflows/ci.yml): typecheck, lint, structure. Versions live in package.json.
# Exit 2 makes a Claude Code hook show stderr to Claude. Git treats any non-zero as a block.
if [ ! -d node_modules ] && ! output=$(npm ci --silent 2>&1); then
  echo "npm ci failed:" 1>&2
  echo "$output" 1>&2
  exit 2
fi
if ! output=$(npm run --silent check 2>&1); then
  echo "$output" 1>&2
  exit 2
fi
