import type { ResolvedBreakpoints } from '../core/breakpoints'
import type { ResolvedProperties } from '../core/properties'

export type ValueWarningKind =
  | 'unknown-property'
  | 'unknown-breakpoint'
  | 'invalid-value'
  | 'dropped-value'

export interface ValueWarning {
  kind: ValueWarningKind
  property?: string
  breakpoint?: string
  message: string
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

const isEmpty = (value: unknown) => value === undefined || value === null || value === ''

const checkScalar = (
  value: unknown,
  property: string,
  breakpoint: string
): ValueWarning | undefined => {
  if (isEmpty(value)) return undefined
  // getStyleProps skips falsy values, so a numeric 0 never reaches the CSS
  if (value === 0) {
    return {
      kind: 'dropped-value',
      property,
      breakpoint,
      message: `"${property}" at "${breakpoint}" is the number 0, which the directive skips. Use the string '0'.`
    }
  }
  if (typeof value !== 'string' && typeof value !== 'number') {
    return {
      kind: 'invalid-value',
      property,
      breakpoint,
      message: `"${property}" at "${breakpoint}" is ${Array.isArray(value) ? 'an array' : `a ${typeof value}`}, not a string or a number.`
    }
  }
  return undefined
}

/**
 * Lists what in a binding value the directive will silently ignore or that the preset will not
 * style: properties outside the configured list, breakpoint keys that do not exist, numeric
 * zeros, and values that are neither strings nor numbers.
 */
export const inspectValue = (
  value: unknown,
  arg: string | undefined,
  breakpoints: ResolvedBreakpoints,
  properties?: ResolvedProperties
): ValueWarning[] => {
  if (isEmpty(value)) return []

  if (!arg && !isObject(value)) {
    return [{
      kind: 'invalid-value',
      message: 'Without an argument the value must be an object of properties, such as { c: \'#111\' }.'
    }]
  }

  const config = (arg ? { [arg]: value } : value) as Record<string, unknown>
  const known = [breakpoints.base, ...breakpoints.prefixed]
  const warnings: ValueWarning[] = []

  Object.entries(config).forEach(([property, responsive]) => {
    if (isEmpty(responsive)) return

    if (properties && !properties.names.includes(property)) {
      warnings.push({
        kind: 'unknown-property',
        property,
        message: `"${property}" is not a configured property, so its classes are not safelisted.`
      })
    }

    if (!isObject(responsive)) {
      const warning = checkScalar(responsive, property, breakpoints.base)
      if (warning) warnings.push(warning)
      return
    }

    Object.entries(responsive).forEach(([breakpoint, item]) => {
      if (!known.includes(breakpoint)) {
        warnings.push({
          kind: 'unknown-breakpoint',
          property,
          breakpoint,
          message: `"${property}" has a value for "${breakpoint}", which is not a breakpoint (${known.join(', ')}). The directive drops it.`
        })
        return
      }
      const warning = checkScalar(item, property, breakpoint)
      if (warning) warnings.push(warning)
    })
  })

  return warnings
}
