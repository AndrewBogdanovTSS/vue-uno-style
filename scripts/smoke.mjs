/** Exercises every built entry through its real consumer. */
import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const built = (entry) => pathToFileURL(join(root, 'dist', entry)).href

const checks = []
const check = (name, fn) => checks.push({ name, fn })

check('the root entry exports the directive and core API', async () => {
  const api = await import(built('index.mjs'))
  for (const name of [
    'createVUnoStyle',
    'vUnoStyle',
    'getStyle',
    'getStyleProps',
    'getVarsClasses',
    'resolveBreakpoints',
    'styleProps',
  ]) assert.ok(name in api, `missing export: ${name}`)
  assert.equal(api.styleProps.length, 40)
})

check('the built preset generates runtime CSS and its safelist', async () => {
  const { presetVUnoStyle } = await import(built('preset.mjs'))
  const { createGenerator, presetWind3 } = await import('unocss')
  const breakpoints = { sm: 0, md: '768px', lg: '1024px' }
  const uno = await createGenerator({
    presets: [presetWind3(), presetVUnoStyle({ breakpoints })],
  })
  const { css, matched } = await uno.generate('', { preflights: false })

  assert.ok(matched.has('o:c-$c'))
  assert.ok(matched.has('o:md:c-$c-md'))
  assert.match(css, /color:var\(--c\)/)
  assert.match(css, /@media \(min-width: 768px\)/)
})

check('the built ESLint plugin reports its version and fixes real Vue input', async () => {
  const plugin = (await import(built('eslint.mjs'))).default
  const { ESLint } = await import('eslint')
  const vueParser = await import('vue-eslint-parser')

  assert.equal(plugin.meta.version, pkg.version)
  assert.ok(plugin.rules['no-multiple-v-style'])
  assert.deepEqual(
    Object.keys(plugin.configs.recommended[0].rules),
    ['v-uno-style/no-multiple-v-style'],
  )

  const eslint = new ESLint({
    cwd: root,
    overrideConfigFile: true,
    overrideConfig: [{
      files: ['**/*.vue'],
      languageOptions: { parser: vueParser, ecmaVersion: 2022, sourceType: 'module' },
      plugins: { 'v-uno-style': plugin },
      rules: { 'v-uno-style/no-multiple-v-style': 'error' },
    }],
    fix: true,
  })
  const [result] = await eslint.lintText(
    '<template><div v-uno-style:c="color" v-uno-style:bg="background" /></template>',
    { filePath: join(root, 'smoke.vue') },
  )

  assert.equal(
    result.output,
    '<template><div v-uno-style="{ c: color, bg: background }" /></template>',
  )
})

check('the Nuxt module entry imports from the built package', async () => {
  const api = await import(built('nuxt.mjs'))
  assert.ok(api.default)
})

let failed = 0
process.stdout.write(`\nSmoke test on Node ${process.version}\n`)
process.stdout.write(`${'-'.repeat(28 + process.version.length)}\n`)
for (const { name, fn } of checks) {
  try {
    await fn()
    process.stdout.write(`PASS  ${name}\n`)
  }
  catch (error) {
    failed++
    process.stdout.write(`FAIL  ${name}\n`)
    process.stdout.write(`      ${error instanceof Error ? error.message : String(error)}\n`)
  }
}
process.stdout.write(`\n${checks.length} checked - ${failed} failed\n\n`)
process.exit(failed === 0 ? 0 : 1)
