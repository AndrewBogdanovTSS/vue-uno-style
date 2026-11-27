/**
 * Confirms the generated playground contains the directive's SSR output and the preset's CSS.
 *
 * Runs against `.output/public`, so it covers server rendering and the first write - the update
 * path only runs in a browser. Set `NUXT_APP_BASE_URL` to the value the site was generated with
 * (the Pages workflow does), so asset and image URLs are checked under that base.
 */
import { strict as assert } from 'node:assert'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { properties } from '../config/vue-uno-style.ts'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const output = join(root, '.output', 'public')
const html = readFileSync(join(output, 'index.html'), 'utf8')
const base = process.env.NUXT_APP_BASE_URL ?? '/'

/** The opening tag of the element carrying `marker`, so each assertion is scoped to one demo. */
const tag = (marker) => {
  const match = new RegExp(`<[a-z]+[^>]*\\b${marker}\\b[^>]*>`).exec(html)
  assert.ok(match, `SSR HTML has no element with ${marker}`)
  return match[0]
}

const expectations = {
  'data-playground-responsive': ['vs:c-$c', 'vs:md:c-$c-md', 'vs:lg:bg-$bg-lg', '--c:#1e1b4b', '--p-lg:3rem'],
  'data-playground-argument': ['vs:c-$c', 'vs:md:c-$c-md', '--c:#7c3aed'],
  'data-playground-object': ['vs:gap-$gap', 'vs:md:gap-$gap-md', '--gap-md:1.5rem'],
  'data-playground-scalar': ['vs:p-$p', '--p:1.5rem'],
  // `md` repeats `sm`, so it must collapse: no `md` class or variable
  'data-playground-collapsed': ['vs:w-$w', 'vs:lg:w-$w-lg', '--w-lg:50%'],
  // Default properties the preset found in the template, not configured
  'data-playground-scanned': ['vs:mt-$mt', 'vs:md:mt-$mt-md', 'vs:px-$px', '--mt-md:1.5rem'],
  // The `url` format wraps the plain URLs, which carry the site's base path
  'data-playground-format': ['vs:bgi-$bgi', `--bgi:url(${base}dots.svg)`, `--bgi-md:url(${base}grid.svg)`],
  'data-playground-update': ['vs:md:p-$p-md', '--bgv:linear-gradient(135deg, #e0e7ff, #f5f3ff)'],
  // Both the component's own binding (`p`) and the usage site's (`md` background) are present
  'data-playground-composed': ['vs:md:p-$p-md', '--bg-md:#2563eb'],
  'data-playground-override': ['c-slate-400', 'vs:c-$c', '--c:#16a34a'],
  // The resize hint's first segment: highlighted below md by the directive alone, with no script
  'data-playground-ruler': ['vs:bg-$bg', 'vs:md:bg-$bg-md', '--bg:var(--primary)', '--bg-md:transparent', 'vs:md:c-$c-md']
}

for (const [marker, values] of Object.entries(expectations)) {
  const element = tag(marker)
  for (const value of values) assert.ok(element.includes(value), `${marker} is missing ${value}`)
}
const collapsed = tag('data-playground-collapsed')
assert.ok(!collapsed.includes('-md'), 'data-playground-collapsed kept a repeated md value')

// The palette toggle drives the directive's update path in a browser; it must still be there.
tag('data-playground-toggle')

// Assets resolve under the base path, or the deployed page loads without scripts or styles.
assert.ok(html.includes(`${base}_nuxt/`), `assets are not served from ${base}_nuxt/`)

const assets = join(output, '_nuxt')
const css = readdirSync(assets)
  .filter((file) => file.endsWith('.css'))
  .map((file) => readFileSync(join(assets, file), 'utf8'))
  .join('\n')

// Every configured property is safelisted and matched by a rule, so its base class has CSS.
for (const property of properties) {
  const name = typeof property === 'string' ? property : property.name
  // UnoCSS escapes the selector as `.vs\:<name>-\$<name>`
  assert.ok(css.includes(`.vs\\:${name}-\\$${name}{`), `no CSS for the configured property "${name}"`)
}
assert.match(css, /@media \((?:min-width: ?768px|width>=768px)\)/)

// The preset scanned the template: default properties it set have CSS at every breakpoint, and
// the sides no template sets have none.
for (const selector of ['.vs\\:mt-\\$mt{', '.vs\\:md\\:mt-\\$mt-md{', '.vs\\:lg\\:mt-\\$mt-lg{', '.vs\\:px-\\$px{']) {
  assert.ok(css.includes(selector), `no CSS for the scanned selector ${selector}`)
}
for (const unused of ['mb', 'ml', 'mr', 'my', 'pl', 'pr', 'pb', 'pt', 'tracking', 'indent']) {
  assert.ok(!css.includes(`.vs\\:${unused}-\\$${unused}`), `CSS has the unused default property "${unused}"`)
}

console.log('PASS  generated HTML contains the directive output for every demo')
console.log(`PASS  every configured property has CSS, and assets resolve under ${base}`)
console.log('PASS  scanned default properties have CSS, and unused ones have none')
