#!/bin/sh
# The mod must not hook prompt.compose or skill.prompt: one code path for every login
# (SPEC section 4). The test sandbox cannot read files, so this runs in CI instead.
# Run from the repo root. Exit 1 when a hook source names either event.
if grep -rn --include='*.ts' --include='*.tsx' --include='*.json' -E 'prompt\.compose|skill\.prompt' hooks; then
  echo "hooks must not use prompt.compose or skill.prompt" 1>&2
  exit 1
fi
