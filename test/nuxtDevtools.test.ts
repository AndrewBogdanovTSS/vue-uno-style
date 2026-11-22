import type { UserConfig } from 'unocss'
import { addPluginTemplate, addVitePlugin, hasNuxtModule } from '@nuxt/kit'
import { presetWind3 } from 'unocss'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@nuxt/kit', () => ({
  addPluginTemplate: vi.fn(),
  addVitePlugin: vi.fn(),
  defineNuxtModule: vi.fn((definition) => definition),
  hasNuxtModule: vi.fn(() => true),
  useLogger: vi.fn(() => ({ warn: vi.fn() }))
}))

// The real writer targets the file next to the module, which is `src/` under test
vi.mock('../src/webTypes', () => ({
  packageWebTypesPath: vi.fn(() => '/pkg/dist/web-types.json'),
  writeWebTypes: vi.fn(() => 'written')
}))

import module from '../src/nuxt'
import { presetVUnoStyle } from '../src/preset'
import { writeWebTypes } from '../src/webTypes'
import { basePresets } from './fixtures/presets'

type Hook = (...args: unknown[]) => unknown
type Options = {
  breakpoints?: Record<string, number | string>
  devtools?: boolean
  directiveName?: string
  properties?: Array<string | { name: string, format?: 'url' }>
  webTypes?: boolean
}
type Middleware = (req: unknown, res: unknown, next: () => void) => Promise<void>
interface Flags {
  dev?: boolean
  devtools?: boolean | { enabled?: boolean }
}

const setup = (module as unknown as { setup: (options: Options, nuxt: unknown) => unknown }).setup
const properties = ['c', 'bg', { name: 'bgi', format: 'url' as const }]

const setupModule = async (options: Options, unocss: UserConfig = {}, flags: Flags = {}) => {
  const hooks = new Map<string, Hook>()
  const nuxt = {
    options: {
      ...flags,
      rootDir: process.cwd(),
      unocss: { configFile: false, ...unocss }
    },
    hook: vi.fn((name: string, callback: Hook) => hooks.set(name, callback))
  }
  await setup({ properties, breakpoints: { sm: 0, md: 768 }, ...options }, nuxt)
  return hooks
}

const pluginContents = async () => {
  const template = vi.mocked(addPluginTemplate).mock.calls[0]?.[0]
  if (!template || typeof template === 'string') throw new Error('Expected a plugin template')
  return template.getContents?.({} as never)
}

const capturedMiddleware = (): Middleware => {
  const plugin = vi.mocked(addVitePlugin).mock.calls.at(-1)?.[0] as unknown as {
    configureServer: (server: { middlewares: { use: (handler: Middleware) => void } }) => void
  }
  let middleware: Middleware | undefined
  plugin.configureServer({ middlewares: { use: (handler) => (middleware = handler) } })
  if (!middleware) throw new Error('Expected a middleware')
  return middleware
}

const getData = async (middleware: Middleware) => {
  let body = ''
  const res = { statusCode: 0, setHeader: vi.fn(), end: (text = '') => (body = text) }
  await middleware({ url: '/__vue-uno-style/api/data', method: 'GET' }, res, vi.fn())
  expect(res.statusCode).toBe(200)
  return JSON.parse(body)
}

