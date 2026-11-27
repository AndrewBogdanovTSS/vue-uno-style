import type { ResolvedBreakpoints } from './breakpoints'
import type { ResolvedProperties } from './properties'
import { getStyleProps, isEmptyValue } from './getStyleProps'
import { blockedPropertyMessage, builtInFormats, findBlocked, isKnownProperty } from './properties'

export type StyleValue = number | string
/** `false` and `undefined` leave a breakpoint unset, so `condition && value` type-checks. */
export type Responsive<T = StyleValue> = Record<string, T | false | undefined>
/** Responsive values per property. Narrow `P` to the configured property names for type safety. */
export type ResponsiveStyles<P extends string = string> = Partial<Record<P, Responsive>>

export interface StyleResult {
  classes: string
  style: Record<string, StyleValue>
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

const isDevelopment = () => typeof process === 'undefined' || process.env.NODE_ENV !== 'production'

/**
 * Converts responsive values into UnoCSS classes and CSS custom properties.
 *
 * Pass the resolved `properties` to apply their value formats and to warn, during development,
 * about a property that is not known - its classes would never be safelisted. Without them,
 * only the built-in formats apply.
 */
export const getStyle = (
  config: Responsive | ResponsiveStyles,
  breakpoints: ResolvedBreakpoints,
  arg?: string,
  properties?: ResolvedProperties
): StyleResult => {
  const styleConfig = (arg ? { [arg]: config } : config) as Record<string, Responsive | undefined>

  const result = Object.entries(styleConfig).reduce<{
    classes: string[]
    style: Record<string, StyleValue>
  }>((acc, [prop, value]) => {
    if (isEmptyValue(value) || (isObject(value) && Object.keys(value).length === 0)) return acc

    const blocked = findBlocked(properties, prop)
    if (blocked && isDevelopment()) {
      console.warn(`[vue-uno-style] ${blockedPropertyMessage(blocked)}`)
    }
    else if (properties && !isKnownProperty(properties, prop) && isDevelopment()) {
      console.warn(`[vue-uno-style] Property "${prop}" is neither configured nor a default property, so its classes are not safelisted.`)
    }

    const format = properties ? properties.formats[prop] : builtInFormats[prop]
    const { styles = {}, classList = [] } = getStyleProps(prop, value, breakpoints, format)

    return {
      classes: [...acc.classes, ...classList],
      style: { ...acc.style, ...styles }
    }
  }, {
    classes: [],
    style: {}
  })

  return { ...result, classes: result.classes.join(' ') }
}
