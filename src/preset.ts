import type { BreakpointConfig } from './core/breakpoints'
import type { Rule, Variant } from 'unocss'
import { definePreset } from 'unocss'
import { resolveBreakpoints } from './core/breakpoints'
import { styleProps } from './core/getStyle'
import { getVarsClasses } from './core/varsClasses'

export interface PresetVUnoStyleOptions {
  /** Override breakpoints instead of reading them from the resolved UnoCSS theme. */
  breakpoints?: BreakpointConfig
  /** Explicitly select the unprefixed base breakpoint. */
  baseBreakpoint?: string
}

const overrideVariant: Variant = {
  name: 'v-uno-style-override',
  match(matcher) {
    if (!matcher.startsWith('o:')) return

    return {
      matcher: matcher.slice(2),
      layer: 'override',
    }
  },
}

const variableRules: Rule[] = [
  [/^bgi-\$(.+)$/, ([, name]) => ({ 'background-image': `var(--${name})` })],
  [/^bgv-\$(.+)$/, ([, name]) => ({ background: `var(--${name})` })],
]

const toUnoBreakpoints = (breakpoints: BreakpointConfig): Record<string, string> =>
  Object.fromEntries(Object.entries(breakpoints).map(([name, value]) => [
    name,
    typeof value === 'number' ? `${value}px` : value,
  ]))

const createBreakpointVariant = (configuredBreakpoints?: BreakpointConfig): Variant => ({
  name: 'v-uno-style-breakpoints',
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
 * Adds the v-uno-style variant, variable rules, safelist, and explicit layer order.
 */
export const presetVUnoStyle = definePreset<PresetVUnoStyleOptions>((options = {}) => {
  const configuredBreakpoints = options.breakpoints
    ? toUnoBreakpoints(options.breakpoints)
    : undefined

  return {
    name: 'v-uno-style',
    layers: {
      override: 10,
    },
    variants: [overrideVariant, createBreakpointVariant(configuredBreakpoints)],
    rules: variableRules,
    extendTheme: configuredBreakpoints
      ? (theme) => ({ ...theme, breakpoints: configuredBreakpoints })
      : undefined,
    safelist: [({ theme }) => {
      const breakpoints = configuredBreakpoints
        ?? (theme as { breakpoints?: BreakpointConfig }).breakpoints
      if (!breakpoints) {
        throw new Error(
          '[v-uno-style] No breakpoints found. Configure theme.breakpoints or pass breakpoints to presetVUnoStyle().',
        )
      }

      const resolved = resolveBreakpoints({
        breakpoints,
        baseBreakpoint: options.baseBreakpoint,
      })

      return styleProps.flatMap((prop) => getVarsClasses(prop, resolved).split(' '))
    }],
  }
})
