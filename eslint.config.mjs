// Deterministic code rules. tsc cannot check these. Layout rules live in scripts/check-structure.sh.
// Both read scripts/layers.json: each key is a folder under hooks/, each value the folders it may not import.
//   1. No `as` casts. Narrow a value with a type guard or a Map lookup.
//   2. Only main.ts, register.ts and the Design Card view may import the engine.
//   3. A folder may not import a folder on its list, or register.ts.
//   4. A file has at most 400 lines.
// Tests follow the same rules as their source.
import { readFileSync } from 'node:fs'
import tseslint from 'typescript-eslint'

const LAYERS = JSON.parse(readFileSync(new URL('./scripts/layers.json', import.meta.url), 'utf8'))

const ENGINE = { name: 'claude-code', message: 'Pure logic stays free of the engine. Only main.ts, register.ts and the Design Card view import it.' }
const REGISTER = { group: ['**/register'], message: 'Wiring sits above every folder. Pass what you need in as an argument.' }

const VIEW = 'hooks/design-card/design-card-view.tsx'
const VIEW_TEST = 'hooks/design-card/design-card-view.test.tsx'

function bannedFolders(folder, banned) {
  return banned.map(other => ({ group: [`**/${other}`, `**/${other}/*`], message: `${folder}/ must not import ${other}/.` }))
}

function layerBlock(folder, banned) {
  return {
    files: [`hooks/${folder}/**/*.ts`, `hooks/${folder}/**/*.tsx`],
    ignores: [VIEW, VIEW_TEST],
    rules: {
      'no-restricted-imports': ['error', { paths: [ENGINE], patterns: [REGISTER, ...bannedFolders(folder, banned)] }],
    },
  }
}

export default [
  {
    files: ['hooks/**/*.ts', 'hooks/**/*.tsx'],
    languageOptions: { parser: tseslint.parser },
    plugins: { '@typescript-eslint': tseslint.plugin },
    rules: {
      '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }],
      'max-lines': ['error', { max: 400, skipBlankLines: true, skipComments: true }],
    },
  },
  // Known debt, ticket 39: the wiring file and its test are over the cap.
  { files: ['hooks/register.ts', 'hooks/register.test.ts'], rules: { 'max-lines': 'off' } },
  ...Object.entries(LAYERS).map(([folder, banned]) => layerBlock(folder, banned)),
  // Known debt, ticket 40: the view imports openGate and lockGate from register.ts.
  // It keeps the folder rules and may import the engine and register.
  {
    files: [VIEW, VIEW_TEST],
    rules: { 'no-restricted-imports': ['error', { patterns: bannedFolders('design-card', LAYERS['design-card']) }] },
  },
]
