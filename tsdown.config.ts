import { readFileSync } from 'node:fs'
import { defineConfig } from 'tsdown'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string
}

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    preset: 'src/preset.ts',
    eslint: 'src/eslint.ts',
    nuxt: 'src/nuxt.ts',
  },
  format: ['esm'],
  platform: 'neutral',
  target: 'es2022',
  outDir: 'dist',
  deps: {
    neverBundle: [
      '@nuxt/kit',
      '@nuxt/schema',
      '@unocss/config',
      '@unocss/nuxt',
      'eslint',
      'node:fs',
      'node:path',
      'node:process',
      'node:url',
      'unocss',
      'vue',
    ],
  },
  dts: true,
  clean: true,
  hash: false,
  outExtensions: () => ({ js: '.mjs', dts: '.d.mts' }),
  define: { __PACKAGE_VERSION__: JSON.stringify(pkg.version) },
  publint: true,
  attw: true,
})
