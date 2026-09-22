import babelParser from '@babel/eslint-parser'
import js from '@eslint/js'
import vueParser from 'vue-eslint-parser'
import plugin from './src/eslint.ts'

const typescriptParserOptions = {
  requireConfigFile: false,
  babelOptions: {
    plugins: ['@babel/plugin-syntax-typescript'],
  },
}

export default [
  {
    ignores: ['dist/**', 'node_modules/**'],
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
  },
  js.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: babelParser,
      parserOptions: typescriptParserOptions,
    },
    // Babel parses TypeScript syntactically, with no type information, so both
    // of these rules fire on code that is correct: `no-undef` on every
    // type-only reference, `no-unused-vars` on type imports. They are off
    // because `tsc` already answers both questions with types in hand -
    // TS2304 for an undefined name, and `noUnusedLocals` / `noUnusedParameters`
    // for dead bindings. `pnpm typecheck` is the gate for those, not this file.
    //
    // The type-aware alternative is `typescript-eslint`, which is not an option
    // here: 8.70.1 declares `typescript: >=4.8.4 <6.1.0`, and this package is on
    // TypeScript 7. Revisit when it supports 7.
    rules: {
      'no-undef': 'off',
      'no-unused-vars': 'off',
    },
  },
  ...plugin.configs.recommended,
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        ...typescriptParserOptions,
        parser: babelParser,
      },
    },
  },
]
