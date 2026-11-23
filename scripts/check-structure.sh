#!/bin/sh
# Layout and naming rules for hooks/. Run from the repo root. Exit 1 on any breach.
#   1. The hooks root holds only main.ts, register.ts, register.test.ts and hooks.json, plus the
#      folders named in scripts/layers.json. That file is also the import rules (eslint.config.mjs).
#   2. A folder is one level deep. Name it for its job.
#   3. A name is lowercase kebab-case, and none of its words is vague.
#   4. A file is .ts, .tsx or .json. A .tsx file sits in design-card/.
#   5. Every source file has a sibling test, except the files named below.
VAGUE=" util utils helper helpers common misc shared manager handler data stuff lib base temp tmp new old "
NO_TEST=" hooks/main.ts hooks/design-card/design-card-colors.ts "
FOLDERS=" $(node -e "console.log(Object.keys(JSON.parse(require('fs').readFileSync('scripts/layers.json', 'utf8'))).join(' '))") "
fail=0
breach() { echo "hooks structure: $1" 1>&2; fail=1; }

top=$(find hooks -mindepth 1 -maxdepth 1)
while IFS= read -r path; do
  [ -n "$path" ] || continue
  name=${path#hooks/}
  case $name in
    main.ts|register.ts|register.test.ts|hooks.json) continue ;;
  esac
  if [ -d "$path" ]; then
    case "$FOLDERS" in
      *" $name "*) ;;
      *) breach "$path: folder is not in scripts/layers.json. Name it for its job, then add it there." ;;
    esac
  else
    breach "$path: move it into a folder named for its job:$FOLDERS"
  fi
done <<EOT
$top
EOT

nested=$(find hooks -mindepth 2 -type d)
while IFS= read -r path; do
  [ -n "$path" ] || continue
  breach "$path: a folder under hooks/ has no sub-folders"
done <<EOT
$nested
EOT

all=$(find hooks -mindepth 1)
while IFS= read -r path; do
  [ -n "$path" ] || continue
  base=${path##*/}
  case $base in
    # The letters are spelled out: in some locales a range like a-z also matches capitals.
    *[!abcdefghijklmnopqrstuvwxyz0123456789.-]*) breach "$path: use lowercase kebab-case" ;;
  esac
  for word in $(echo "$base" | tr '.-' '  '); do
    case "$VAGUE" in *" $word "*) breach "$path: '$word' says nothing about the job. Name it for what it does." ;; esac
  done
  if [ -f "$path" ]; then
    case $base in
      *.ts|*.json) ;;
      *.tsx) case $path in hooks/design-card/*) ;; *) breach "$path: .tsx is for the Design Card view only" ;; esac ;;
      *) breach "$path: a file here is .ts, .tsx or .json" ;;
    esac
  fi
done <<EOT
$all
EOT

sources=$(find hooks \( -name '*.ts' -o -name '*.tsx' \) -type f)
while IFS= read -r path; do
  [ -n "$path" ] || continue
  case $path in *.test.ts|*.test.tsx|*.d.ts) continue ;; esac
  case "$NO_TEST" in *" $path "*) continue ;; esac
  test_path="${path%.*}.test.${path##*.}"
  [ -f "$test_path" ] || breach "$path: no sibling test $test_path"
done <<EOT
$sources
EOT

exit $fail
