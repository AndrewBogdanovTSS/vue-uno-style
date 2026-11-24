/**
 * How a property's runtime value is turned into the CSS variable's value.
 * `url` wraps it as `url(<value>)`, for image properties fed plain URLs.
 */
export type PropertyFormat = 'url'

/**
 * One property the directive may set: the UnoCSS utility prefix whose rule accepts a
 * `<prefix>-$<variable>` value, such as `c` or `bg` in presetWind3. Use the object form to give
 * it a value format, or `format: false` to drop a built-in one, such as `bgi`'s `url`.
 */
export type PropertyConfig = string | { name: string, format?: PropertyFormat | false }

/**
 * A property the project forbids, with an optional message saying what to use instead. Use the
 * object form to give it the message.
 */
export type BlockedPropertyConfig = string | { name: string, message?: string }

export interface BlockedProperty {
  name: string
  /** What to use instead, shown next to every report of the property. */
  message?: string
}

export interface ResolvePropertiesOptions {
  /**
   * Whether the default properties count as known. Defaults to `true`. With `false`, only the
   * configured properties are known, and the list must not be empty.
   */
  defaultProperties?: boolean
  /**
   * Properties the project forbids, default ones included. They are never known: the preset
   * neither scans for nor safelists them, and ESLint, the directive and the DevTools tab report
   * them with their message. Listing one in `properties` too throws.
   */
  blockedProperties?: readonly BlockedPropertyConfig[]
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
  /** The blocked properties, in configured order. None of them is known. */
  blocked: BlockedProperty[]
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
  { defaultProperties: withDefaults = true, blockedProperties }: ResolvePropertiesOptions = {}
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
    if (format !== undefined && format !== false && !FORMATS.includes(format)) {
      throw new Error(
        `[vue-uno-style] Unknown format ${JSON.stringify(format)} for property "${name}". `
        + `Supported: ${FORMATS.join(', ')}.`
      )
    }

    names.push(name)
    if (format) formats[name] = format
    // `false` takes the value as written, even for a property with a built-in format
    else if (format === false) delete formats[name]
  })

  const blocked = resolveBlocked(blockedProperties)
  const conflict = blocked.find(({ name }) => names.includes(name))
  if (conflict) {
    throw new Error(
      `[vue-uno-style] Property "${conflict.name}" is both configured and blocked. Remove it from one of the lists.`
    )
  }

  const blockedNames = new Set(blocked.map(({ name }) => name))
  const known = withDefaults
    ? [...names, ...defaultProperties.filter((name) => !names.includes(name) && !blockedNames.has(name))]
    : [...names]

  return {
    names,
    known,
    blocked,
    // Only the formats of known properties, so `bgi` keeps none once the defaults are off
    formats: Object.fromEntries(Object.entries(formats).filter(([name]) => known.includes(name)))
  }
}

const resolveBlocked = (entries: readonly BlockedPropertyConfig[] | undefined): BlockedProperty[] => {
  const blocked: BlockedProperty[] = []

  entries?.forEach((entry) => {
    const { name, message } = typeof entry === 'string' ? { name: entry, message: undefined } : entry

    if (!isPropertyName(name)) {
      throw new Error(
        `[vue-uno-style] Invalid blocked property name ${JSON.stringify(name)}. `
        + 'Use a UnoCSS utility prefix made of letters, digits and dashes.'
      )
    }
    if (blocked.some((item) => item.name === name)) {
      throw new Error(`[vue-uno-style] Property "${name}" is blocked more than once.`)
    }
    if (message !== undefined && typeof message !== 'string') {
      throw new Error(`[vue-uno-style] The message for blocked property "${name}" must be a string.`)
    }

    blocked.push(message ? { name, message } : { name })
  })

  return blocked
}

/**
 * The blocked entry for `name`, if the project blocks it. Tolerates properties resolved before
 * 0.4.0, which have no `blocked` list.
 */
export const findBlocked = (properties: (Pick<ResolvedProperties, 'names'> & Partial<Pick<ResolvedProperties, 'blocked'>>) | undefined, name: string): BlockedProperty | undefined =>
  properties?.blocked?.find((item) => item.name === name)

/**
 * Whether the directive knows `name`. Properties resolved before 0.4.0 have no `known` list, so
 * their configured `names` stand in for it.
 */
export const isKnownProperty = (properties: Pick<ResolvedProperties, 'names'> & Partial<Pick<ResolvedProperties, 'known'>>, name: string): boolean =>
  (properties.known ?? properties.names).includes(name)

/** The sentence every report of a blocked property uses, with its message when it has one. */
export const blockedPropertyMessage = ({ name, message }: BlockedProperty): string =>
  `Property "${name}" is blocked in this project.${message ? ` ${message}` : ''}`

/** Applies a property's configured format to one runtime value. */
export const formatValue = <T>(value: T, format: PropertyFormat | undefined): T | string =>
  format === 'url' ? `url(${String(value)})` : value
