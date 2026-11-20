import vUnoStyle from 'vue-uno-style/eslint'
import vueParser from 'vue-eslint-parser'
import properties from './properties.js'

export default [
  { ignores: ['.nuxt/**', '.output/**', 'node_modules/**'] },
  ...vUnoStyle.configs.recommended,
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
    },
    rules: {
      'vue-uno-style/no-multiple-v-style': ['error', { properties }],
    },
  },
]
