import { describe, expect, it } from 'vitest'
import { blockedPropertyMessage, defaultProperties, findBlocked, formatValue, resolveProperties } from '../src/core/properties'

describe('resolveProperties', () => {
  it('keeps the configured order and collects formats', () => {
    const resolved = resolveProperties(['c', { name: 'img', format: 'url' }, { name: 'p' }], { defaultProperties: false })

    expect(resolved).toEqual({
      names: ['c', 'img', 'p'],
      known: ['c', 'img', 'p'],
      formats: { img: 'url' },
      blocked: []
    })
  })

  it('merges the configured properties with the defaults: configured first, no repeats', () => {
    const { names, known } = resolveProperties(['mask', 'mt', 'c'])

    expect(names).toEqual(['mask', 'mt', 'c'])
    expect(known).toEqual(['mask', 'mt', 'c', ...defaultProperties.filter((name) => !['mt', 'c'].includes(name))])
  })

  it('knows the defaults without any configuration', () => {
    expect(resolveProperties(undefined)).toEqual({
      names: [],
      known: [...defaultProperties],
      formats: { bgi: 'url' },
      blocked: []
    })
    expect(resolveProperties([]).known).toEqual(defaultProperties)
  })

  it('lists every default property once, each a valid name', () => {
    expect(new Set(defaultProperties).size).toBe(defaultProperties.length)
    expect(() => resolveProperties(defaultProperties, { defaultProperties: false })).not.toThrow()
  })

  it('removes a blocked property from the known ones, default properties included', () => {
    const resolved = resolveProperties(['c', 'blur'], {
      blockedProperties: ['mt', { name: 'opacity', message: 'Use op instead.' }]
    })

    expect(resolved.known).toEqual(['c', 'blur', ...defaultProperties.filter((name) => !['c', 'mt', 'opacity'].includes(name))])
    expect(resolved.blocked).toEqual([{ name: 'mt' }, { name: 'opacity', message: 'Use op instead.' }])
  })

  it('names a blocked property and its message in one sentence', () => {
    const resolved = resolveProperties([], { blockedProperties: ['mt', { name: 'opacity', message: 'Use op instead.' }] })

    expect(blockedPropertyMessage(findBlocked(resolved, 'mt')!)).toBe('Property "mt" is blocked in this project.')
    expect(blockedPropertyMessage(findBlocked(resolved, 'opacity')!))
      .toBe('Property "opacity" is blocked in this project. Use op instead.')
    expect(findBlocked(resolved, 'c')).toBeUndefined()
  })

  it.each<[string, unknown[], string]>([
    ['configured and blocked', ['c'], 'is both configured and blocked'],
    ['blocked twice', ['mt', { name: 'mt' }], 'is blocked more than once'],
    ['an invalid name', ['1x'], 'Invalid blocked property name'],
    ['a message that is not a string', [{ name: 'mt', message: 1 }], 'must be a string']
  ])('throws on a property %s', (_label, blockedProperties, message) => {
    expect(() => resolveProperties(['c'], { blockedProperties: blockedProperties as never })).toThrow(message)
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
