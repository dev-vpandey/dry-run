// Deterministic code rules. tsc cannot check these. Layout rules live in scripts/check-structure.sh.
//   1. No `as` casts.
//   2. Only main.ts, register.ts and the Design Card view may import the engine.
//   3. A folder may import only the folders listed in LAYERS below.
//   4. A source file has at most 400 lines.
import tseslint from 'typescript-eslint'

const ENGINE = { name: 'claude-code', message: 'Pure logic stays free of the engine. Only main.ts, register.ts and the Design Card view import it.' }

const SOURCE = ['hooks/**/*.ts', 'hooks/**/*.tsx']
const TESTS = ['hooks/**/*.test.ts', 'hooks/**/*.test.tsx']

// A folder may not import these. Add a folder here when you add one under hooks/.
const LAYERS = {
  'edit-lock': ['repo-config', 'design-card', 'compat'],
  'repo-config': ['design-card', 'compat'],
  'design-card': ['compat'],
  compat: ['edit-lock', 'repo-config', 'design-card'],
}

function layerBlock(folder, banned) {
  return {
    files: [`hooks/${folder}/**/*.ts`, `hooks/${folder}/**/*.tsx`],
    ignores: TESTS,
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [ENGINE],
          patterns: [
            { group: ['**/register'], message: 'Wiring sits above every folder. Pass what you need in as an argument.' },
            ...banned.map(other => ({ group: [`**/${other}/*`], message: `${folder}/ must not import ${other}/.` })),
          ],
        },
      ],
    },
  }
}

export default [
  {
    files: SOURCE,
    languageOptions: { parser: tseslint.parser },
    plugins: { '@typescript-eslint': tseslint.plugin },
    rules: {
      '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }],
    },
  },
  {
    files: SOURCE,
    ignores: TESTS,
    rules: { 'max-lines': ['error', { max: 400, skipBlankLines: true, skipComments: true }] },
  },
  // Known debt, ticket to split it: the wiring file is over the cap.
  { files: ['hooks/register.ts'], rules: { 'max-lines': 'off' } },
  ...Object.entries(LAYERS).map(([folder, banned]) => layerBlock(folder, banned)),
  // Known debt, ticket to move openGate and lockGate out of register.ts: the view calls them.
  {
    files: ['hooks/design-card/design-card-view.tsx'],
    rules: { 'no-restricted-imports': 'off' },
  },
]
