/** Writes the default `dist/web-types.json` that the package ships for the `uno-style` name. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { createWebTypes, serializeWebTypes } from '../src/core/webTypes'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
  'version': string
  'web-types': string
}

const target = join(root, pkg['web-types'])
mkdirSync(join(target, '..'), { recursive: true })
writeFileSync(target, serializeWebTypes(createWebTypes({
  directiveName: 'uno-style',
  version: pkg.version
})))

process.stdout.write(`web-types written to ${pkg['web-types']}\n`)
