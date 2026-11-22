import vUnoStyle from 'vue-uno-style/eslint'
import babelParser from '@babel/eslint-parser'
import vueParser from 'vue-eslint-parser'
import { properties } from './config/vue-uno-style.ts'

const typescriptParserOptions = {
  // Babel parses TypeScript syntax without type checking
  requireConfigFile: false,
  babelOptions: { plugins: ['@babel/plugin-syntax-typescript'] }
}

export default [
  { ignores: ['.nuxt/**', '.output/**', 'dist/**', 'node_modules/**'] },
  ...vUnoStyle.configs.recommended,
  {
    files: ['**/*.{js,mjs,ts,vue}'],
    rules: {
      'comma-dangle': ['error', 'never']
    }
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: babelParser,
      parserOptions: typescriptParserOptions
    }
  },
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        // `<script setup lang="ts">` blocks
        parser: babelParser,
        ...typescriptParserOptions,
        ecmaVersion: 2022,
        sourceType: 'module'
      }
    },
    rules: {
      // `mt` is not a configured property: app.vue uses it on purpose to give the DevTools
      // Warnings tab an entry, so only the lint accepts it
      'vue-uno-style/no-multiple-v-style': ['error', { properties: [...properties, 'mt'] }]
    }
  }
]
