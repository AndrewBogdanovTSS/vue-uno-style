import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveBreakpoints } from '../src/core/breakpoints'
import { getStyle } from '../src/core/getStyle'
import { resolveProperties } from '../src/core/properties'

const breakpoints = resolveBreakpoints({
  breakpoints: { sm: 0, md: 768, lg: 1024 }
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('getStyle', () => {
  it('composes multiple responsive properties', () => {
    expect(getStyle({
      c: { sm: 'red', md: 'green' },
      bg: { sm: 'white', lg: 'black' }
    }, breakpoints)).toEqual({
      classes: 'o:c-$c o:md:c-$c-md o:bg-$bg o:lg:bg-$bg-lg',
      style: {
        '--c': 'red',
        '--c-md': 'green',
        '--bg': 'white',
        '--bg-lg': 'black'
      }
    })
  })

  it('supports the argument form', () => {
    expect(getStyle({ sm: 'red', md: 'green' }, breakpoints, 'c')).toEqual({
      classes: 'o:c-$c o:md:c-$c-md',
      style: { '--c': 'red', '--c-md': 'green' }
    })
  })

  it('warns about a property outside the configured ones during development', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    getStyle({ sm: '1rem' }, breakpoints, 'paddign', resolveProperties(['p']))

    expect(warn).toHaveBeenCalledWith(
      '[vue-uno-style] Property "paddign" is not configured, so its classes are not safelisted.'
    )
  })

  it('accepts any property without warning when none are passed', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(getStyle({ sm: '1rem' }, breakpoints, 'anything').classes).toBe('o:anything-$anything')
    expect(warn).not.toHaveBeenCalled()
  })

  it('applies each configured property format', () => {
    const properties = resolveProperties(['c', { name: 'bgi', format: 'url' }])

    expect(getStyle({ c: { sm: 'red' }, bgi: { sm: 'a.png' } }, breakpoints, undefined, properties).style)
      .toEqual({ '--c': 'red', '--bgi': 'url(a.png)' })
  })
})
