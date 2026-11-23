import type { UserConfig } from 'unocss'
import { addPluginTemplate, hasNuxtModule } from '@nuxt/kit'
import { createGenerator, presetWind3 } from 'unocss'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { basePresets } from './fixtures/presets'

const warn = vi.fn()

vi.mock('@nuxt/kit', () => ({
  addPluginTemplate: vi.fn(),
  addVitePlugin: vi.fn(),
  defineNuxtModule: vi.fn((definition) => definition),
  hasNuxtModule: vi.fn(() => true),
  useLogger: vi.fn(() => ({ warn }))
}))

// The real writer targets the file next to the module, which is `src/` under test
vi.mock('../src/webTypes', () => ({
  packageWebTypesPath: vi.fn(() => '/pkg/dist/web-types.json'),
  writeWebTypes: vi.fn(() => 'written')
}))

import { defaultProperties } from '../src/core/properties'
import module from '../src/nuxt'
import { writeWebTypes } from '../src/webTypes'

type Hook = (...args: unknown[]) => unknown
type ModuleDefinition = {
  defaults: { directiveName: string, webTypes: boolean, devtools: boolean }
  meta: {
    name: string
    configKey: string
    compatibility: { nuxt: string }
  }
  setup: (
    options: {
      baseBreakpoint?: string
      breakpoints?: Record<string, number | string>
      directiveName?: string
      properties?: Array<string | { name: string, format?: 'url' }>
      defaultProperties?: boolean
      webTypes?: boolean
    },
    nuxt: unknown
  ) => unknown
}

const moduleDefinition = module as unknown as ModuleDefinition
const properties = ['c', 'bg', { name: 'bgi', format: 'url' as const }]

/** The source of the runtime plugin the module registered last. */
const pluginContents = async () => {
  const template = vi.mocked(addPluginTemplate).mock.calls.at(-1)?.[0]
  if (!template || typeof template === 'string') throw new Error('Expected a plugin template')
  expect(template).toEqual(expect.objectContaining({ filename: 'vue-uno-style.mjs' }))

  return template.getContents?.({} as never)
}

const createNuxt = (unocss: UserConfig & { configFile?: string | false } = {}) => {
  const hooks = new Map<string, Hook>()
  const nuxt = {
    options: {
      rootDir: process.cwd(),
      unocss: {
        configFile: false,
        ...unocss
      }
    },
    hook: vi.fn((name: string, callback: Hook) => hooks.set(name, callback))
  }

  return { hooks, nuxt }
}

const setupModule = async (
  options: Parameters<ModuleDefinition['setup']>[0],
  unocss?: UserConfig & { configFile?: string | false }
) => {
  const { hooks, nuxt } = createNuxt(unocss)

  await moduleDefinition.setup({ properties, ...options }, nuxt)

  return { hooks, nuxt }
}

