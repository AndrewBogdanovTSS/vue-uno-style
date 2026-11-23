import { describe, expect, it } from 'vitest'
import { resolveBreakpoints } from '../src/core/breakpoints'
import { getStyle } from '../src/core/getStyle'
import { resolveProperties } from '../src/core/properties'
import { inspectValue } from '../src/devtools/inspect'

const breakpoints = resolveBreakpoints({ breakpoints: { sm: 0, md: 768, lg: 1024 } })
const properties = resolveProperties(['c', 'p'])

const kinds = (value: unknown, arg?: string) =>
  inspectValue(value, arg, breakpoints, properties).map(({ kind, property, breakpoint }) =>
    [kind, property, breakpoint].filter(Boolean).join(' '))

describe('inspectValue', () => {
  it('accepts valid values in both forms', () => {
    expect(kinds({ sm: '#111', md: 2 }, 'c')).toEqual([])
    expect(kinds({ c: '#111', p: { md: '1rem' } })).toEqual([])
    expect(kinds(undefined, 'c')).toEqual([])
    expect(kinds({ c: undefined, p: null })).toEqual([])
  })

  it('reports a property that is neither configured nor a default one', () => {
    expect(kinds({ blur: '4px' })).toEqual(['unknown-property blur'])
    expect(kinds({ gap: '1rem', mt: '8px' })).toEqual([])
    expect(inspectValue({ blur: '4px' }, undefined, breakpoints)).toEqual([])
  })

  it('reports a default property once the defaults are off', () => {
    const configuredOnly = resolveProperties(['c'], { defaultProperties: false })

    expect(inspectValue({ gap: '1rem' }, undefined, breakpoints, configuredOnly).map(({ kind }) => kind))
      .toEqual(['unknown-property'])
  })

  it('reports a breakpoint key the directive drops', () => {
    expect(kinds({ sm: '#111', xl: '#222' }, 'c')).toEqual(['unknown-breakpoint c xl'])
    // The directive really drops it
    expect(getStyle({ sm: '#111', xl: '#222' }, breakpoints, 'c').style).toEqual({ '--c': '#111' })
  })

  it('accepts a numeric zero, which the directive writes', () => {
    expect(kinds({ sm: 0, md: '1rem' }, 'p')).toEqual([])
    expect(getStyle({ sm: 0, md: '1rem' }, breakpoints, 'p').style).toEqual({ '--p': 0, '--p-md': '1rem' })
  })

  it('reports values that are neither strings nor numbers', () => {
    expect(kinds({ sm: true }, 'c')).toEqual(['invalid-value c sm'])
    expect(kinds({ c: ['#111'] })).toEqual(['invalid-value c sm'])
    expect(kinds('#111')).toEqual(['invalid-value'])
  })
})
