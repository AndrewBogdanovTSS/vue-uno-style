import type { BreakpointConfig } from './core/breakpoints'
import type { PresetVUnoStyleOptions } from './preset'
import type { UnocssNuxtOptions } from '@unocss/nuxt'
import type { UserConfig } from 'unocss'
import { resolve } from 'node:path'
import { addPluginTemplate, defineNuxtModule, hasNuxtModule } from '@nuxt/kit'
import { loadConfig } from '@unocss/config'
import { createGenerator } from 'unocss'
import { resolveBreakpoints } from './core/breakpoints'
import { presetVUnoStyle } from './preset'

export interface VUnoStyleNuxtModuleOptions extends PresetVUnoStyleOptions {
  /** Directive registration name without the `v-` prefix. */
  directiveName?: string
}

const isVUnoStylePreset = (preset: unknown): boolean => {
  if (Array.isArray(preset)) return preset.some(isVUnoStylePreset)
  return typeof preset === 'object'
    && preset !== null
    && 'name' in preset
    && preset.name === 'v-uno-style'
}

const hasPreset = (config: UserConfig) => config.presets?.some(isVUnoStylePreset) ?? false

const addPreset = (config: UserConfig, preset: NonNullable<UserConfig['presets']>[number]) => {
  if (!hasPreset(config)) config.presets = [...(config.presets ?? []), preset]
}

const getThemeBreakpoints = (theme: unknown): BreakpointConfig => {
  if (!theme || typeof theme !== 'object') {
    throw new Error('[v-uno-style] The resolved UnoCSS theme has no breakpoints.')
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
    throw new Error('[v-uno-style] The resolved UnoCSS theme has no valid breakpoints.')
  }

  return breakpoints as BreakpointConfig
}

const renderRuntimePlugin = (
  directiveName: string,
  breakpoints: BreakpointConfig,
  baseBreakpoint: string,
) => `import { defineNuxtPlugin } from '#app'
import { createVUnoStyle } from 'v-uno-style'

const directive = createVUnoStyle(${JSON.stringify({ breakpoints, baseBreakpoint })})

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.directive(${JSON.stringify(directiveName)}, directive)
})
`

/**
 * Registers the v-uno-style preset and a directive configured from the resolved UnoCSS theme.
 */
export default defineNuxtModule<VUnoStyleNuxtModuleOptions>({
  meta: {
    name: 'v-uno-style',
    configKey: 'vUnoStyle',
    compatibility: {
      nuxt: '>=3.17.0',
    },
  },
  defaults: {
    directiveName: 'uno-style',
  },
  setup(options, nuxt) {
    const preset = presetVUnoStyle({
      breakpoints: options.breakpoints,
      baseBreakpoint: options.baseBreakpoint,
    })

    nuxt.hook('unocss:config', (config) => {
      addPreset(config, preset)
    })

    nuxt.hook('modules:done', async () => {
      if (!hasNuxtModule('unocss', nuxt)) {
        throw new Error(
          '[v-uno-style] The Nuxt module requires @unocss/nuxt to be installed and registered.',
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
        filename: 'v-uno-style.mjs',
        getContents: () => renderRuntimePlugin(
          options.directiveName ?? 'uno-style',
          breakpoints,
          resolved.base,
        ),
      })
    })
  },
})
