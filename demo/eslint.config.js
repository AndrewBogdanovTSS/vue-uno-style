import vUnoStyle from 'vue-uno-style/eslint'
import vueParser from 'vue-eslint-parser'

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
  },
]
