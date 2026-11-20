import { defineConfig, presetWind3 } from 'unocss'
import { breakpoints } from './vue-uno-style.config.js'

export default defineConfig({
  presets: [presetWind3({ preflight: 'on-demand' })],
  rules: [
    // presetWind3 has no `<prefix>-$<variable>` form for these, so the playground defines its own.
    // `[\w-]+` rather than `.+`: UnoCSS also scans prose, and `bgi-$*` there would become `var(--*)`.
    [/^bgi-\$([\w-]+)$/, ([, name]) => ({ 'background-image': `var(--${name})` })],
    [/^bgv-\$([\w-]+)$/, ([, name]) => ({ background: `var(--${name})` })],
  ],
  theme: { breakpoints },
})
