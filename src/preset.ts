import type { BreakpointConfig } from './core/breakpoints'
import type { BlockedPropertyConfig, PropertyConfig } from './core/properties'
import type { Extractor, Variant } from 'unocss'
import { definePreset } from 'unocss'
import { resolveBreakpoints } from './core/breakpoints'
import { resolveProperties } from './core/properties'
import { findUsedProperties } from './core/usage'
import { getVarsClasses, VARIANT_PREFIX } from './core/varsClasses'
import { builtInRuleList } from './knownRules'
import { breakpointThemeKey, resolveThemeBreakpoints } from './themeBreakpoints'

export interface PresetVUnoStyleOptions {
  /**
   * UnoCSS utility prefixes the preset always safelists, e.g. `['c', 'bg', 'p']`, on top of the
   * default properties. Each needs a UnoCSS rule that accepts a `<prefix>-$<variable>` value.
   * List a property here when it reaches the directive only through data, such as
   * `v-uno-style="block.styles"`, or when it is not a default property.
   */
  properties?: readonly PropertyConfig[]
  /**
   * Whether the default properties are known. Defaults to `true`: the preset then safelists each
   * one it finds in the source. With `false`, only `properties` are known and safelisted.
   */
  defaultProperties?: boolean
  /**
   * Properties the project forbids, with an optional message: `['tracking', { name: 'opacity',
   * message: 'Use op instead.' }]`. A blocked property is never known, even a default one.
   */
  blockedProperties?: readonly BlockedPropertyConfig[]
  /**
   * Directive registration name without the `v-` prefix, so the preset finds the properties the
   * source sets. Defaults to `uno-style`. The Nuxt module passes its own.
   */
  directiveName?: string
  /**
   * Override breakpoints instead of reading them from the UnoCSS theme (`theme.breakpoint` in
   * presetWind4, `theme.breakpoints` otherwise). They replace that theme key, so the base preset's
   * own breakpoint variants use them too.
   */
  breakpoints?: BreakpointConfig
  /** Explicitly select the unprefixed base breakpoint. */
  baseBreakpoint?: string
  /**
   * The UnoCSS layer the `vs:` classes go to, ordered after `default`. Defaults to
   * `v-uno-style`. Name it after the directive, e.g. `v-style` for `directiveName: 'style'`,
   * so the CSS says which directive wrote it. The Nuxt module does this on its own.
   */
  layer?: string
}

/** The layer of the `vs:` classes when `layer` is not set. */
export const DEFAULT_LAYER = 'v-uno-style'

/** The directive's registration name when `directiveName` is not set. */
export const DEFAULT_DIRECTIVE_NAME = 'uno-style'

const createLayerVariant = (layer: string): Variant => ({
  name: 'vue-uno-style-layer',
  match(matcher) {
    if (!matcher.startsWith(VARIANT_PREFIX)) return

    return {
      matcher: matcher.slice(VARIANT_PREFIX.length),
      layer
    }
  }
})

const toUnoBreakpoints = (breakpoints: BreakpointConfig): Record<string, string> =>
  Object.fromEntries(Object.entries(breakpoints).map(([name, value]) => [
    name,
    typeof value === 'number' ? `${value}px` : value
  ]))

/**
 * Serves breakpoint prefixes no base preset handles, such as names used without presetMini,
 * presetWind3 or presetWind4. With those presets their own variant usually matches first, since
 * `extendTheme` hands them the configured breakpoints.
 */
const createBreakpointVariant = (configuredBreakpoints?: BreakpointConfig): Variant => ({
  name: 'vue-uno-style-breakpoints',
  match(matcher, context) {
    const breakpoints = configuredBreakpoints ?? resolveThemeBreakpoints(context)
    if (!breakpoints) return

    const entries = Object.entries(breakpoints)
    const index = entries.findIndex(([name]) => matcher.startsWith(`${name}:`))
    if (index === -1) return

    const [name, value] = entries[index]
    const size = typeof value === 'number' ? `${value}px` : value

    return {
      matcher: matcher.slice(name.length + 1),
      // UnoCSS sorts media blocks by this order, and falls back to comparing them as strings,
      // which puts `1200px` before `768px` and lets the narrower breakpoint win. The scale
      // matches `@unocss/rule-utils`, so these blocks interleave with the base preset's own.
      parent: [`@media (min-width: ${size})`, 3000 + index + 1]
    }
  }
})

/**
 * Finds the known properties each scanned file sets through the directive and records them in
 * `used`, for the safelist to read. It also returns their base class, so a dev server that sees a
 * new property regenerates the CSS - which runs the safelist again.
 *
 * The extractor has no theme, so it cannot name the breakpoint classes itself.
 */
const createUsageExtractor = (directiveName: string, known: ReadonlySet<string>, used: Set<string>): Extractor => ({
  name: 'vue-uno-style-usage',
  extract({ code }) {
    const found = findUsedProperties(code, directiveName).filter((name) => known.has(name))
    found.forEach((name) => used.add(name))
    return found.map((name) => `${VARIANT_PREFIX}${name}-$${name}`)
  }
})

/**
 * Adds the `vs:` variant and its layer, the breakpoint variant, the `bgi` and `bgv` rules, and the
 * safelist: every configured property, and each known one the scanned source sets. Throws when no
 * property is known.
 */
export const presetVUnoStyle = definePreset<PresetVUnoStyleOptions | undefined>((options) => {
  const {
    breakpoints,
    baseBreakpoint,
    layer = DEFAULT_LAYER,
    directiveName = DEFAULT_DIRECTIVE_NAME,
    defaultProperties,
    blockedProperties
  } = options ?? {}
  const { names, known } = resolveProperties(options?.properties, { defaultProperties, blockedProperties })
  const configuredBreakpoints = breakpoints
    ? toUnoBreakpoints(breakpoints)
    : undefined
  // Filled while UnoCSS scans the source, read each time it generates the CSS
  const used = new Set<string>()

  return {
    name: 'vue-uno-style',
    layers: {
      [layer]: 10
    },
    variants: [createLayerVariant(layer), createBreakpointVariant(configuredBreakpoints)],
    extractors: [createUsageExtractor(directiveName, new Set(known), used)],
    // No base preset serves `bgi` or `bgv`. A rule writes CSS only for a class that is used.
    rules: builtInRuleList(),
    // Written under the key the base preset reads, so its own breakpoint variants serve the
    // configured values instead of their defaults.
    extendTheme: configuredBreakpoints
      ? (theme) => ({ ...theme, [breakpointThemeKey(theme)]: configuredBreakpoints })
      : undefined,
    safelist: [(context) => {
      const available = configuredBreakpoints ?? resolveThemeBreakpoints(context)
      if (!available) {
        throw new Error(
          '[vue-uno-style] No breakpoints found. Configure theme.breakpoints '
          + '(theme.breakpoint with presetWind4) or pass breakpoints to presetVUnoStyle().'
        )
      }

      const resolved = resolveBreakpoints({
        breakpoints: available,
        baseBreakpoint
      })

      const safelisted = new Set([...names, ...used])
      return [...safelisted].flatMap((prop) => getVarsClasses(prop, resolved).split(' '))
    }]
  }
})
