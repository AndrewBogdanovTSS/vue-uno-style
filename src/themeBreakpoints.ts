import type { BreakpointConfig } from './core/breakpoints'

/**
 * The theme key a UnoCSS preset keeps its breakpoints under: `breakpoint` in presetWind4,
 * `breakpoints` in presetMini and presetWind3.
 */
export type BreakpointThemeKey = 'breakpoint' | 'breakpoints'

type BreakpointTheme = Partial<Record<BreakpointThemeKey, BreakpointConfig>>

export interface ThemeBreakpointContext {
  /** The resolved theme: every preset's theme merged with the user's. */
  theme: unknown
  /** The generator, whose `userConfig.theme` is the user's theme before that merge. */
  generator?: { userConfig?: { theme?: unknown } }
}

/** Picks the key the same way `@unocss/rule-utils` does: `breakpoint` whenever the theme has one. */
export const breakpointThemeKey = (theme: unknown): BreakpointThemeKey =>
  (theme as BreakpointTheme | undefined)?.breakpoint != null ? 'breakpoint' : 'breakpoints'

/**
 * Reads breakpoints the way UnoCSS's own breakpoint variants do (`resolveBreakpoints` in
 * `@unocss/rule-utils`): the user's theme value replaces the preset's defaults instead of merging
 * with them.
 *
 * Reading the merged theme instead keeps the base preset's `xl` and `2xl` next to a user's own
 * `sm`/`md`/`lg`. The safelist then holds classes for breakpoints UnoCSS's variant does not know,
 * and their media blocks land outside breakpoint order, so an `xl` value never beats `lg`.
 */
export const resolveThemeBreakpoints = ({ theme, generator }: ThemeBreakpointContext): BreakpointConfig | undefined => {
  const key = breakpointThemeKey(theme)
  const userTheme = generator?.userConfig?.theme as BreakpointTheme | undefined

  return userTheme?.[key] || (theme as BreakpointTheme | undefined)?.[key]
}
