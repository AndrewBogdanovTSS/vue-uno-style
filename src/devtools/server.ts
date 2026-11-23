import type { BreakpointConfig, ResolvedBreakpoints } from '../core/breakpoints'
import type { StyleValue } from '../core/getStyle'
import type { BlockedProperty, PropertyFormat, ResolvedProperties } from '../core/properties'
import type { BreakpointThemeKey } from '../themeBreakpoints'
import type { ValueWarning } from './inspect'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { UnoGenerator } from 'unocss'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getStyle } from '../core/getStyle'
import { getVarsClasses, VARIANT_PREFIX } from '../core/varsClasses'
import { isKnownRulePrefix, knownRuleSource } from '../knownRules'
import { inspectValue } from './inspect'
import { renderDevtoolsPage } from './page'

/** Where the tab is served. Absolute, like `/__unocss/`, so it ignores the app's base URL. */
export const DEVTOOLS_ROUTE = '/__vue-uno-style'

export type WebTypesStatus =
  | { status: 'written' | 'unchanged', file: string }
  | { status: 'disabled' }
  | { status: 'failed', file: string, error: string }

export interface PropertyCoverage {
  property: string
  /** `configured` for a `properties` entry, `scanned` for a default property the source sets. */
  source: 'configured' | 'scanned'
  format?: PropertyFormat
  tokens: Array<{ token: string, matched: boolean }>
  /** Bytes of CSS the property's safelisted tokens generate. */
  bytes: number
  /** A `rules` entry to add when no token generated CSS and no blocklist entry explains it. */
  suggestion?: string
  /** The UnoCSS `blocklist` entry that removes the property's CSS, when one does. */
  unoBlocked?: UnoBlocked
}

/** A UnoCSS `blocklist` entry that removes a property's CSS. */
export interface UnoBlocked {
  /** The entry, as text: a string, a regular expression or a function's source. */
  rule: string
  /** The entry's own message, when it has one. */
  message?: string
}

export interface DevtoolsData {
  version: string
  directiveName: string
  properties: Array<{ name: string, format?: PropertyFormat }>
  breakpoints: {
    source: 'option' | 'theme'
    /** The theme key the base preset reads them from, and the option writes them to. */
    themeKey: BreakpointThemeKey
    values: Record<string, string>
    base: string
    prefixed: string[]
  }
  /** `config` when the UnoCSS config already had the preset, `module` when the module added it. */
  preset: 'config' | 'module'
  /** The other UnoCSS presets in the resolved config, such as `@unocss/preset-wind4`. */
  unoPresets: string[]
  configSources: string[]
  webTypes: WebTypesStatus
  coverage: PropertyCoverage[]
  /** Every class the preset safelists: the configured properties' and the scanned ones'. */
  safelist: { classes: number, bytes: number }
  /**
   * Whether the tab sees what the preset found in the source. Only when the module added the
   * preset: one from the app's UnoCSS config scans on its own, out of the tab's reach.
   */
  scanTracked: boolean
  /** The properties the project blocks through `blockedProperties`. */
  blocked: BlockedProperty[]
  /**
   * Known properties, configured or default, whose CSS the app's UnoCSS `blocklist` removes.
   * The directive still writes their classes, so they style nothing, and nothing else reports it.
   */
  unoBlocked: Array<UnoBlocked & { property: string }>
}

export interface DevtoolsContext {
  version: string
  directiveName: string
  properties: ResolvedProperties
  breakpoints: BreakpointConfig
  breakpointSource: 'option' | 'theme'
  breakpointThemeKey: BreakpointThemeKey
  resolved: ResolvedBreakpoints
  preset: 'config' | 'module'
  unoPresets: string[]
  configSources: string[]
  webTypes: WebTypesStatus
  generator: Pick<UnoGenerator, 'generate' | 'getBlocked'>
  /**
   * The default properties the preset has found in the source so far. Absent when the tab cannot
   * see them, because the preset came from the app's UnoCSS config.
   */
  scannedProperties?: () => string[]
}

export interface SampleInput {
  property?: string
  value: unknown
}

export type SampleResult =
  | { classes: string, style: Record<string, StyleValue>, css: string, warnings: ValueWarning[] }
  | { error: string }

const byteLength = (text: string) => new TextEncoder().encode(text).length

const toCssSize = (value: number | string) => typeof value === 'number' ? `${value}px` : value

const escapeRegExp = (text: string) => text.replace(/[$()*+.?[\\\]^{|}-]/g, '\\$&')

/**
 * The `rules` entry to add for a property no rule serves: the tested rule from the README's
 * "Prefixes your preset lacks" table when the prefix is one of those, otherwise the README's
 * general shape with the CSS property left for the app to fill in.
 */
