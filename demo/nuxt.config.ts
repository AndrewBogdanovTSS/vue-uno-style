import properties from './properties.js'

export default defineNuxtConfig({
  compatibilityDate: '2026-09-18',
  devtools: { enabled: false },
  modules: ['@unocss/nuxt', 'vue-uno-style/nuxt'],
  vUnoStyle: {
    properties,
  },
})
