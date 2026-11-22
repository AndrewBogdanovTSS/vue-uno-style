import { describe, expect, it } from 'vitest'
import { resolveBreakpoints } from '../src/core/breakpoints'

describe('resolveBreakpoints', () => {
  it('uses a zero-valued breakpoint as the base', () => {
    expect(resolveBreakpoints({
      breakpoints: { sm: 0, md: 768, lg: 1024 }
    })).toEqual({
      base: 'sm',
      prefixed: ['md', 'lg']
    })
  })

  it.each(['', '0', '0px'])('recognises "%s" as a base value', (value) => {
    expect(resolveBreakpoints({
      breakpoints: { base: value, md: '768px' }
    }).base).toBe('base')
  })

  it('uses an explicit base breakpoint with a stock UnoCSS theme', () => {
    expect(resolveBreakpoints({
      breakpoints: { sm: '640px', md: '768px', lg: '1024px' },
      baseBreakpoint: 'sm'
    })).toEqual({
      base: 'sm',
      prefixed: ['md', 'lg']
    })
  })

  it('throws when no base can be inferred', () => {
    expect(() => resolveBreakpoints({
      breakpoints: { sm: '640px', md: '768px' }
    })).toThrow('Unable to resolve a base breakpoint')
  })

  it('throws when the explicit base is not configured', () => {
    expect(() => resolveBreakpoints({
      breakpoints: { sm: 0, md: '768px' },
      baseBreakpoint: 'mobile'
    })).toThrow('Base breakpoint "mobile" does not exist')
  })
})
