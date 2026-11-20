import { describe, expect, it } from 'vitest'
import { formatValue, resolveProperties } from '../src/core/properties'

describe('resolveProperties', () => {
  it('keeps the configured order and collects formats', () => {
    expect(resolveProperties(['c', { name: 'bgi', format: 'url' }, { name: 'p' }])).toEqual({
      names: ['c', 'bgi', 'p'],
      formats: { bgi: 'url' },
    })
  })

  it.each([
    ['missing', undefined],
    ['empty', []],
  ])('throws when the list is %s', (_label, properties) => {
    expect(() => resolveProperties(properties)).toThrow('No properties configured')
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
