import type { BreakpointConfig } from './core/breakpoints'
import type { PropertyConfig } from './core/properties'
import type { Variant } from 'unocss'
import { definePreset } from 'unocss'
import { resolveBreakpoints } from './core/breakpoints'
import { resolveProperties } from './core/properties'
import { getVarsClasses } from './core/varsClasses'

export interface PresetVUnoStyleOptions {
  /**
   * Every UnoCSS utility prefix the directive may set, e.g. `['c', 'bg', 'p']`. Each needs a
   * UnoCSS rule that accepts a `<prefix>-$<variable>` value. Required: the classes are composed at
   * runtime, so only the ones safelisted from this list get CSS.
   */
  properties: readonly PropertyConfig[]
  /** Override breakpoints instead of reading them from the resolved UnoCSS theme. */
  breakpoints?: BreakpointConfig
  /** Explicitly select the unprefixed base breakpoint. */
  baseBreakpoint?: string
}

const overrideVariant: Variant = {
  name: 'vue-uno-style-override',
  match(matcher) {
    if (!matcher.startsWith('o:')) return

    return {
      matcher: matcher.slice(2),
      layer: 'override',
    }
  },
}

const toUnoBreakpoints = (breakpoints: BreakpointConfig): Record<string, string> =>
  Object.fromEntries(Object.entries(breakpoints).map(([name, value]) => [
    name,
    typeof value === 'number' ? `${value}px` : value,
  ]))

const createBreakpointVariant = (configuredBreakpoints?: BreakpointConfig): Variant => ({
  name: 'vue-uno-style-breakpoints',
  match(matcher, { theme }) {
    const breakpoints = configuredBreakpoints
      ?? (theme as { breakpoints?: BreakpointConfig }).breakpoints
    if (!breakpoints) return

    const match = Object.entries(breakpoints)
      .find(([name]) => matcher.startsWith(`${name}:`))
    if (!match) return

    const [name, value] = match
    const size = typeof value === 'number' ? `${value}px` : value

    return {
      matcher: matcher.slice(name.length + 1),
      parent: `@media (min-width: ${size})`,
    }
  },
})

/**
 * Adds the vue-uno-style variants, the safelist for the configured properties, and an explicit
 * layer order. Throws when no properties are configured.
 */
export const presetVUnoStyle = definePreset<PresetVUnoStyleOptions>((options) => {
  const { names } = resolveProperties(options?.properties)
  const { breakpoints, baseBreakpoint } = (options ?? {}) as Partial<PresetVUnoStyleOptions>
  const configuredBreakpoints = breakpoints
    ? toUnoBreakpoints(breakpoints)
    : undefined

  return {
    name: 'vue-uno-style',
    layers: {
      override: 10,
    },
    variants: [overrideVariant, createBreakpointVariant(configuredBreakpoints)],
    extendTheme: configuredBreakpoints
      ? (theme) => ({ ...theme, breakpoints: configuredBreakpoints })
      : undefined,
    safelist: [({ theme }) => {
      const available = configuredBreakpoints
        ?? (theme as { breakpoints?: BreakpointConfig }).breakpoints
      if (!available) {
        throw new Error(
          '[vue-uno-style] No breakpoints found. Configure theme.breakpoints or pass breakpoints to presetVUnoStyle().',
        )
      }

      const resolved = resolveBreakpoints({
        breakpoints: available,
        baseBreakpoint,
      })

      return names.flatMap((prop) => getVarsClasses(prop, resolved).split(' '))
    }],
  }
})
