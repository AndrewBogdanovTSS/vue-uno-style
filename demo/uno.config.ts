import { defineConfig, presetWind3 } from 'unocss'

export default defineConfig({
  presets: [presetWind3()],
  rules: [
    // presetWind3 has no `<prefix>-$<variable>` form for these, so the demo defines its own
    [/^bgi-\$(.+)$/, ([, name]) => ({ 'background-image': `var(--${name})` })],
    [/^bgv-\$(.+)$/, ([, name]) => ({ background: `var(--${name})` })],
  ],
  theme: {
    breakpoints: {
      sm: '0px',
      md: '768px',
      lg: '1024px',
    },
  },
})
