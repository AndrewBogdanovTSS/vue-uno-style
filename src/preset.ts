import type { BreakpointConfig } from './core/breakpoints'
import type { PropertyConfig } from './core/properties'
import type { Variant } from 'unocss'
import { definePreset } from 'unocss'
import { resolveBreakpoints } from './core/breakpoints'
import { resolveProperties } from './core/properties'
import { getVarsClasses, VARIANT_PREFIX } from './core/varsClasses'
import { breakpointThemeKey, resolveThemeBreakpoints } from './themeBreakpoints'

export interface PresetVUnoStyleOptions {
  /**
   * Every UnoCSS utility prefix the directive may set, e.g. `['c', 'bg', 'p']`. Each needs a
   * UnoCSS rule that accepts a `<prefix>-$<variable>` value. Required: the classes are composed at
   * runtime, so only the ones safelisted from this list get CSS.
   */
  properties: readonly PropertyConfig[]
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
 * Adds the `vs:` variant and its layer, the breakpoint variant, and the safelist for the
 * configured properties. Throws when no properties are configured.
 */
export const presetVUnoStyle = definePreset<PresetVUnoStyleOptions>((options) => {
  const { names } = resolveProperties(options?.properties)
  const { breakpoints, baseBreakpoint, layer = DEFAULT_LAYER } = (options ?? {}) as Partial<PresetVUnoStyleOptions>
  const configuredBreakpoints = breakpoints
    ? toUnoBreakpoints(breakpoints)
    : undefined

  return {
    name: 'vue-uno-style',
    layers: {
      [layer]: 10
    },
    variants: [createLayerVariant(layer), createBreakpointVariant(configuredBreakpoints)],
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

      return names.flatMap((prop) => getVarsClasses(prop, resolved).split(' '))
    }]
  }
})
