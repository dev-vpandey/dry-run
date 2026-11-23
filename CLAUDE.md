# dry-run

- Layout: `hooks/main.ts` and `hooks/register.ts` wire the engine. Each folder under `hooks/` is one job. The folders and what each may import are in `scripts/layers.json`. The rules are in `eslint.config.mjs` and `scripts/check-structure.sh`. Run `npm run check`.
- Tickets and the prototype: `.scratch/blueprint-mod/`. It is gitignored. Read it by exact path.
