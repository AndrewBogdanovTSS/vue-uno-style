import type { DevtoolsContext, SampleInput } from '../src/devtools/server'
import { EventEmitter } from 'node:events'
import { createGenerator, presetWind3 } from 'unocss'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { resolveBreakpoints } from '../src/core/breakpoints'
import { resolveProperties } from '../src/core/properties'
import {
  createDevtoolsData,
  createDevtoolsMiddleware,
  DEVTOOLS_ROUTE,
  generateSample,
} from '../src/devtools/server'
import { presetVUnoStyle } from '../src/preset'

const breakpoints = { sm: 0, md: '768px', lg: '1024px' }
const configured = ['c', 'bg', 'nope', { name: 'bgi', format: 'url' as const }]

let context: DevtoolsContext

beforeAll(async () => {
  const generator = await createGenerator({
    presets: [presetWind3(), presetVUnoStyle({ properties: configured, breakpoints })],
    rules: [[/^bgi-\$([\w-]+)$/, ([, name]) => ({ 'background-image': `var(--${name})` })]],
  })
  context = {
    version: '1.2.3',
    directiveName: 'uno-style',
    properties: resolveProperties(configured),
    breakpoints,
    breakpointSource: 'option',
    resolved: resolveBreakpoints({ breakpoints }),
    preset: 'module',
    configSources: ['/app/uno.config.ts'],
    webTypes: { status: 'unchanged', file: '/pkg/dist/web-types.json' },
    generator,
  }
})

describe('createDevtoolsData', () => {
  it('describes the resolved configuration', async () => {
    const data = await createDevtoolsData(context)

    expect(data).toEqual(expect.objectContaining({
      version: '1.2.3',
      directiveName: 'uno-style',
      preset: 'module',
      configSources: ['/app/uno.config.ts'],
      webTypes: { status: 'unchanged', file: '/pkg/dist/web-types.json' },
      breakpoints: {
        source: 'option',
        values: { sm: '0px', md: '768px', lg: '1024px' },
        base: 'sm',
        prefixed: ['md', 'lg'],
      },
    }))
    expect(data.properties).toEqual([{ name: 'c' }, { name: 'bg' }, { name: 'nope' }, { name: 'bgi', format: 'url' }])
  })

  it('checks every safelisted token against the generator', async () => {
    const { coverage } = await createDevtoolsData(context)
    const color = coverage.find((item) => item.property === 'c')!

    expect(color.tokens).toEqual([
      { token: 'o:c-$c', matched: true },
      { token: 'o:md:c-$c-md', matched: true },
      { token: 'o:lg:c-$c-lg', matched: true },
    ])
    expect(color.bytes).toBeGreaterThan(0)
    expect(color.suggestion).toBeUndefined()
    expect(coverage.find((item) => item.property === 'bgi')).toEqual(expect.objectContaining({ format: 'url' }))
  })

  it('suggests a rule for a property no rule matches', async () => {
    const { coverage } = await createDevtoolsData(context)
    const missing = coverage.find((item) => item.property === 'nope')!

    expect(missing.tokens.every((token) => !token.matched)).toBe(true)
    expect(missing.bytes).toBe(0)
    expect(missing.suggestion).toBe(
      '[/^nope-\\$([\\w-]+)$/, ([, name]) => ({ \'<css-property>\': `var(--${name})` })]',
    )
  })

  it('totals the safelist', async () => {
    const { coverage, safelist } = await createDevtoolsData(context)

    expect(safelist.classes).toBe(12)
    expect(safelist.bytes).toBe(coverage.reduce((total, item) => total + item.bytes, 0))
  })
})

describe('generateSample', () => {
  it('returns the classes, variables and CSS for a responsive value', async () => {
    const result = await generateSample(context, { property: 'c', value: { sm: 'red', md: 'blue' } })
    if ('error' in result) throw new Error(result.error)

    expect(result.classes).toBe('o:c-$c o:md:c-$c-md')
    expect(result.style).toEqual({ '--c': 'red', '--c-md': 'blue' })
    expect(result.css).toContain('color:var(--c)')
    expect(result.css).toContain('@media (min-width: 768px)')
    expect(result.warnings).toEqual([])
  })

  it('applies value formats and reports warnings', async () => {
    const result = await generateSample(context, { value: { bgi: 'a.png', p: { xl: '1rem' } } })
    if ('error' in result) throw new Error(result.error)

    expect(result.style).toEqual({ '--bgi': 'url(a.png)' })
    expect(result.warnings.map((warning) => warning.kind)).toEqual(['unknown-property', 'unknown-breakpoint'])
  })

  it.each<[string, SampleInput, string]>([
    ['an empty value', { property: 'c', value: '' }, 'Enter a value.'],
    ['a scalar without a property', { value: 'red' }, 'Without a property'],
  ])('explains %s', async (_label, input, message) => {
    const result = await generateSample(context, input)

    expect(result).toEqual({ error: expect.stringContaining(message) })
  })
})

