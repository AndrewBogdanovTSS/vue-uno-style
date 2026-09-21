import { describe, expect, it } from 'vitest'
import { resolveBreakpoints } from '../src/core/breakpoints'
import { getVarsClasses } from '../src/core/varsClasses'

const breakpoints = resolveBreakpoints({
  breakpoints: { sm: 0, md: 768, lg: 1024 },
})

describe('getVarsClasses', () => {
  it('moves generated classes to the override layer by default', () => {
    expect(getVarsClasses('bg', breakpoints))
      .toBe('o:bg-$bg o:md:bg-$bg-md o:lg:bg-$bg-lg')
  })

  it('can leave generated classes in the default layer', () => {
    expect(getVarsClasses('bg', breakpoints, false))
      .toBe('bg-$bg md:bg-$bg-md lg:bg-$bg-lg')
  })
})
