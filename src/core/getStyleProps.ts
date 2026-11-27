import type { ResolvedBreakpoints } from './breakpoints'
import type { Responsive, StyleValue } from './getStyle'
import type { PropertyFormat } from './properties'
import { formatValue } from './properties'
import { VARIANT_PREFIX } from './varsClasses'

export interface StylePropsResult {
  styles?: Record<string, StyleValue>
  classList?: string[]
}

type ObjectValue = Responsive | StyleValue | false | undefined

const isObject = (value: unknown): value is Responsive =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

/**
 * Whether a value leaves its property or breakpoint unset: `''`, `null`, `undefined` or `false`.
 * `false` is what `condition && value` gives when the condition fails, so it means no value, the
 * way `:class` ignores it. The number `0` is a value like any other and writes `0`.
 */
export const isEmptyValue = (value: unknown): value is '' | null | undefined | false =>
  value === undefined || value === null || value === '' || value === false

/**
 * Whether a value writes nothing: an empty value, or `true`, which is never a CSS value. `true` is
 * not empty, though: Nuxt DevTools still reports it as an invalid value.
 */
const isSkipped = (value: unknown): value is '' | null | undefined | boolean =>
  isEmptyValue(value) || value === true

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
  format?: PropertyFormat
): StylePropsResult => {
  if (isSkipped(obj)) return {}

  const values = isObject(obj) ? obj : { [breakpoints.base]: obj }
  const orderedBreakpoints = [breakpoints.base, ...breakpoints.prefixed]

  const filteredValues = orderedBreakpoints.reduce((acc, breakpoint) => {
    const value = values[breakpoint]
    if (!isSkipped(value) && acc[acc.length - 1]?.[1] !== value) acc.push([breakpoint, value])
    return acc
  }, [] as Array<[string, StyleValue]>)

  return {
    styles: Object.fromEntries(
      filteredValues.map(([breakpoint, value]) => [
        getVariableName(prop, breakpoint, breakpoints.base),
        formatValue(value, format)
      ])
    ),
    classList: filteredValues.map(([breakpoint]) =>
      `${VARIANT_PREFIX}${getClassValue(prop, breakpoint, breakpoints.base)}`)
  }
}
