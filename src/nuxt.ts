import type { BreakpointConfig } from './core/breakpoints'
import type { PresetVUnoStyleOptions } from './preset'
import type { UnocssNuxtOptions } from '@unocss/nuxt'
import type { UserConfig } from 'unocss'
import { resolve } from 'node:path'
import { addPluginTemplate, defineNuxtModule, hasNuxtModule, useLogger } from '@nuxt/kit'
import { loadConfig } from '@unocss/config'
import { createGenerator } from 'unocss'
import { resolveBreakpoints } from './core/breakpoints'
import { resolveProperties } from './core/properties'
import { createWebTypes, serializeWebTypes } from './core/webTypes'
import { presetVUnoStyle } from './preset'
import { packageWebTypesPath, writeWebTypes } from './webTypes'

declare const __PACKAGE_VERSION__: string

export interface VUnoStyleNuxtModuleOptions extends PresetVUnoStyleOptions {
  /** Directive registration name without the `v-` prefix. */
  directiveName?: string
  /**
   * Rewrite the package's own `web-types.json` with `directiveName`, so WebStorm completes the
   * directive under the name the app registers. Nothing is written to the project. Set `false`
   * to keep the shipped file, which describes the default `uno-style` name.
   */
  webTypes?: boolean
}

/**
 * Points the package's WebStorm completion at the registered directive name. A failure only costs
 * completion, so it is logged rather than thrown - `node_modules` can be read-only (Docker, Nix)
 * or absent (Yarn PnP).
 */
const syncWebTypes = (directiveName: string, properties: string[]) => {
  const file = packageWebTypesPath()
  const contents = serializeWebTypes(createWebTypes({
    directiveName,
    properties,
    version: typeof __PACKAGE_VERSION__ === 'string' ? __PACKAGE_VERSION__ : '0.0.0-dev',
  }))

  try {
    writeWebTypes(file, contents)
  }
  catch (error) {
    useLogger('vue-uno-style').warn(
      `Could not update ${file}, so WebStorm may not complete v-${directiveName}. `
      + `${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

const isVUnoStylePreset = (preset: unknown): boolean => {
  if (Array.isArray(preset)) return preset.some(isVUnoStylePreset)
  return typeof preset === 'object'
    && preset !== null
    && 'name' in preset
    && preset.name === 'vue-uno-style'
}

const hasPreset = (config: UserConfig) => config.presets?.some(isVUnoStylePreset) ?? false

const addPreset = (config: UserConfig, preset: NonNullable<UserConfig['presets']>[number]) => {
  if (!hasPreset(config)) config.presets = [...(config.presets ?? []), preset]
}

const hasResolvedPreset = (config: UserConfig) => config.variants?.some(
  (variant) => typeof variant === 'object'
    && variant !== null
    && 'name' in variant
    && variant.name === 'vue-uno-style-override',
) ?? false

const addResolvedPreset = (
  config: UserConfig,
  preset: ReturnType<typeof presetVUnoStyle>,
) => {
  if (hasResolvedPreset(config)) return

  config.layers = { ...(config.layers ?? {}), ...(preset.layers ?? {}) }
  config.variants = [...(config.variants ?? []), ...(preset.variants ?? [])]
  config.rules = [...(config.rules ?? []), ...(preset.rules ?? [])]
  config.safelist = [...(config.safelist ?? []), ...(preset.safelist ?? [])]

  if (typeof preset.extendTheme === 'function') {
    const theme = config.theme ?? {}
    config.theme = preset.extendTheme(theme, config as never) ?? theme
  }
}

const getThemeBreakpoints = (theme: unknown): BreakpointConfig => {
  if (!theme || typeof theme !== 'object') {
    throw new Error('[vue-uno-style] The resolved UnoCSS theme has no breakpoints.')
  }

  const breakpoints = (theme as { breakpoints?: unknown }).breakpoints
  if (
    !breakpoints
    || typeof breakpoints !== 'object'
    || Array.isArray(breakpoints)
    || Object.keys(breakpoints).length === 0
    || Object.values(breakpoints).some(
      (value) => typeof value !== 'string' && typeof value !== 'number',
    )
  ) {
    throw new Error('[vue-uno-style] The resolved UnoCSS theme has no valid breakpoints.')
  }

  return breakpoints as BreakpointConfig
}

const renderRuntimePlugin = (
  directiveName: string,
  breakpoints: BreakpointConfig,
  baseBreakpoint: string,
  properties: VUnoStyleNuxtModuleOptions['properties'],
) => `import { defineNuxtPlugin } from '#app'
import { createVUnoStyle } from 'vue-uno-style'

const directive = createVUnoStyle(${JSON.stringify({ breakpoints, baseBreakpoint, properties })})

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.directive(${JSON.stringify(directiveName)}, directive)
})
`

/**
 * Registers the vue-uno-style preset and a directive configured from the resolved UnoCSS theme.
 */
export default defineNuxtModule<VUnoStyleNuxtModuleOptions>({
  meta: {
    name: 'vue-uno-style',
    configKey: 'vUnoStyle',
    compatibility: {
      nuxt: '>=3.17.0',
    },
  },
  defaults: {
    directiveName: 'uno-style',
    webTypes: true,
  },
  setup(options, nuxt) {
    // Fails the build here, naming the option, when no properties are configured
    const { names } = resolveProperties(options.properties)

    if (options.webTypes !== false) syncWebTypes(options.directiveName ?? 'uno-style', names)

    const preset = presetVUnoStyle({
      properties: options.properties,
      breakpoints: options.breakpoints,
      baseBreakpoint: options.baseBreakpoint,
    })

    // @unocss/nuxt captures this options object during module setup and reads
    // it later in build:before. Adding the preset here covers both module
    // orders; the hook below also covers config loaded from uno.config.*.
    const unoModuleOptions = (nuxt.options.unocss ??= {}) as UnocssNuxtOptions
    addPreset(unoModuleOptions, preset)

    nuxt.hook('unocss:config', (config) => {
      // @unocss/nuxt fires this hook after resolving configured presets. Merge
      // the concrete fields so the late addition is not left unexpanded.
      addResolvedPreset(config, preset)
    })

    nuxt.hook('modules:done', async () => {
      if (!hasNuxtModule('unocss', nuxt)) {
        throw new Error(
          '[vue-uno-style] The Nuxt module requires @unocss/nuxt to be installed and registered.',
        )
      }

      const unoOptions = (nuxt.options.unocss ?? {}) as UnocssNuxtOptions
      const configSource = unoOptions.configFile === false
        ? unoOptions
        : typeof unoOptions.configFile === 'string'
          ? { configFile: resolve(nuxt.options.rootDir, unoOptions.configFile) }
          : nuxt.options.rootDir
      const defaults = unoOptions.configFile === false ? {} : unoOptions
      const { config } = await loadConfig(
        nuxt.options.rootDir,
        configSource,
        [],
        defaults,
      )
      addPreset(config, preset)

      const generator = await createGenerator(config)
      const breakpoints = options.breakpoints ?? getThemeBreakpoints(generator.config.theme)
      const resolved = resolveBreakpoints({
        breakpoints,
        baseBreakpoint: options.baseBreakpoint,
      })

      addPluginTemplate({
        filename: 'vue-uno-style.mjs',
        getContents: () => renderRuntimePlugin(
          options.directiveName ?? 'uno-style',
          breakpoints,
          resolved.base,
          options.properties,
        ),
      })
    })
  },
})
