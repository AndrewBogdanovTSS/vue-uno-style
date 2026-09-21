import type { ResolvedBreakpoints } from './breakpoints'
import type { Responsive, StyleProp, StyleValue } from './getStyle'

export interface StylePropsResult {
  styles?: Record<string, StyleValue>
  classList?: string[]
}

type ObjectValue = Responsive | StyleValue | undefined

const isObject = (value: unknown): value is Responsive =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

const getClassValue = (prop: string, breakpoint: string, baseBreakpoint: string) =>
  breakpoint === baseBreakpoint
    ? `${prop}-$${prop}`
    : `${breakpoint}:${prop}-$${prop}-${breakpoint}`

const getStyleValue = (
  prop: string,
  breakpoint: string,
  value: StyleValue,
  baseBreakpoint: string,
): [string, StyleValue] => [
  breakpoint === baseBreakpoint ? `--${prop}` : `--${prop}-${breakpoint}`,
  prop === 'bgi' ? `url(${value})` : value,
]

/**
 * Composes responsive CSS variables and their matching UnoCSS class names.
 */
export const getStyleProps = (
  prop: StyleProp,
  obj: ObjectValue,
  breakpoints: ResolvedBreakpoints,
): StylePropsResult => {
  if (!obj) return {}

  const values = isObject(obj) ? obj : { [breakpoints.base]: obj }
  const orderedBreakpoints = [breakpoints.base, ...breakpoints.prefixed]

  const filteredValues = orderedBreakpoints.reduce((acc, breakpoint) => {
    const value = values[breakpoint]
    if (value && acc[acc.length - 1]?.[1] !== value) acc.push([breakpoint, value])
    return acc
  }, [] as Array<[string, StyleValue]>)

  return {
    styles: Object.fromEntries(
      filteredValues.map(([breakpoint, value]) =>
        getStyleValue(prop, breakpoint, value, breakpoints.base)),
    ),
    classList: filteredValues.map(([breakpoint]) =>
      `o:${getClassValue(prop, breakpoint, breakpoints.base)}`),
  }
}
