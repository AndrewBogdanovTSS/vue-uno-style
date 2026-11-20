/**
 * How a property's runtime value is turned into the CSS variable's value.
 * `url` wraps it as `url(<value>)`, for image properties fed plain URLs.
 */
export type PropertyFormat = 'url'

/**
 * One property the directive may set: the UnoCSS utility prefix whose rule accepts a
 * `<prefix>-$<variable>` value, such as `c` or `bg` in presetWind3. Use the object form to give
 * it a value format.
 */
export type PropertyConfig = string | { name: string, format?: PropertyFormat }

export interface ResolvedProperties {
  /** Property names in configured order. */
  names: string[]
  /** Value format per property, for the properties that declare one. */
  formats: Record<string, PropertyFormat>
}

const NAME = /^[a-z][a-z0-9-]*$/i
const FORMATS: readonly PropertyFormat[] = ['url']

/**
 * Validates the configured properties. Throws when the list is missing or empty: the preset
 * safelists one class set per property, so without a list every class the directive writes
 * resolves to no CSS.
 */
export const resolveProperties = (properties: readonly PropertyConfig[] | undefined): ResolvedProperties => {
  if (!properties?.length) {
    throw new Error(
      '[vue-uno-style] No properties configured. Pass `properties`, e.g. [\'c\', \'bg\', \'p\'], '
      + 'listing every UnoCSS utility prefix the directive may set.',
    )
  }

  const names: string[] = []
  const formats: Record<string, PropertyFormat> = {}

  properties.forEach((property) => {
    const { name, format } = typeof property === 'string' ? { name: property, format: undefined } : property

    if (typeof name !== 'string' || !NAME.test(name)) {
      throw new Error(
        `[vue-uno-style] Invalid property name ${JSON.stringify(name)}. `
        + 'Use a UnoCSS utility prefix made of letters, digits and dashes.',
      )
    }
    if (names.includes(name)) {
      throw new Error(`[vue-uno-style] Property "${name}" is configured more than once.`)
    }
    if (format !== undefined && !FORMATS.includes(format)) {
      throw new Error(
        `[vue-uno-style] Unknown format ${JSON.stringify(format)} for property "${name}". `
        + `Supported: ${FORMATS.join(', ')}.`,
      )
    }

    names.push(name)
    if (format) formats[name] = format
  })

  return { names, formats }
}

/** Applies a property's configured format to one runtime value. */
export const formatValue = <T>(value: T, format: PropertyFormat | undefined): T | string =>
  format === 'url' ? `url(${String(value)})` : value
