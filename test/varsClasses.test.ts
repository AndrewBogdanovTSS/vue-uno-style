import { describe, expect, it } from 'vitest'
import { resolveBreakpoints } from '../src/core/breakpoints'
import { getVarsClasses } from '../src/core/varsClasses'

const breakpoints = resolveBreakpoints({
  breakpoints: { sm: 0, md: 768, lg: 1024 }
})

describe('getVarsClasses', () => {
  it('puts the vs: variant on generated classes by default', () => {
    expect(getVarsClasses('bg', breakpoints))
      .toBe('vs:bg-$bg vs:md:bg-$bg-md vs:lg:bg-$bg-lg')
  })

  it('can leave generated classes in the default layer', () => {
    expect(getVarsClasses('bg', breakpoints, false))
      .toBe('bg-$bg md:bg-$bg-md lg:bg-$bg-lg')
  })
})