interface FakeResponse {
  statusCode: number
  headers: Record<string, string>
  body: string
}

const call = async (
  middleware: ReturnType<typeof createDevtoolsMiddleware>,
  method: string,
  url: string,
  body?: string,
) => {
  const req = Object.assign(new EventEmitter(), {
    method,
    url,
    setEncoding: vi.fn(),
    destroy: vi.fn(),
  })
  const response: FakeResponse = { statusCode: 0, headers: {}, body: '' }
  const res = {
    set statusCode(value: number) { response.statusCode = value },
    get statusCode() { return response.statusCode },
    setHeader: (name: string, value: string) => (response.headers[name] = value),
    end: (text = '') => (response.body = text),
  }
  const next = vi.fn()
  const done = middleware(req as never, res as never, next)
  if (body !== undefined) {
    req.emit('data', body)
    req.emit('end')
  }
  await done
  return { ...response, next }
}

describe('createDevtoolsMiddleware', () => {
  const middleware = createDevtoolsMiddleware({
    getData: async () => createDevtoolsData(context),
    generate: async (input) => generateSample(context, input),
    readClient: () => 'console.log("client")',
  })

  it('leaves other requests to the next handler', async () => {
    const { next } = await call(middleware, 'GET', '/__vue-uno-styles/')

    expect(next).toHaveBeenCalledOnce()
  })

  it('redirects the bare route to its trailing slash', async () => {
    const { statusCode, headers } = await call(middleware, 'GET', DEVTOOLS_ROUTE)

    expect(statusCode).toBe(302)
    expect(headers.Location).toBe(`${DEVTOOLS_ROUTE}/`)
  })

  it('serves the page and its script', async () => {
    const page = await call(middleware, 'GET', `${DEVTOOLS_ROUTE}/?v=1`)
    const script = await call(middleware, 'GET', `${DEVTOOLS_ROUTE}/client.mjs`)

    expect(page.statusCode).toBe(200)
    expect(page.headers['Content-Type']).toContain('text/html')
    expect(page.body).toContain('<script type="module" src="./client.mjs"></script>')
    expect(script.headers['Content-Type']).toContain('text/javascript')
    expect(script.body).toBe('console.log("client")')
  })

  it('explains a missing client build', async () => {
    const unbuilt = createDevtoolsMiddleware({
      getData: async () => createDevtoolsData(context),
      generate: async (input) => generateSample(context, input),
      readClient: () => undefined,
    })
    const { statusCode, body } = await call(unbuilt, 'GET', `${DEVTOOLS_ROUTE}/client.mjs`)

    expect(statusCode).toBe(500)
    expect(body).toContain('pnpm build')
  })

  it('serves the build data as JSON', async () => {
    const { statusCode, headers, body } = await call(middleware, 'GET', `${DEVTOOLS_ROUTE}/api/data`)

    expect(statusCode).toBe(200)
    expect(headers['Content-Type']).toContain('application/json')
    expect(JSON.parse(body).directiveName).toBe('uno-style')
  })

  it('generates a sample from a JSON body', async () => {
    const { statusCode, body } = await call(
      middleware,
      'POST',
      `${DEVTOOLS_ROUTE}/api/generate`,
      JSON.stringify({ property: 'c', value: 'red' }),
    )

    expect(statusCode).toBe(200)
    expect(JSON.parse(body)).toEqual(expect.objectContaining({ classes: 'o:c-$c', style: { '--c': 'red' } }))
  })

  it('rejects a body that is not JSON', async () => {
    const { statusCode, body } = await call(middleware, 'POST', `${DEVTOOLS_ROUTE}/api/generate`, 'nope')

    expect(statusCode).toBe(400)
    expect(JSON.parse(body).error).toContain('must be JSON')
  })

  it('answers 404 for unknown routes under the prefix', async () => {
    const { statusCode, next } = await call(middleware, 'GET', `${DEVTOOLS_ROUTE}/missing`)

    expect(statusCode).toBe(404)
    expect(next).not.toHaveBeenCalled()
  })

  it('turns a failing data source into a JSON error', async () => {
    const failing = createDevtoolsMiddleware({
      getData: async () => {
        throw new Error('config broke')
      },
      generate: async (input) => generateSample(context, input),
    })
    const { statusCode, body } = await call(failing, 'GET', `${DEVTOOLS_ROUTE}/api/data`)

    expect(statusCode).toBe(500)
    expect(JSON.parse(body)).toEqual({ error: 'config broke' })
  })
})
