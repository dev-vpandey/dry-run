#!/bin/sh
# Layout and naming rules for hooks/. Run from the repo root. Exit 1 on any breach.
#   1. The hooks root holds only main.ts, register.ts, register.test.ts and hooks.json.
#   2. Every folder under hooks/ is named for a job and is on the list below.
#   3. No file or folder is named with a vague word.
#   4. .tsx files sit in design-card/.
#   5. Every source file has a sibling test, except the files named below.
FOLDERS="edit-lock repo-config design-card compat"
VAGUE="util utils helper helpers common misc shared manager handler data stuff lib base temp tmp new old"
NO_TEST="main.ts design-card-colors.ts"
fail=0
breach() { echo "hooks structure: $1" 1>&2; fail=1; }

for path in hooks/*; do
  name=${path#hooks/}
  case $name in
    main.ts|register.ts|register.test.ts|hooks.json) ;;
    *) if [ -d "$path" ]; then
         case " $FOLDERS " in
           *" $name "*) ;;
           *) breach "$path: folder not on the list in scripts/check-structure.sh. Name it for its job, then add it." ;;
         esac
       else
         breach "$path: move it into a folder named for its job ($FOLDERS)"
       fi ;;
  esac
done

for path in $(find hooks -mindepth 1); do
  base=${path##*/}
  for word in $(echo "${base%%.*}" | tr '-' ' '); do
    case " $VAGUE " in *" $word "*) breach "$path: '$word' says nothing about the job. Name it for what it does." ;; esac
  done
done

for path in $(find hooks -name '*.tsx'); do
  case $path in hooks/design-card/*) ;; *) breach "$path: .tsx is for the Design Card view only" ;; esac
done

for path in $(find hooks -name '*.ts' -o -name '*.tsx' | grep -v '\.test\.'); do
  base=${path##*/}
  case " $NO_TEST " in *" $base "*) continue ;; esac
  test_path="${path%.*}.test.${path##*.}"
  [ -f "$test_path" ] || breach "$path: no sibling test $test_path"
done

exit $fail
