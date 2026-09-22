import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveBreakpoints } from '../src/core/breakpoints'
import { getStyle } from '../src/core/getStyle'

const breakpoints = resolveBreakpoints({
  breakpoints: { sm: 0, md: 768, lg: 1024 },
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('getStyle', () => {
  it('composes multiple responsive properties', () => {
    expect(getStyle({
      c: { sm: 'red', md: 'green' },
      bg: { sm: 'white', lg: 'black' },
    }, breakpoints)).toEqual({
      classes: 'o:c-$c o:md:c-$c-md o:bg-$bg o:lg:bg-$bg-lg',
      style: {
        '--c': 'red',
        '--c-md': 'green',
        '--bg': 'white',
        '--bg-lg': 'black',
      },
    })
  })

  it('supports the argument form', () => {
    expect(getStyle({ sm: 'red', md: 'green' }, breakpoints, 'c')).toEqual({
      classes: 'o:c-$c o:md:c-$c-md',
      style: { '--c': 'red', '--c-md': 'green' },
    })
  })

  it('warns about unsupported properties during development', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    getStyle({ sm: '1rem' }, breakpoints, 'paddign')

    expect(warn).toHaveBeenCalledWith('[vue-uno-style] Unknown style property "paddign".')
  })
})
