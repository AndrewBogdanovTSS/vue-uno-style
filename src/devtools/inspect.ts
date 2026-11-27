import type { ResolvedBreakpoints } from '../core/breakpoints'
import type { ResolvedProperties } from '../core/properties'
import { isEmptyValue } from '../core/getStyleProps'
import { blockedPropertyMessage, findBlocked, isKnownProperty } from '../core/properties'

export type ValueWarningKind =
  | 'blocked-property'
  | 'unknown-property'
  | 'unknown-breakpoint'
  | 'invalid-value'

export interface ValueWarning {
  kind: ValueWarningKind
  property?: string
  breakpoint?: string
  message: string
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

const checkScalar = (
  value: unknown,
  property: string,
  breakpoint: string
): ValueWarning | undefined => {
  if (isEmptyValue(value)) return undefined
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
 * style: blocked properties, properties outside the known ones, breakpoint keys that do not exist, and values
 * that are neither strings nor numbers.
 */
export const inspectValue = (
  value: unknown,
  arg: string | undefined,
  breakpoints: ResolvedBreakpoints,
  properties?: ResolvedProperties
): ValueWarning[] => {
  if (isEmptyValue(value)) return []

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
    if (isEmptyValue(responsive)) return

    const blocked = findBlocked(properties, property)
    if (blocked) {
      warnings.push({ kind: 'blocked-property', property, message: blockedPropertyMessage(blocked) })
    }
    else if (properties && !isKnownProperty(properties, property)) {
      warnings.push({
        kind: 'unknown-property',
        property,
        message: `"${property}" is neither configured nor a default property, so its classes are not safelisted.`
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
