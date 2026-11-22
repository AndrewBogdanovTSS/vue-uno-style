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
    devtools: 'src/devtools.ts',
    // The DevTools tab script. The module serves it as a file, so it must stay one
    // self-contained module: it imports only from src/devtools/clientUtils.ts.
    'devtools-client': 'src/devtools/client.ts'
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
      'node:http',
      'node:path',
      'node:process',
      'node:url',
      'unocss',
      'vue'
    ]
  },
  dts: true,
  clean: true,
  hash: false,
  outExtensions: () => ({ js: '.mjs', dts: '.d.mts' }),
  define: { __PACKAGE_VERSION__: JSON.stringify(pkg.version) },
  publint: true,
  attw: true
})