describe('vue-uno-style Nuxt module', () => {
  beforeEach(() => {
    vi.mocked(addPluginTemplate).mockReset()
    vi.mocked(hasNuxtModule).mockReset()
    vi.mocked(hasNuxtModule).mockReturnValue(true)
    vi.mocked(writeWebTypes).mockReset()
    vi.mocked(writeWebTypes).mockReturnValue('written')
    warn.mockReset()
  })

  it('declares the module metadata and default directive name', () => {
    expect(moduleDefinition.meta).toEqual(expect.objectContaining({
      name: 'vue-uno-style',
      configKey: 'vUnoStyle',
      compatibility: { nuxt: '>=3.17.0' }
    }))
    expect(moduleDefinition.defaults).toEqual({ directiveName: 'uno-style', webTypes: true, devtools: true })
  })

  it('rewrites the package web-types with the registered directive name', async () => {
    await setupModule({ directiveName: 'style', webTypes: true })

    expect(writeWebTypes).toHaveBeenCalledTimes(1)
    const [file, contents] = vi.mocked(writeWebTypes).mock.calls[0]!
    const [directive] = JSON.parse(contents).contributions.html['vue-directives']

    expect(file).toBe('/pkg/dist/web-types.json')
    expect(directive.name).toBe('style')
    // The configured properties, then the defaults they do not repeat
    expect(directive.argument.pattern.or).toEqual([
      'c', 'bg', 'bgi', ...defaultProperties.filter((name) => !['c', 'bg', 'bgi'].includes(name))
    ])
  })

  it('offers only the configured properties once the defaults are off', async () => {
    await setupModule({ directiveName: 'style', webTypes: true, defaultProperties: false })

    const [, contents] = vi.mocked(writeWebTypes).mock.calls[0]!
    const [directive] = JSON.parse(contents).contributions.html['vue-directives']

    expect(directive.argument.pattern.or).toEqual(['c', 'bg', 'bgi'])
  })

  it.each([
    ['missing', undefined],
    ['empty', []]
  ])('fails the build when properties are %s and the defaults are off', async (_label, configured) => {
    const { nuxt } = createNuxt()

    await expect(async () => moduleDefinition.setup(
      { directiveName: 'style', properties: configured as never, defaultProperties: false },
      nuxt
    )).rejects.toThrow('No properties configured')
  })

  it('passes an empty list to the runtime directive when no properties are configured', async () => {
    const { hooks } = await setupModule({
      directiveName: 'style',
      breakpoints: { sm: 0, md: 768 },
      properties: undefined
    })

    await hooks.get('modules:done')?.()

    const template = vi.mocked(addPluginTemplate).mock.calls[0]?.[0]
    if (!template || typeof template === 'string') throw new Error('Expected a plugin template')
    const contents = await template.getContents?.({} as never)

    expect(contents).toContain('"properties":[]')
    expect(contents).not.toContain('defaultProperties')
  })

  it('passes the configured properties to the runtime directive', async () => {
    const { hooks } = await setupModule({
      directiveName: 'style',
      breakpoints: { sm: 0, md: 768 }
    })

    await hooks.get('modules:done')?.()

    const template = vi.mocked(addPluginTemplate).mock.calls[0]?.[0]
    if (!template || typeof template === 'string') throw new Error('Expected a plugin template')
    const contents = await template.getContents?.({} as never)

    expect(contents).toContain('"properties":["c","bg",{"name":"bgi","format":"url"}]')
  })

  it('leaves the shipped web-types alone when disabled', async () => {
    await setupModule({ directiveName: 'style', webTypes: false })

    expect(writeWebTypes).not.toHaveBeenCalled()
  })

  it('warns instead of failing when the web-types cannot be written', async () => {
    vi.mocked(writeWebTypes).mockImplementation(() => {
      throw new Error('EROFS: read-only file system')
    })

    await expect(setupModule({ directiveName: 'style', webTypes: true })).resolves.toBeDefined()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('EROFS: read-only file system'))
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('v-style'))
  })

  it('merges the preset into the UnoCSS config once', async () => {
    const { hooks, nuxt } = await setupModule(
      { directiveName: 'uno-style', baseBreakpoint: 'sm' },
      { presets: [presetWind3()] }
    )
    const config: UserConfig = { presets: [presetWind3()] }
    const hook = hooks.get('unocss:config')

    expect(hook).toBeTypeOf('function')
    await hook?.(config)
    await hook?.(config)

    expect(config.variants?.filter(
      (variant) => typeof variant === 'object'
        && 'name' in variant
        && variant.name === 'vue-uno-style-layer'
    )).toHaveLength(1)
    // The built-in bgi and bgv rules, merged once
    expect(config.rules).toHaveLength(2)
    expect(config.safelist).toHaveLength(1)
    expect(nuxt.options.unocss.presets?.some(
      (preset) => !Array.isArray(preset) && 'name' in preset && preset.name === 'vue-uno-style'
    )).toBe(true)
  })

  it.each([
    [{ directiveName: 'uno-style' }, 'v-uno-style'],
    [{ directiveName: 'style' }, 'v-style'],
    [{ directiveName: 'style', layer: 'cms' }, 'cms']
  ])('names the preset layer after the directive unless layer is set: %o', async (options, layer) => {
    const { nuxt } = await setupModule({ ...options, baseBreakpoint: 'sm' }, { presets: [presetWind3()] })
    const preset = nuxt.options.unocss.presets?.find(
      (item) => !Array.isArray(item) && 'name' in item && item.name === 'vue-uno-style'
    ) as { layers?: Record<string, number> } | undefined

    expect(preset?.layers).toEqual({ [layer]: 10 })
  })

  describe.each(basePresets)('with $name', ({ preset, themeKey, defaults }) => {
    /**
     * The user's theme value replaces the preset's defaults, as it does for UnoCSS's own
     * breakpoint variants. Reading the merged theme used to register the defaults' `xl` and
     * `2xl` as well, which the variants never served in order.
     */
    it('generates a runtime plugin from the user\'s theme breakpoints alone', async () => {
      const { hooks } = await setupModule(
        { directiveName: 'style', baseBreakpoint: 'sm' },
        {
          presets: [preset()],
          theme: { [themeKey]: { sm: '640px', md: '768px', lg: '1024px' } }
        }
      )

      await hooks.get('modules:done')?.()

      expect(addPluginTemplate).toHaveBeenCalledTimes(1)
      const contents = await pluginContents()

      expect(contents).toContain('nuxtApp.vueApp.directive("style", directive)')
      expect(contents).toContain('"breakpoints":{"sm":"640px","md":"768px","lg":"1024px"}')
      expect(contents).not.toContain('"xl"')
      expect(contents).toContain('"baseBreakpoint":"sm"')
    })

    it('falls back to the preset\'s own breakpoints when the app sets none', async () => {
      const { hooks } = await setupModule(
        { directiveName: 'style', baseBreakpoint: 'sm' },
        { presets: [preset()] }
      )

      await hooks.get('modules:done')?.()

      expect(await pluginContents()).toContain(`"breakpoints":${JSON.stringify(defaults)}`)
    })

    /**
     * The hook receives the user's config, whose `theme` lacks the preset's keys, so applying
     * the preset's `extendTheme` there could not tell presetWind4's `breakpoint` from the others'
     * `breakpoints`. Queued, UnoCSS runs it over the merged theme.
     */
    it('hands configured breakpoints to the preset\'s own variants through unocss:config', async () => {
      const { hooks } = await setupModule({ breakpoints: { sm: 0, md: '900px' } })
      const config: UserConfig = { presets: [preset()] }

      await hooks.get('unocss:config')?.(config)
      const uno = await createGenerator(config)

      expect(config.theme).toBeUndefined()
      expect((uno.config.theme as Record<string, unknown>)[themeKey]).toEqual({ sm: '0px', md: '900px' })
    })
  })

  it('uses explicit breakpoints for both the preset and runtime directive', async () => {
    const { hooks } = await setupModule({
      directiveName: 'uno-style',
      breakpoints: { mobile: 0, desktop: '64rem' }
    })

    await hooks.get('modules:done')?.()

    const template = vi.mocked(addPluginTemplate).mock.calls[0]?.[0]
    if (!template || typeof template === 'string') throw new Error('Expected a plugin template')
    const contents = await template.getContents?.({} as never)

    expect(contents).toContain('"breakpoints":{"mobile":0,"desktop":"64rem"}')
    expect(contents).toContain('"baseBreakpoint":"mobile"')
  })

  describe('with a UnoCSS config that imports a file Nuxt generates later', () => {
    const configFile = 'test/fixtures/uno.generated-later.config.ts'

    /**
     * `nuxt prepare` on a fresh checkout reaches modules:done before Nuxt writes its templates,
     * so a root `uno.config.ts` importing `.nuxt/uno.config.mjs` (`nuxtLayers`) cannot load yet.
     * With breakpoints given, nothing at that point needs the config.
     */
    it('does not load it when breakpoints are given', async () => {
      const { hooks } = await setupModule(
        { directiveName: 'style', breakpoints: { sm: 0, md: 768 } },
        { configFile }
      )

      await expect(hooks.get('modules:done')?.()).resolves.toBeUndefined()
      expect(await pluginContents()).toContain('"breakpoints":{"sm":0,"md":768}')
    })

    it('says to pass breakpoints when it needs the theme\'s', async () => {
      const { hooks } = await setupModule({ directiveName: 'style' }, { configFile })

      await expect(hooks.get('modules:done')?.()).rejects.toThrow(
        /Could not load the UnoCSS config to read its breakpoints: Cannot find module.*Pass breakpoints to the module/
      )
    })
  })

  it('fails clearly when the UnoCSS Nuxt module is missing', async () => {
    vi.mocked(hasNuxtModule).mockReturnValue(false)
    const { hooks } = await setupModule({ directiveName: 'uno-style' })

    await expect(hooks.get('modules:done')?.())
      .rejects.toThrow('requires @unocss/nuxt')
  })
})
