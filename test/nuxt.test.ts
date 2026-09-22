import type { UserConfig } from 'unocss'
import { addPluginTemplate, hasNuxtModule } from '@nuxt/kit'
import { presetWind3 } from 'unocss'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@nuxt/kit', () => ({
  addPluginTemplate: vi.fn(),
  defineNuxtModule: vi.fn((definition) => definition),
  hasNuxtModule: vi.fn(() => true),
}))

import module from '../src/nuxt'

type Hook = (...args: unknown[]) => unknown
type ModuleDefinition = {
  defaults: { directiveName: string }
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
    },
    nuxt: unknown,
  ) => unknown
}

const moduleDefinition = module as unknown as ModuleDefinition

const createNuxt = (unocss: UserConfig & { configFile?: string | false } = {}) => {
  const hooks = new Map<string, Hook>()
  const nuxt = {
    options: {
      rootDir: process.cwd(),
      unocss: {
        configFile: false,
        ...unocss,
      },
    },
    hook: vi.fn((name: string, callback: Hook) => hooks.set(name, callback)),
  }

  return { hooks, nuxt }
}

const setupModule = async (
  options: Parameters<ModuleDefinition['setup']>[0],
  unocss?: UserConfig & { configFile?: string | false },
) => {
  const { hooks, nuxt } = createNuxt(unocss)

  await moduleDefinition.setup(options, nuxt)

  return { hooks, nuxt }
}

describe('v-uno-style Nuxt module', () => {
  beforeEach(() => {
    vi.mocked(addPluginTemplate).mockReset()
    vi.mocked(hasNuxtModule).mockReset()
    vi.mocked(hasNuxtModule).mockReturnValue(true)
  })

  it('declares the module metadata and default directive name', () => {
    expect(moduleDefinition.meta).toEqual(expect.objectContaining({
      name: 'v-uno-style',
      configKey: 'vUnoStyle',
      compatibility: { nuxt: '>=3.17.0' },
    }))
    expect(moduleDefinition.defaults).toEqual({ directiveName: 'uno-style' })
  })

  it('merges the preset into the UnoCSS config once', async () => {
    const { hooks, nuxt } = await setupModule(
      { directiveName: 'uno-style', baseBreakpoint: 'sm' },
      { presets: [presetWind3()] },
    )
    const config: UserConfig = { presets: [presetWind3()] }
    const hook = hooks.get('unocss:config')

    expect(hook).toBeTypeOf('function')
    await hook?.(config)
    await hook?.(config)

    expect(config.variants?.filter(
      (variant) => typeof variant === 'object'
        && 'name' in variant
        && variant.name === 'v-uno-style-override',
    )).toHaveLength(1)
    expect(config.rules).toHaveLength(2)
    expect(config.safelist).toHaveLength(1)
    expect(nuxt.options.unocss.presets?.some(
      (preset) => !Array.isArray(preset) && 'name' in preset && preset.name === 'v-uno-style',
    )).toBe(true)
  })

  it('generates a runtime plugin from resolved UnoCSS breakpoints', async () => {
    const { hooks } = await setupModule(
      { directiveName: 'style', baseBreakpoint: 'sm' },
      {
        presets: [presetWind3()],
        theme: { breakpoints: { sm: '640px', md: '768px', lg: '1024px' } },
      },
    )

    await hooks.get('modules:done')?.()

    expect(addPluginTemplate).toHaveBeenCalledTimes(1)
    const template = vi.mocked(addPluginTemplate).mock.calls[0]?.[0]
    if (!template || typeof template === 'string') throw new Error('Expected a plugin template')
    const contents = await template.getContents?.({} as never)

    expect(template).toEqual(expect.objectContaining({ filename: 'v-uno-style.mjs' }))
    expect(contents).toContain('nuxtApp.vueApp.directive("style", directive)')
    expect(contents).toContain('"sm":"640px"')
    expect(contents).toContain('"md":"768px"')
    expect(contents).toContain('"lg":"1024px"')
    expect(contents).toContain('"xl":"1280px"')
    expect(contents).toContain('"2xl":"1536px"')
    expect(contents).toContain('"baseBreakpoint":"sm"')
  })

  it('uses explicit breakpoints for both the preset and runtime directive', async () => {
    const { hooks } = await setupModule({
      directiveName: 'uno-style',
      breakpoints: { mobile: 0, desktop: '64rem' },
    })

    await hooks.get('modules:done')?.()

    const template = vi.mocked(addPluginTemplate).mock.calls[0]?.[0]
    if (!template || typeof template === 'string') throw new Error('Expected a plugin template')
    const contents = await template.getContents?.({} as never)

    expect(contents).toContain('"breakpoints":{"mobile":0,"desktop":"64rem"}')
    expect(contents).toContain('"baseBreakpoint":"mobile"')
  })

  it('fails clearly when the UnoCSS Nuxt module is missing', async () => {
    vi.mocked(hasNuxtModule).mockReturnValue(false)
    const { hooks } = await setupModule({ directiveName: 'uno-style' })

    await expect(hooks.get('modules:done')?.())
      .rejects.toThrow('requires @unocss/nuxt')
  })
})
