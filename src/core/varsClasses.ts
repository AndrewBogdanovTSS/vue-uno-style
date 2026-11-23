import type { ResolvedBreakpoints } from './breakpoints'

/**
 * The variant every generated class carries. The preset maps it to the directive's own layer, so
 * the classes beat ordinary utilities without sharing a variant or layer with the project's own.
 */
export const VARIANT_PREFIX = 'vs:'

/**
 * Composes the complete class list that must be safelisted for a style property.
 */
export const getVarsClasses = (
  prop: string,
  breakpoints: ResolvedBreakpoints,
  withVariant = true
): string => ['', ...breakpoints.prefixed].map((breakpoint) => {
  const prefix = breakpoint ? `${breakpoint}:` : ''
  const postfix = breakpoint ? `-${breakpoint}` : ''
  const variant = withVariant ? VARIANT_PREFIX : ''
  return `${variant}${prefix}${prop}-$${prop}${postfix}`
}).join(' ')
