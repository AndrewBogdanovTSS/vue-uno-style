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
      'vue-uno-style/no-multiple-v-style': ['error', { properties }]
    }
  }
]
