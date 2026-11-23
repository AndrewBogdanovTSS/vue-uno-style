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

export interface ResolvePropertiesOptions {
  /**
   * Whether the default properties count as known. Defaults to `true`. With `false`, only the
   * configured properties are known, and the list must not be empty.
   */
  defaultProperties?: boolean
}

export interface ResolvedProperties {
  /** The configured property names, in configured order. The preset always safelists them. */
  names: string[]
  /**
   * Every property the directive knows: the configured ones, then the default properties the
   * configuration does not repeat. The preset safelists a default property once it finds it in
   * the source, and nothing reports a known property as a mistake.
   */
  known: string[]
  /** Value format per property, for the properties that take one. */
  formats: Record<string, PropertyFormat>
}

const NAME = /^[a-z][a-z0-9-]*$/i
const FORMATS: readonly PropertyFormat[] = ['url']

/** Whether `name` has the shape of a property name: a letter, then letters, digits or dashes. */
export const isPropertyName = (name: unknown): name is string => typeof name === 'string' && NAME.test(name)

/**
 * Properties the directive knows without configuration. Every one has a `<prefix>-$<variable>`
 * rule in `presetMini`, `presetWind3` and `presetWind4`, except `bgi` and `bgv`, whose rules the
 * preset ships. None is safelisted until the source uses it, so an unused one costs no CSS.
 */
export const defaultProperties: readonly string[] = [
  // Colour and background
  'c', 'bg', 'bgi', 'bgv',
  // Spacing
  'm', 'mt', 'mr', 'mb', 'ml', 'mx', 'my',
  'p', 'pt', 'pr', 'pb', 'pl', 'px', 'py',
  'gap', 'gap-x', 'gap-y',
  // Sizing
  'w', 'h', 'min-w', 'max-w', 'min-h', 'max-h', 'aspect',
  // Position and order
  'top', 'right', 'bottom', 'left', 'inset', 'z', 'order',
  // Flex
  'flex', 'basis',
  // Look and type
  'rounded', 'opacity', 'text-size', 'leading', 'tracking'
]

/**
 * The format a built-in property takes when its entry names none. `bgi` is fed plain image URLs;
 * a gradient or any other background goes to `bgv`, which takes the value as written.
 */
export const builtInFormats: Readonly<Record<string, PropertyFormat>> = { bgi: 'url' }

/**
 * Validates the configured properties and merges them with the default properties. Throws on an
 * invalid entry, and when nothing is known at all: no properties with `defaultProperties: false`.
 */
export const resolveProperties = (
  properties: readonly PropertyConfig[] | undefined,
  { defaultProperties: withDefaults = true }: ResolvePropertiesOptions = {}
): ResolvedProperties => {
  if (!withDefaults && !properties?.length) {
    throw new Error(
      '[vue-uno-style] No properties configured. With `defaultProperties: false`, pass '
      + '`properties`, e.g. [\'c\', \'bg\', \'p\'], listing every UnoCSS utility prefix the directive may set.'
    )
  }

  const names: string[] = []
  const formats: Record<string, PropertyFormat> = { ...builtInFormats }

  properties?.forEach((property) => {
    const { name, format } = typeof property === 'string' ? { name: property, format: undefined } : property

    if (!isPropertyName(name)) {
      throw new Error(
        `[vue-uno-style] Invalid property name ${JSON.stringify(name)}. `
        + 'Use a UnoCSS utility prefix made of letters, digits and dashes.'
      )
    }
    if (names.includes(name)) {
      throw new Error(`[vue-uno-style] Property "${name}" is configured more than once.`)
    }
    if (format !== undefined && !FORMATS.includes(format)) {
      throw new Error(
        `[vue-uno-style] Unknown format ${JSON.stringify(format)} for property "${name}". `
        + `Supported: ${FORMATS.join(', ')}.`
      )
    }

    names.push(name)
    if (format) formats[name] = format
  })

  const known = withDefaults
    ? [...names, ...defaultProperties.filter((name) => !names.includes(name))]
    : [...names]

  return {
    names,
    known,
    // Only the formats of known properties, so `bgi` keeps none once the defaults are off
    formats: Object.fromEntries(Object.entries(formats).filter(([name]) => known.includes(name)))
  }
}

/** Applies a property's configured format to one runtime value. */
export const formatValue = <T>(value: T, format: PropertyFormat | undefined): T | string =>
  format === 'url' ? `url(${String(value)})` : value
