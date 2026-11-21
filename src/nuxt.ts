import type { BreakpointConfig } from './core/breakpoints'
import type { DevtoolsContext, WebTypesStatus } from './devtools/server'
import type { PresetVUnoStyleOptions } from './preset'
import type { UnocssNuxtOptions } from '@unocss/nuxt'
import type { UserConfig } from 'unocss'
import { resolve } from 'node:path'
import { addPluginTemplate, addVitePlugin, defineNuxtModule, hasNuxtModule, useLogger } from '@nuxt/kit'
import { loadConfig } from '@unocss/config'
import { createGenerator } from 'unocss'
import { resolveBreakpoints } from './core/breakpoints'
import { resolveProperties } from './core/properties'
import { createWebTypes, serializeWebTypes } from './core/webTypes'
import { createDevtoolsData, createDevtoolsMiddleware, DEVTOOLS_ROUTE, generateSample } from './devtools/server'
import { presetVUnoStyle } from './preset'
import { resolveThemeBreakpoints } from './themeBreakpoints'
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
  /**
   * Adds a vue-uno-style tab to Nuxt DevTools during `nuxt dev`: the resolved config, rule
   * coverage, every directive on the page, warnings, a timeline and a REPL. Has no effect on
   * production builds, or when Nuxt DevTools is off. Set `false` to leave it out.
   */
  devtools?: boolean
}

const version = () => typeof __PACKAGE_VERSION__ === 'string' ? __PACKAGE_VERSION__ : '0.0.0-dev'

/**
 * Points the package's WebStorm completion at the registered directive name. A failure only costs
 * completion, so it is logged rather than thrown - `node_modules` can be read-only (Docker, Nix)
 * or absent (Yarn PnP).
 */
const syncWebTypes = (directiveName: string, properties: string[]): WebTypesStatus => {
  const file = packageWebTypesPath()
  const contents = serializeWebTypes(createWebTypes({
    directiveName,
    properties,
    version: version(),
  }))

  try {
    return { status: writeWebTypes(file, contents), file }
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    useLogger('vue-uno-style').warn(
      `Could not update ${file}, so WebStorm may not complete v-${directiveName}. ${message}`,
    )
    return { status: 'failed', file, error: message }
  }
}

/** Mirrors how Nuxt reads its own `devtools` option: on unless `false` or `enabled: false`. */
const isNuxtDevtoolsEnabled = (devtools: unknown) => typeof devtools === 'boolean'
  ? devtools
  : (devtools as { enabled?: boolean } | undefined)?.enabled !== false

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

const toArray = <T>(value: T | T[]): T[] => Array.isArray(value) ? value : [value]

const addResolvedPreset = (
  config: UserConfig,
  preset: ReturnType<typeof presetVUnoStyle>,
) => {
  if (hasResolvedPreset(config)) return

  config.layers = { ...(config.layers ?? {}), ...(preset.layers ?? {}) }
  config.variants = [...(config.variants ?? []), ...(preset.variants ?? [])]
  config.rules = [...(config.rules ?? []), ...(preset.rules ?? [])]
  config.safelist = [...(config.safelist ?? []), ...(preset.safelist ?? [])]

  // Queued rather than applied here: `config.theme` is only the user's theme, while the preset
  // needs the merged one to tell presetWind4's `breakpoint` key from the others' `breakpoints`.
  if (preset.extendTheme) {
    config.extendTheme = [...toArray(config.extendTheme ?? []), ...toArray(preset.extendTheme)]
  }
}

