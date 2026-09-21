import { describe, expect, it } from 'vitest'
import { resolveBreakpoints } from '../src/core/breakpoints'
import { styleProps } from '../src/core/getStyle'
import { getStyleProps } from '../src/core/getStyleProps'
import { getVarsClasses } from '../src/core/varsClasses'

/**
 * `getStyleProps` builds the classes the directive writes at runtime, and
 * `getVarsClasses` builds the tokens the preset safelists. They compose the same
 * string from two separate expressions, and nothing but this file makes them
 * agree.
 *
 * If they ever disagree, UnoCSS generates CSS for a selector the directive never
 * emits: no error, no failing unit test, and every styled element silently loses
 * its styles. Asserting each against its own literal - which is what the two
 * suites next door do - cannot catch that, because the natural way to change the
 * format is to update one function together with its own expectations.
 */
const canvasLike = resolveBreakpoints({ breakpoints: { sm: 0, md: 768, lg: 1024 } })
const stockLike = resolveBreakpoints({
  breakpoints: { sm: '640px', md: '768px', lg: '1024px' },
  baseBreakpoint: 'sm',
})

describe('runtime and safelist class parity', () => {
  describe.each([
    ['zero-valued base', canvasLike],
    ['explicit base', stockLike],
  ])('%s', (_label, breakpoints) => {
    // A distinct value per breakpoint, so the adjacent-duplicate filter in
    // `getStyleProps` keeps every breakpoint and the two lists are comparable.
    const responsive = Object.fromEntries(
      [breakpoints.base, ...breakpoints.prefixed].map((breakpoint) => [breakpoint, breakpoint]),
    )

    it.each(styleProps)('matches for "%s"', (prop) => {
      expect(getStyleProps(prop, responsive, breakpoints).classList)
        .toEqual(getVarsClasses(prop, breakpoints).split(' '))
    })
  })

  it('covers every supported style property', () => {
    expect(styleProps).toHaveLength(40)
  })
})
