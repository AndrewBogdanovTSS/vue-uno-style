import type { Preset } from 'unocss'
import { presetMini, presetWind3, presetWind4 } from 'unocss'

/** A base preset the package supports, with the facts the tests need about it. */
export interface BasePreset {
  name: 'presetMini' | 'presetWind3' | 'presetWind4'
  /** The name UnoCSS lists the preset under in a resolved config. */
  packageName: string
  preset: () => Preset
  /** Where the preset keeps breakpoints in its theme. */
  themeKey: 'breakpoint' | 'breakpoints'
  /** The preset's own breakpoints, used when the app configures none. */
  defaults: Record<string, string>
}

const tailwind3Defaults = { 'sm': '640px', 'md': '768px', 'lg': '1024px', 'xl': '1280px', '2xl': '1536px' }

export const basePresets: BasePreset[] = [
  { name: 'presetMini', packageName: '@unocss/preset-mini', preset: presetMini, themeKey: 'breakpoints', defaults: tailwind3Defaults },
  { name: 'presetWind3', packageName: '@unocss/preset-wind3', preset: presetWind3, themeKey: 'breakpoints', defaults: tailwind3Defaults },
  {
    name: 'presetWind4',
    packageName: '@unocss/preset-wind4',
    preset: presetWind4,
    themeKey: 'breakpoint',
    defaults: { 'sm': '40rem', 'md': '48rem', 'lg': '64rem', 'xl': '80rem', '2xl': '96rem' }
  }
]

/**
 * The `min-width` of every media block in one layer, in the order the CSS emits them. Equal
 * selectors cascade by source order, so this order decides which breakpoint's value wins.
 */
export const mediaOrder = (css: string, layer = 'override'): string[] => {
  const start = css.indexOf(`/* layer: ${layer} */`)
  if (start === -1) return []
  const end = css.indexOf('/* layer:', start + 1)
  const block = css.slice(start, end === -1 ? undefined : end)

  return [...block.matchAll(/@media \(min-width: ([^)]+)\)/g)].map((match) => match[1])
}