export const suggestRule = (property: string): string => isKnownRulePrefix(property)
  ? knownRuleSource(property)
  : `[/^${escapeRegExp(property)}-\\$([\\w-]+)$/, ([, name]) => ({ '<css-property>': \`var(--\${name})\` })]`

const generateCss = async (generator: DevtoolsContext['generator'], tokens: string[]) => {
  if (!tokens.length) return { css: '', matched: new Set<string>() }
  const { css, matched } = await generator.generate(new Set(tokens), {
    preflights: false,
    safelist: false
  })
  return { css, matched }
}

/**
 * The UnoCSS `blocklist` entry that removes `property`'s CSS. UnoCSS checks the token as written
 * and again once the variants are stripped, so both forms are asked. Only meaningful for a
 * property whose classes generated nothing.
 */
const findUnoBlocked = (generator: DevtoolsContext['generator'], property: string): UnoBlocked | undefined => {
  const entry = generator.getBlocked(`${property}-${property}`)
    ?? generator.getBlocked(`${VARIANT_PREFIX}${property}-${property}`)
  if (!entry) return undefined

  const [rule, meta] = entry
  const message = typeof meta?.message === 'function'
    ? meta.message(`${property}-${property}`)
    : meta?.message

  return {
    rule: rule instanceof RegExp ? String(rule) : typeof rule === 'function' ? 'a function' : JSON.stringify(rule),
    ...(message ? { message } : {})
  }
}

/**
 * Checks every safelisted token of every configured or scanned property against the app's
 * generator. A property whose tokens generate nothing has no UnoCSS rule for
 * `<prefix>-$<variable>`, or an entry of the app's `blocklist` removes it.
 */
export const createCoverage = async (context: DevtoolsContext): Promise<PropertyCoverage[]> => {
  const { names } = context.properties
  const scanned = (context.scannedProperties?.() ?? []).filter((property) => !names.includes(property))
  const sources = [
    ...names.map((property) => [property, 'configured'] as const),
    ...scanned.map((property) => [property, 'scanned'] as const)
  ]

  return Promise.all(sources.map(async ([property, source]) => {
    const tokens = getVarsClasses(property, context.resolved).split(' ')
    const { css, matched } = await generateCss(context.generator, tokens)
    const format = context.properties.formats[property]
    const anyMatched = tokens.some((token) => matched.has(token))
    const unoBlocked = anyMatched ? undefined : findUnoBlocked(context.generator, property)

    return {
      property,
      source,
      ...(format ? { format } : {}),
      tokens: tokens.map((token) => ({ token, matched: matched.has(token) })),
      bytes: byteLength(css),
      ...(unoBlocked ? { unoBlocked } : anyMatched ? {} : { suggestion: suggestRule(property) })
    }
  }))
}

/**
 * Every known property, configured or default, whose base class the app's UnoCSS `blocklist`
 * removes. One generate call covers them all.
 */
export const findUnoBlockedProperties = async (context: DevtoolsContext): Promise<DevtoolsData['unoBlocked']> => {
  const tokens = context.properties.known.map((property) => `${VARIANT_PREFIX}${property}-${property}`)
  const { matched } = await generateCss(context.generator, tokens)

  return context.properties.known.flatMap((property) => {
    if (matched.has(`${VARIANT_PREFIX}${property}-${property}`)) return []
    const unoBlocked = findUnoBlocked(context.generator, property)
    return unoBlocked ? [{ property, ...unoBlocked }] : []
  })
}

/** Everything the tab shows about the build: config, rule coverage, safelist cost and status. */
export const createDevtoolsData = async (context: DevtoolsContext): Promise<DevtoolsData> => {
  const [coverage, unoBlocked] = await Promise.all([createCoverage(context), findUnoBlockedProperties(context)])

  return {
    version: context.version,
    directiveName: context.directiveName,
    properties: context.properties.names.map((name) => {
      const format = context.properties.formats[name]
      return format ? { name, format } : { name }
    }),
    breakpoints: {
      source: context.breakpointSource,
      themeKey: context.breakpointThemeKey,
      values: Object.fromEntries(Object.entries(context.breakpoints)
        .map(([name, value]) => [name, toCssSize(value)])),
      base: context.resolved.base,
      prefixed: context.resolved.prefixed
    },
    preset: context.preset,
    unoPresets: context.unoPresets,
    configSources: context.configSources,
    webTypes: context.webTypes,
    coverage,
    safelist: {
      classes: coverage.reduce((total, item) => total + item.tokens.length, 0),
      bytes: coverage.reduce((total, item) => total + item.bytes, 0)
    },
    scanTracked: Boolean(context.scannedProperties),
    blocked: context.properties.blocked,
    unoBlocked
  }
}

