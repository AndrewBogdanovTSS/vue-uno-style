import vUnoStyle from 'vue-uno-style/eslint'
import babelParser from '@babel/eslint-parser'
import vueParser from 'vue-eslint-parser'
import { properties } from './vue-uno-style.config.js'

export default [
  { ignores: ['.nuxt/**', '.output/**', 'node_modules/**'] },
  ...vUnoStyle.configs.recommended,
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        // `<script setup lang="ts">` blocks: Babel parses TypeScript syntax without type checking
        parser: babelParser,
        requireConfigFile: false,
        babelOptions: { plugins: ['@babel/plugin-syntax-typescript'] },
        ecmaVersion: 2022,
        sourceType: 'module',
      },
    },
    rules: {
      'vue-uno-style/no-multiple-v-style': ['error', { properties }],
    },
  },
]
