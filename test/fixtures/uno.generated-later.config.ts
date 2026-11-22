// Stands in for a root `uno.config.ts` that imports a file Nuxt generates later, such as
// `.nuxt/uno.config.mjs` under `@unocss/nuxt`'s `nuxtLayers`: on a fresh checkout the import
// fails until Nuxt has written its templates.
throw new Error('Cannot find module \'./.nuxt/uno.config.mjs\'')
