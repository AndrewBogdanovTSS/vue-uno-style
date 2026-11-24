import { existsSync, linkSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { defaultProperties } from '../src/core/properties'
import { createWebTypes, serializeWebTypes } from '../src/core/webTypes'
import { packageWebTypesPath, writeWebTypes } from '../src/webTypes'

describe('createWebTypes', () => {
  const properties = ['c', 'bg', { name: 'bgi', format: 'url' as const }]
  const webTypes = createWebTypes({ directiveName: 'style', version: '1.2.3', properties })
  const [directive] = webTypes.contributions.html['vue-directives']

  it('describes exactly one directive under the registered name', () => {
    expect(webTypes.contributions.html['vue-directives']).toHaveLength(1)
    expect(directive.name).toBe('style')
    expect(directive.description).toContain('v-style:<property>')
    expect(webTypes.version).toBe('1.2.3')
    expect(webTypes.framework).toBe('vue')
  })

  it('offers the configured properties, then the defaults they do not repeat', () => {
    expect(directive.argument.pattern?.or).toEqual([
      'c', 'bg', 'bgi', ...defaultProperties.filter((name) => !['c', 'bg', 'bgi'].includes(name))
    ])
  })

  it('never offers a blocked property', () => {
    const [directive] = createWebTypes({ directiveName: 'uno-style', version: '1.2.3', blockedProperties: ['mt', { name: 'opacity' }] })
      .contributions.html['vue-directives']

    expect(directive.argument.pattern?.or).toEqual(defaultProperties.filter((name) => !['mt', 'opacity'].includes(name)))
  })

  it('offers the default properties when none are configured', () => {
    const [shipped] = createWebTypes({ directiveName: 'uno-style', version: '1.2.3' })
      .contributions.html['vue-directives']

    expect(shipped.argument.pattern?.or).toEqual(defaultProperties)
  })

  it('offers exactly the configured properties once the defaults are off', () => {
    const [configuredOnly] = createWebTypes({ directiveName: 'uno-style', version: '1.2.3', properties, defaultProperties: false })
      .contributions.html['vue-directives']

    expect(configuredOnly.argument.pattern?.or).toEqual(['c', 'bg', 'bgi'])
  })

  it('accepts any argument when the defaults are off and no properties are configured', () => {
    const [open] = createWebTypes({ directiveName: 'uno-style', version: '1.2.3', defaultProperties: false })
      .contributions.html['vue-directives']

    expect(open.argument).not.toHaveProperty('pattern')
  })

  it('serialises with a trailing newline', () => {
    const contents = serializeWebTypes(webTypes)

    expect(contents.endsWith('}\n')).toBe(true)
    expect(JSON.parse(contents)).toEqual(webTypes)
  })
})

describe('writeWebTypes', () => {
  let directory: string

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'vue-uno-style-web-types-'))
  })

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true })
  })

  it('writes the file when it is missing', () => {
    const file = join(directory, 'web-types.json')

    expect(writeWebTypes(file, 'new')).toBe('written')
    expect(readFileSync(file, 'utf8')).toBe('new')
  })

  it('leaves an identical file alone', () => {
    const file = join(directory, 'web-types.json')
    writeFileSync(file, 'same')

    expect(writeWebTypes(file, 'same')).toBe('unchanged')
  })

  // pnpm hard-links installed files to a store shared by every project on the machine. Editing
  // the file in place would rewrite the store's copy; replacing it must leave that copy alone.
  it('replaces a hard-linked file without changing the other link', () => {
    const store = join(directory, 'store.json')
    const file = join(directory, 'web-types.json')
    writeFileSync(store, 'shipped')
    linkSync(store, file)

    expect(writeWebTypes(file, 'rewritten')).toBe('written')
    expect(readFileSync(file, 'utf8')).toBe('rewritten')
    expect(readFileSync(store, 'utf8')).toBe('shipped')
  })

  it('throws when the directory is missing', () => {
    const file = join(directory, 'missing', 'web-types.json')

    expect(() => writeWebTypes(file, 'new')).toThrow()
    expect(existsSync(file)).toBe(false)
  })

  it('removes its temporary file when the rename fails', () => {
    // A directory in the target's place lets the temporary write succeed and the rename fail
    const file = join(directory, 'web-types.json')
    mkdirSync(file)

    expect(() => writeWebTypes(file, 'new')).toThrow()
    expect(readdirSync(directory)).toEqual(['web-types.json'])
  })

  it('targets the web-types.json next to the module file', () => {
    expect(packageWebTypesPath()).toMatch(/[\\/]src[\\/]web-types\.json$/)
  })
})
