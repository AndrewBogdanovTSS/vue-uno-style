import process from 'node:process'
import { defineConfig, presetMini, presetWind3, presetWind4 } from 'unocss'
import { breakpoints } from './vue-uno-style.config.js'

/**
 * `PLAYGROUND_PRESET` picks the base preset, so CI can verify the playground under each one the
 * package supports. presetWind3 is the default, and the one GitHub Pages deploys.
 *
 * presetWind4 keeps breakpoints under `theme.breakpoint` (singular), the others under
 * `theme.breakpoints`. Its reset is off, to match the others, which ship none.
 */
const base = {
  mini: { preset: presetMini({ preflight: 'on-demand' }), theme: { breakpoints } },
  wind3: { preset: presetWind3({ preflight: 'on-demand' }), theme: { breakpoints } },
  wind4: { preset: presetWind4({ preflights: { reset: false } }), theme: { breakpoint: breakpoints } }
}[process.env.PLAYGROUND_PRESET ?? 'wind3']

if (!base) {
  throw new Error(`PLAYGROUND_PRESET must be mini, wind3 or wind4, not "${process.env.PLAYGROUND_PRESET}".`)
}

export default defineConfig({
  presets: [base.preset],
  rules: [
    // None of the presets has a `<prefix>-$<variable>` form for these, so the playground defines
    // its own. `[\w-]+` rather than `.+`: UnoCSS also scans prose, and `bgi-$*` there would become
    // `var(--*)`.
    [/^bgi-\$([\w-]+)$/, ([, name]) => ({ 'background-image': `var(--${name})` })],
    [/^bgv-\$([\w-]+)$/, ([, name]) => ({ background: `var(--${name})` })]
  ],
  theme: base.theme
})
