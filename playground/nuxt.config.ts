import { blockedProperties, properties } from './config/vue-uno-style.ts'

export default defineNuxtConfig({
  compatibilityDate: '2026-11-01',
  devtools: { enabled: true },
  modules: ['@unocss/nuxt', 'vue-uno-style/nuxt'],
  vUnoStyle: { properties, blockedProperties }
})