const getThemeBreakpoints = (generator: Awaited<ReturnType<typeof createGenerator>>): BreakpointConfig => {
  const { theme } = generator.config
  if (!theme || typeof theme !== 'object') {
    throw new Error('[vue-uno-style] The resolved UnoCSS theme has no breakpoints.')
  }

  const breakpoints: unknown = resolveThemeBreakpoints({ theme, generator })
  if (
    !breakpoints
    || typeof breakpoints !== 'object'
    || Array.isArray(breakpoints)
    || Object.keys(breakpoints).length === 0
    || Object.values(breakpoints).some(
      (value) => typeof value !== 'string' && typeof value !== 'number',
    )
  ) {
    throw new Error(
      '[vue-uno-style] The resolved UnoCSS theme has no valid breakpoints. '
      + 'Configure theme.breakpoints (theme.breakpoint with presetWind4) or pass breakpoints.',
    )
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
 * The development variant of the runtime plugin: on the client it wraps the directive with the
 * DevTools registry and provides the registry as `$vUnoStyleDevtools`. Server rendering keeps
 * the plain directive.
 */
const renderDevtoolsRuntimePlugin = (
  directiveName: string,
  breakpoints: BreakpointConfig,
  baseBreakpoint: string,
  properties: VUnoStyleNuxtModuleOptions['properties'],
) => `import { defineNuxtPlugin } from '#app'
import { createVUnoStyle } from 'vue-uno-style'
import { createDevtoolsRegistry } from 'vue-uno-style/devtools'

const options = ${JSON.stringify({ breakpoints, baseBreakpoint, properties })}
const directive = createVUnoStyle(options)

export default defineNuxtPlugin((nuxtApp) => {
  if (import.meta.client) {
    const { registry, instrument } = createDevtoolsRegistry(options)
    nuxtApp.vueApp.directive(${JSON.stringify(directiveName)}, instrument(directive))
    nuxtApp.provide('vUnoStyleDevtools', registry)
    return
  }
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
    devtools: true,
  },
  setup(options, nuxt) {
    // Fails the build here, naming the option, when no properties are configured
    const resolvedProperties = resolveProperties(options.properties)
    const { names } = resolvedProperties
    const directiveName = options.directiveName ?? 'uno-style'

    const webTypes: WebTypesStatus = options.webTypes !== false
      ? syncWebTypes(directiveName, names)
      : { status: 'disabled' }

    const devtools = Boolean(nuxt.options.dev)
      && options.devtools !== false
      && isNuxtDevtoolsEnabled(nuxt.options.devtools)

    // Filled in modules:done, once the UnoCSS config is loaded; requests wait for it
    let resolveDevtoolsContext: (context: DevtoolsContext) => void = () => {}
    const devtoolsContext = new Promise<DevtoolsContext>((resolve) => {
      resolveDevtoolsContext = resolve
    })

    if (devtools) {
      let data: ReturnType<typeof createDevtoolsData> | undefined
      const middleware = createDevtoolsMiddleware({
        getData: async () => (data ??= createDevtoolsData(await devtoolsContext)),
        generate: async (input) => generateSample(await devtoolsContext, input),
      })

      addVitePlugin({
        name: 'vue-uno-style:devtools',
        apply: 'serve',
        configureServer(server: { middlewares: { use: (handler: typeof middleware) => void } }) {
          server.middlewares.use(middleware)
        },
      } as never, { server: false })

      // The hook `@nuxt/devtools-kit`'s addCustomTab wraps; it only fires when DevTools runs
      nuxt.hook('devtools:customTabs' as never, ((tabs: unknown[]) => {
        tabs.push({
          name: 'vue-uno-style',
          title: 'vue-uno-style',
          icon: 'carbon:color-palette',
          view: { type: 'iframe', src: `${DEVTOOLS_ROUTE}/` },
        })
      }) as never)
    }

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
      const { config, sources } = await loadConfig(
        nuxt.options.rootDir,
        configSource,
        [],
        defaults,
      )
      // The module's own preset object reaches this config through the defaults; any other
      // vue-uno-style preset is one the app configured itself
      const presetSource = config.presets?.some((item) => item !== preset && isVUnoStylePreset(item))
        ? 'config'
        : 'module'
      addPreset(config, preset)

      const generator = await createGenerator(config)
      const breakpoints = options.breakpoints ?? getThemeBreakpoints(generator)
      const resolved = resolveBreakpoints({
        breakpoints,
        baseBreakpoint: options.baseBreakpoint,
      })

      addPluginTemplate({
        filename: 'vue-uno-style.mjs',
        getContents: () => (devtools ? renderDevtoolsRuntimePlugin : renderRuntimePlugin)(
          directiveName,
          breakpoints,
          resolved.base,
          options.properties,
        ),
      })

      if (devtools) {
        resolveDevtoolsContext({
          version: version(),
          directiveName,
          properties: resolvedProperties,
          breakpoints,
          breakpointSource: options.breakpoints ? 'option' : 'theme',
          resolved,
          preset: presetSource,
          configSources: sources,
          webTypes,
          generator,
        })
      }
    })
  },
})
