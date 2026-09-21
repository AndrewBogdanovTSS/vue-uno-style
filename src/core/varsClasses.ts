import type { ResolvedBreakpoints } from './breakpoints'
import type { StyleProp } from './getStyle'

/**
 * Composes the complete class list that must be safelisted for a style property.
 */
export const getVarsClasses = (
  prop: StyleProp,
  breakpoints: ResolvedBreakpoints,
  isOverride = true,
): string => ['', ...breakpoints.prefixed].map((breakpoint) => {
  const prefix = breakpoint ? `${breakpoint}:` : ''
  const postfix = breakpoint ? `-${breakpoint}` : ''
  const override = isOverride ? 'o:' : ''
  return `${override}${prefix}${prop}-$${prop}${postfix}`
}).join(' ')
