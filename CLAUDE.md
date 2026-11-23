# dry-run

- Layout: `hooks/main.ts` and `hooks/register.ts` wire the engine. Each folder under `hooks/` is one job: `edit-lock/`, `repo-config/`, `design-card/`, `compat/`. The rules are in `eslint.config.mjs` and `scripts/check-structure.sh`. Run `npm run check`.
- Tickets and the prototype: `.scratch/blueprint-mod/`. It is gitignored. Read it by exact path.
