import { defineConfig, presetWind3 } from 'unocss'

export default defineConfig({
  presets: [presetWind3()],
  theme: {
    breakpoints: {
      sm: '0px',
      md: '768px',
      lg: '1024px',
    },
  },
})
