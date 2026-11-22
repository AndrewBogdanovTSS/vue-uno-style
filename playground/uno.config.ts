import type { Rule } from 'unocss'
import process from 'node:process'
import { defineConfig, presetMini, presetWind3, presetWind4 } from 'unocss'
import { breakpoints } from './config/vue-uno-style.ts'

// None of the presets has a `<prefix>-$<variable>` form for these, so the playground defines
// its own. `[\w-]+` rather than `.+`: UnoCSS also scans prose, and `bgi-$*` there would become
// `var(--*)`.
const rules: Rule[] = [
  [/^bgi-\$([\w-]+)$/, ([, name]) => ({ 'background-image': `var(--${name})` })],
  [/^bgv-\$([\w-]+)$/, ([, name]) => ({ background: `var(--${name})` })]
]

/**
 * `PLAYGROUND_PRESET` picks the base preset, so CI can verify the playground under each one the
 * package supports. presetWind3 is the default, and the one GitHub Pages deploys.
 *
 * presetWind4 keeps breakpoints under `theme.breakpoint` (singular), the others under
 * `theme.breakpoints`. Its reset is off, to match the others, which ship none.
 *
 * Each preset gets its own `defineConfig` call, so each config takes its theme type from its
 * preset. One call over a union of the three cannot infer a theme all of them accept.
 */
const configs = {
  mini: () => defineConfig({
    presets: [presetMini({ preflight: 'on-demand' })],
    rules,
    theme: { breakpoints }
  }),
  wind3: () => defineConfig({
    presets: [presetWind3({ preflight: 'on-demand' })],
    rules,
    theme: { breakpoints }
  }),
  wind4: () => defineConfig({
    presets: [presetWind4({ preflights: { reset: false } })],
    rules,
    theme: { breakpoint: breakpoints }
  })
}

const preset = process.env.PLAYGROUND_PRESET ?? 'wind3'

if (!Object.hasOwn(configs, preset)) {
  throw new Error(`PLAYGROUND_PRESET must be mini, wind3 or wind4, not "${process.env.PLAYGROUND_PRESET}".`)
}

export default configs[preset as keyof typeof configs]()
