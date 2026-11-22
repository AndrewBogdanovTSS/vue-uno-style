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
    'resolveProperties',
  ]) assert.ok(name in api, `missing export: ${name}`)
  assert.ok(!('styleProps' in api), 'the package must not predefine properties')
})

check('the built preset generates runtime CSS and its safelist', async () => {
  const { presetVUnoStyle } = await import(built('preset.mjs'))
  const { createGenerator, presetWind3 } = await import('unocss')
  const breakpoints = { sm: 0, md: '768px', lg: '1024px' }
  const uno = await createGenerator({
    presets: [presetWind3(), presetVUnoStyle({ breakpoints, properties: ['c'] })],
  })
  const { css, matched } = await uno.generate('', { preflights: false })

  assert.ok(matched.has('o:c-$c'))
  assert.ok(matched.has('o:md:c-$c-md'))
  assert.match(css, /color:var\(--c\)/)
  assert.match(css, /@media \(min-width: 768px\)/)
  assert.ok(!matched.has('o:bg-$bg'), 'only configured properties are safelisted')
  assert.throws(() => presetVUnoStyle({ breakpoints }), /No properties configured/)
})

check('the built ESLint plugin reports its version and fixes real Vue input', async () => {
  const plugin = (await import(built('eslint.mjs'))).default
  const { ESLint } = await import('eslint')
  const vueParser = await import('vue-eslint-parser')

  assert.equal(plugin.meta.version, pkg.version)
  assert.ok(plugin.rules['no-multiple-v-style'])
  assert.deepEqual(
    Object.keys(plugin.configs.recommended[0].rules),
    ['vue-uno-style/no-multiple-v-style'],
  )

  const eslint = new ESLint({
    cwd: root,
    overrideConfigFile: true,
    overrideConfig: [{
      files: ['**/*.vue'],
      languageOptions: { parser: vueParser, ecmaVersion: 2022, sourceType: 'module' },
      plugins: { 'vue-uno-style': plugin },
      rules: { 'vue-uno-style/no-multiple-v-style': 'error' },
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

check('the package points WebStorm at a built web-types file', async () => {
  const webTypes = JSON.parse(readFileSync(join(root, pkg['web-types']), 'utf8'))
  const [directive] = webTypes.contributions.html['vue-directives']

  assert.equal(webTypes.version, pkg.version)
  assert.equal(directive.name, 'uno-style')
  assert.equal(directive.argument.pattern, undefined, 'the shipped file must not predefine properties')
  assert.ok(pkg.files.includes('dist'), 'web-types must ship inside a published folder')
})

check('the Nuxt module entry imports from the built package', async () => {
  const api = await import(built('nuxt.mjs'))
  assert.ok(api.default)
})

check('the DevTools entry exports the registry, and the tab script is self-contained', async () => {
  const api = await import(built('devtools.mjs'))
  for (const name of ['createDevtoolsRegistry', 'inspectValue']) {
    assert.ok(name in api, `missing export: ${name}`)
  }

  // The module serves this file as is, so it must not import anything
  const client = readFileSync(join(root, 'dist', 'devtools-client.mjs'), 'utf8')
  assert.doesNotMatch(client, /^\s*import\s/m, 'devtools-client.mjs must not import other modules')
  assert.match(client, /__NUXT_DEVTOOLS__/)
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
