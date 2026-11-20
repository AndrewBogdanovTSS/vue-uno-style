import type { ResolvedBreakpoints } from './breakpoints'
import type { Responsive, StyleValue } from './getStyle'
import type { PropertyFormat } from './properties'
import { formatValue } from './properties'

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

const getVariableName = (prop: string, breakpoint: string, baseBreakpoint: string) =>
  breakpoint === baseBreakpoint ? `--${prop}` : `--${prop}-${breakpoint}`

/**
 * Composes responsive CSS variables and their matching UnoCSS class names.
 */
export const getStyleProps = (
  prop: string,
  obj: ObjectValue,
  breakpoints: ResolvedBreakpoints,
  format?: PropertyFormat,
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
      filteredValues.map(([breakpoint, value]) => [
        getVariableName(prop, breakpoint, breakpoints.base),
        formatValue(value, format),
      ]),
    ),
    classList: filteredValues.map(([breakpoint]) =>
      `o:${getClassValue(prop, breakpoint, breakpoints.base)}`),
  }
}
