import { describe, expect, it } from 'vitest'
import { defaultProperties, formatValue, resolveProperties } from '../src/core/properties'

describe('resolveProperties', () => {
  it('keeps the configured order and collects formats', () => {
    const resolved = resolveProperties(['c', { name: 'img', format: 'url' }, { name: 'p' }], { defaultProperties: false })

    expect(resolved).toEqual({
      names: ['c', 'img', 'p'],
      known: ['c', 'img', 'p'],
      formats: { img: 'url' }
    })
  })

  it('merges the configured properties with the defaults: configured first, no repeats', () => {
    const { names, known } = resolveProperties(['mask', 'mt', 'c'])

    expect(names).toEqual(['mask', 'mt', 'c'])
    expect(known).toEqual(['mask', 'mt', 'c', ...defaultProperties.filter((name) => !['mt', 'c'].includes(name))])
  })

  it('knows the defaults without any configuration', () => {
    expect(resolveProperties(undefined)).toEqual({ names: [], known: [...defaultProperties], formats: { bgi: 'url' } })
    expect(resolveProperties([]).known).toEqual(defaultProperties)
  })

  it('lists every default property once, each a valid name', () => {
    expect(new Set(defaultProperties).size).toBe(defaultProperties.length)
    expect(() => resolveProperties(defaultProperties, { defaultProperties: false })).not.toThrow()
  })

  it('gives bgi its built-in url format and bgv none', () => {
    expect(resolveProperties(['bgi', 'bgv']).formats).toEqual({ bgi: 'url' })
    expect(resolveProperties([{ name: 'bgi' }], { defaultProperties: false }).formats).toEqual({ bgi: 'url' })
    // Without the defaults, bgi is not known unless configured, so it takes no format
    expect(resolveProperties(['c'], { defaultProperties: false }).formats).toEqual({})
  })

  it.each([
    ['missing', undefined],
    ['empty', []]
  ])('throws when the list is %s and the defaults are off', (_label, properties) => {
    expect(() => resolveProperties(properties, { defaultProperties: false })).toThrow('No properties configured')
  })

  it.each(['', '1c', 'c d', 'c$', '-c'])('rejects the invalid name %j', (name) => {
    expect(() => resolveProperties([name])).toThrow('Invalid property name')
  })

  it('rejects a duplicate name, whichever form repeats it', () => {
    expect(() => resolveProperties(['c', { name: 'c' }])).toThrow('"c" is configured more than once')
  })

  it('rejects an unknown format', () => {
    expect(() => resolveProperties([{ name: 'bgi', format: 'image' as never }]))
      .toThrow('Unknown format "image" for property "bgi"')
  })
})

describe('formatValue', () => {
  it('wraps a value for the url format and leaves it alone otherwise', () => {
    expect(formatValue('a.png', 'url')).toBe('url(a.png)')
    expect(formatValue(12, undefined)).toBe(12)
  })
})
