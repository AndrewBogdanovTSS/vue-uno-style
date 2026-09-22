/** Confirms the generated Nuxt page contains SSR directive output and preset CSS. */
import { strict as assert } from 'node:assert'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const output = join(root, '.output', 'public')
const html = readFileSync(join(output, 'index.html'), 'utf8')

for (const value of [
  'data-demo-object',
  'o:c-$c',
  'o:md:c-$c-md',
  'o:bgv-$bgv',
  'o:md:bgv-$bgv-md',
  'o:p-$p',
  'o:md:p-$p-md',
  '--c:#0f172a',
  '--c-md:#ffffff',
  '--bgv:linear-gradient(135deg, #e0e7ff, #f5f3ff)',
  'data-demo-argument',
  'o:bgi-$bgi',
  'o:md:bgi-$bgi-md',
  '--bgi:url(/dots.svg)',
]) assert.ok(html.includes(value), `SSR HTML is missing ${value}`)

const assets = join(output, '_nuxt')
const css = readdirSync(assets)
  .filter((file) => file.endsWith('.css'))
  .map((file) => readFileSync(join(assets, file), 'utf8'))
  .join('\n')

assert.match(css, /\.o\\:c-\\\$c\{color:var\(--c\)/)
assert.match(css, /\.o\\:bgi-\\\$bgi\{background-image:var\(--bgi\)/)
assert.match(css, /@media \((?:min-width: 768px|width>=768px)\)/)

console.log('PASS  generated HTML contains vue-uno-style SSR classes and variables')
console.log('PASS  generated CSS contains the preset rules and responsive media query')
