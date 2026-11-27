import { describe, expect, it } from 'vitest'
import { resolveBreakpoints } from '../src/core/breakpoints'
import { getStyleProps } from '../src/core/getStyleProps'

const breakpoints = resolveBreakpoints({
  breakpoints: { sm: 0, md: 768, lg: 1024 }
})

describe('getStyleProps', () => {
  const prop = 'p'

  it('returns correct styles for all breakpoints', () => {
    expect(getStyleProps(prop, { sm: '1rem', md: '2rem', lg: '3rem' }, breakpoints))
      .toEqual({
        styles: { '--p': '1rem', '--p-md': '2rem', '--p-lg': '3rem' },
        classList: ['vs:p-$p', 'vs:md:p-$p-md', 'vs:lg:p-$p-lg']
      })
  })

  it('handles missing breakpoint values', () => {
    expect(getStyleProps(prop, { sm: '1rem', md: '2rem' }, breakpoints))
      .toEqual({
        styles: { '--p': '1rem', '--p-md': '2rem' },
        classList: ['vs:p-$p', 'vs:md:p-$p-md']
      })
  })

  it('handles a number as the base value', () => {
    expect(getStyleProps(prop, 1, breakpoints)).toEqual({
      styles: { '--p': 1 },
      classList: ['vs:p-$p']
    })
  })

  it('handles a string as the base value', () => {
    expect(getStyleProps(prop, '1rem', breakpoints)).toEqual({
      styles: { '--p': '1rem' },
      classList: ['vs:p-$p']
    })
  })

  it('returns an empty object when the value is undefined', () => {
    expect(getStyleProps(prop, undefined, breakpoints)).toEqual({})
  })

  it('removes duplicated values across adjacent breakpoints', () => {
    expect(getStyleProps(prop, { sm: '1rem', md: '1rem', lg: '2rem' }, breakpoints))
      .toEqual({
        styles: { '--p': '1rem', '--p-lg': '2rem' },
        classList: ['vs:p-$p', 'vs:lg:p-$p-lg']
      })
  })

  it('keeps duplicated values across non-adjacent breakpoints', () => {
    expect(getStyleProps(prop, { sm: '1rem', md: '2rem', lg: '1rem' }, breakpoints))
      .toEqual({
        styles: { '--p': '1rem', '--p-md': '2rem', '--p-lg': '1rem' },
        classList: ['vs:p-$p', 'vs:md:p-$p-md', 'vs:lg:p-$p-lg']
      })
  })

  it('passes values through unchanged when no format is configured', () => {
    expect(getStyleProps('bgi', { sm: 'image-sm.png' }, breakpoints))
      .toEqual({
        styles: { '--bgi': 'image-sm.png' },
        classList: ['vs:bgi-$bgi']
      })
  })

  it('wraps values with url() for a property configured with the url format', () => {
    expect(getStyleProps('bgi', { sm: 'image-sm.png', md: 'image-md.png' }, breakpoints, 'url'))
      .toEqual({
        styles: {
          '--bgi': 'url(image-sm.png)',
          '--bgi-md': 'url(image-md.png)'
        },
        classList: ['vs:bgi-$bgi', 'vs:md:bgi-$bgi-md']
      })
  })

  it('skips false, as a scalar and at a breakpoint', () => {
    expect(getStyleProps(prop, false, breakpoints)).toEqual({})
    expect(getStyleProps(prop, { sm: '1rem', md: false }, breakpoints)).toEqual({
      styles: { '--p': '1rem' },
      classList: ['vs:p-$p']
    })
    expect(getStyleProps(prop, { sm: false, md: '2rem' }, breakpoints)).toEqual({
      styles: { '--p-md': '2rem' },
      classList: ['vs:md:p-$p-md']
    })
  })

  it('skips true, which is never a CSS value', () => {
    expect(getStyleProps(prop, true as never, breakpoints)).toEqual({})
    expect(getStyleProps(prop, { sm: '1rem', md: true as never }, breakpoints)).toEqual({
      styles: { '--p': '1rem' },
      classList: ['vs:p-$p']
    })
  })

  it('still writes a numeric zero next to a skipped false', () => {
    expect(getStyleProps(prop, { sm: 0, md: false, lg: '1rem' }, breakpoints)).toEqual({
      styles: { '--p': 0, '--p-lg': '1rem' },
      classList: ['vs:p-$p', 'vs:lg:p-$p-lg']
    })
  })
})