describe('vue-uno-style Nuxt DevTools', () => {
  beforeEach(() => {
    vi.mocked(addPluginTemplate).mockReset()
    vi.mocked(addVitePlugin).mockReset()
    vi.mocked(hasNuxtModule).mockReturnValue(true)
    vi.mocked(writeWebTypes).mockReset()
    vi.mocked(writeWebTypes).mockReturnValue('written')
  })

  it('adds nothing outside development', async () => {
    const hooks = await setupModule({})
    await hooks.get('modules:done')?.()

    expect(addVitePlugin).not.toHaveBeenCalled()
    expect(hooks.has('devtools:customTabs')).toBe(false)
    const contents = await pluginContents()
    expect(contents).not.toContain('vue-uno-style/devtools')
    expect(contents).toContain('nuxtApp.vueApp.directive("uno-style", directive)')
  })

  it.each<[string, Options, Flags]>([
    ['the module option is false', { devtools: false }, { dev: true }],
    ['Nuxt DevTools is off', {}, { dev: true, devtools: false }],
    ['Nuxt DevTools is disabled', {}, { dev: true, devtools: { enabled: false } }]
  ])('adds nothing in development when %s', async (_label, options, flags) => {
    const hooks = await setupModule(options, {}, flags)
    await hooks.get('modules:done')?.()

    expect(addVitePlugin).not.toHaveBeenCalled()
    expect(hooks.has('devtools:customTabs')).toBe(false)
    expect(await pluginContents()).not.toContain('vue-uno-style/devtools')
  })

  it('registers the tab, the dev server route and the instrumented directive', async () => {
    const hooks = await setupModule({ directiveName: 'style' }, {}, { dev: true })
    await hooks.get('modules:done')?.()

    expect(addVitePlugin).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'vue-uno-style:devtools', apply: 'serve' }),
      { server: false }
    )

    const tabs: unknown[] = []
    hooks.get('devtools:customTabs')?.(tabs)
    expect(tabs).toEqual([expect.objectContaining({
      name: 'vue-uno-style',
      view: { type: 'iframe', src: '/__vue-uno-style/' }
    })])

    const contents = await pluginContents()
    expect(contents).toContain(`import { createDevtoolsRegistry } from 'vue-uno-style/devtools'`)
    expect(contents).toContain('nuxtApp.vueApp.directive("style", instrument(directive))')
    expect(contents).toContain(`nuxtApp.provide('vUnoStyleDevtools', registry)`)
    // Server rendering keeps the plain directive
    expect(contents).toContain('nuxtApp.vueApp.directive("style", directive)')
  })

  describe.each(basePresets)('with $name', ({ preset, packageName, themeKey }) => {
    it('serves the build data once the UnoCSS config is loaded', async () => {
      const hooks = await setupModule({ directiveName: 'style' }, { presets: [preset()] }, { dev: true })
      const middleware = capturedMiddleware()
      const pending = getData(middleware)
      await hooks.get('modules:done')?.()
      const data = await pending

      expect(data).toEqual(expect.objectContaining({
        directiveName: 'style',
        preset: 'module',
        unoPresets: [packageName],
        webTypes: { status: 'written', file: '/pkg/dist/web-types.json' },
        breakpoints: { source: 'option', themeKey, values: { sm: '0px', md: '768px' }, base: 'sm', prefixed: ['md'] }
      }))
      expect(data.properties).toEqual([{ name: 'c' }, { name: 'bg' }, { name: 'bgi', format: 'url' }])
      // Every base preset has rules for c and bg; bgi needs one the app adds itself
      expect(data.coverage.map((item: { property: string, suggestion?: string }) =>
        [item.property, Boolean(item.suggestion)])).toEqual([['c', false], ['bg', false], ['bgi', true]])
    })

    /**
     * The user's theme value replaces the preset's defaults, so the tab lists exactly the
     * breakpoints the app set. It used to show the defaults' `xl` and `2xl` as well.
     */
    it('reads breakpoints from the theme, and only the ones the app set', async () => {
      const hooks = await setupModule(
        { breakpoints: undefined },
        { presets: [preset()], theme: { [themeKey]: { sm: '0px', md: '768px' } } },
        { dev: true }
      )
      const middleware = capturedMiddleware()
      await hooks.get('modules:done')?.()

      expect((await getData(middleware)).breakpoints).toEqual({
        source: 'theme',
        themeKey,
        values: { sm: '0px', md: '768px' },
        base: 'sm',
        prefixed: ['md']
      })
    })
  })

  it('records a failed or disabled web-types rewrite', async () => {
    vi.mocked(writeWebTypes).mockImplementation(() => {
      throw new Error('EROFS: read-only file system')
    })
    const failed = await setupModule({}, {}, { dev: true })
    const failedMiddleware = capturedMiddleware()
    await failed.get('modules:done')?.()

    expect((await getData(failedMiddleware)).webTypes).toEqual({
      status: 'failed',
      file: '/pkg/dist/web-types.json',
      error: 'EROFS: read-only file system'
    })

    const disabled = await setupModule({ webTypes: false }, {}, { dev: true })
    const disabledMiddleware = capturedMiddleware()
    await disabled.get('modules:done')?.()

    expect((await getData(disabledMiddleware)).webTypes).toEqual({ status: 'disabled' })
  })

  it('loads the UnoCSS config on the first request, not in modules:done', async () => {
    const hooks = await setupModule(
      {},
      { configFile: 'test/fixtures/uno.generated-later.config.ts' } as UserConfig,
      { dev: true }
    )
    const middleware = capturedMiddleware()

    // The config cannot load yet, as on a fresh checkout before Nuxt writes `.nuxt/`
    await expect(hooks.get('modules:done')?.()).resolves.toBeUndefined()
    expect(await pluginContents()).toContain('vue-uno-style/devtools')

    const res = { statusCode: 0, setHeader: vi.fn(), end: vi.fn() }
    await middleware({ url: '/__vue-uno-style/api/data', method: 'GET' }, res, vi.fn())
    expect(res.statusCode).toBe(500)
  })

  it('reports a preset the UnoCSS config already has', async () => {
    const hooks = await setupModule(
      {},
      { presets: [presetWind3(), presetVUnoStyle({ properties: ['c'], breakpoints: { sm: 0 } })] },
      { dev: true }
    )
    const middleware = capturedMiddleware()
    await hooks.get('modules:done')?.()

    expect((await getData(middleware)).preset).toBe('config')
  })
})