/** Runs a value through the directive's `getStyle()` and the app's generator, for the REPL. */
export const generateSample = async (
  context: Pick<DevtoolsContext, 'generator' | 'resolved' | 'properties'>,
  input: SampleInput
): Promise<SampleResult> => {
  const property = typeof input.property === 'string' && input.property.trim()
    ? input.property.trim()
    : undefined
  const { value } = input

  if (value === undefined || value === null || value === '') return { error: 'Enter a value.' }
  if (!property && (typeof value !== 'object' || Array.isArray(value))) {
    return { error: 'Without a property the value must be an object, such as { "c": { "sm": "#111" } }.' }
  }

  try {
    const { classes, style } = getStyle(
      value as Parameters<typeof getStyle>[0],
      context.resolved,
      property,
      context.properties
    )
    const { css } = await generateCss(context.generator, classes ? classes.split(' ') : [])
    const warnings = inspectValue(value, property, context.resolved, context.properties)

    return { classes, style, css, warnings }
  }
  catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
}

/** The built tab script, next to the bundled module in `dist/`. */
export const devtoolsClientPath = (): string =>
  join(dirname(fileURLToPath(import.meta.url)), 'devtools-client.mjs')

const MAX_BODY = 64 * 1024

const readBody = (req: IncomingMessage) => new Promise<string>((resolve, reject) => {
  let body = ''
  req.setEncoding('utf8')
  req.on('data', (chunk: string) => {
    body += chunk
    if (body.length > MAX_BODY) {
      reject(new Error('Request body too large.'))
      req.destroy()
    }
  })
  req.on('end', () => resolve(body))
  req.on('error', reject)
})

const send = (res: ServerResponse, status: number, type: string, body: string) => {
  res.statusCode = status
  res.setHeader('Content-Type', `${type}; charset=utf-8`)
  res.setHeader('Cache-Control', 'no-store')
  res.end(body)
}

const sendJson = (res: ServerResponse, status: number, body: unknown) =>
  send(res, status, 'application/json', JSON.stringify(body))

export interface DevtoolsMiddlewareOptions {
  getData: () => Promise<DevtoolsData>
  generate: (input: SampleInput) => Promise<SampleResult>
  /** Reads the tab script. Defaults to the built `dist/devtools-client.mjs`. */
  readClient?: () => string | undefined
}

const readBuiltClient = () => {
  const file = devtoolsClientPath()
  return existsSync(file) ? readFileSync(file, 'utf8') : undefined
}

/**
 * Connect middleware serving the tab under `DEVTOOLS_ROUTE`: the page, its script and a JSON API.
 * Requests outside the route fall through to `next`.
 */
export const createDevtoolsMiddleware = ({
  getData,
  generate,
  readClient = readBuiltClient
}: DevtoolsMiddlewareOptions) =>
  async (req: IncomingMessage, res: ServerResponse, next: (error?: unknown) => void) => {
    const path = (req.url ?? '').split('?')[0] ?? ''
    if (path !== DEVTOOLS_ROUTE && !path.startsWith(`${DEVTOOLS_ROUTE}/`)) return next()

    const route = path.slice(DEVTOOLS_ROUTE.length) || '/'

    try {
      if (route === '/' && req.method === 'GET') {
        if (path === DEVTOOLS_ROUTE) {
          // Relative URLs in the page resolve against the trailing slash
          res.statusCode = 302
          res.setHeader('Location', `${DEVTOOLS_ROUTE}/`)
          return res.end()
        }
        return send(res, 200, 'text/html', renderDevtoolsPage())
      }
      if (route === '/client.mjs' && req.method === 'GET') {
        const client = readClient()
        return client === undefined
          ? send(res, 500, 'text/plain', 'vue-uno-style: dist/devtools-client.mjs is missing. Run `pnpm build`.')
          : send(res, 200, 'text/javascript', client)
      }
      if (route === '/api/data' && req.method === 'GET') {
        return sendJson(res, 200, await getData())
      }
      if (route === '/api/generate' && req.method === 'POST') {
        let input: SampleInput
        try {
          input = JSON.parse(await readBody(req)) as SampleInput
        }
        catch {
          return sendJson(res, 400, { error: 'The request body must be JSON: { "property"?: string, "value": ... }.' })
        }
        return sendJson(res, 200, await generate(input))
      }
      return send(res, 404, 'text/plain', 'Not found')
    }
    catch (error) {
      return sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) })
    }
  }
