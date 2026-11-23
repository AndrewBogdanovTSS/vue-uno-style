import type { BreakpointConfig } from '../src/core/breakpoints'
import { createGenerator } from 'unocss'
import { describe, expect, it } from 'vitest'
import { resolveBreakpoints } from '../src/core/breakpoints'
import { defaultProperties } from '../src/core/properties'
import { getVarsClasses } from '../src/core/varsClasses'
import { getScannedProperties, presetVUnoStyle } from '../src/preset'
import { basePresets, mediaOrder } from './fixtures/presets'

const canvasBreakpoints = { sm: '0px', md: '768px', lg: '1024px' }
const customBreakpoints = { mobile: '0px', tablet: '768px', desktop: '1200px' }
const properties = ['c', 'bg', 'p']

/** Every class the directive can write for `props` under these breakpoints. */
const safelisted = (breakpoints: BreakpointConfig, baseBreakpoint?: string, props = properties) => {
  const resolved = resolveBreakpoints({ breakpoints, baseBreakpoint })
  return props.flatMap((prop) => getVarsClasses(prop, resolved).split(' ')).sort()
}

describe.each(basePresets)('presetVUnoStyle with $name', ({ preset, themeKey, defaults }) => {
  /** `themeBreakpoints: null` leaves the theme alone, so the base preset's defaults apply. */
  const createUno = async (
    options: Partial<Parameters<typeof presetVUnoStyle>[0]> = {},
    themeBreakpoints: Record<string, string> | null = canvasBreakpoints
  ) => createGenerator({
    presets: [preset(), presetVUnoStyle({ properties, ...options })],
    theme: themeBreakpoints ? { [themeKey]: themeBreakpoints } : {}
  })

  it('generates color utilities for base and responsive runtime variables', async () => {
    const uno = await createUno()
    const tokens = ['vs:c-$c', 'vs:md:c-$c-md']
    const { css, matched } = await uno.generate(tokens, {
      preflights: false,
      safelist: false
    })

    expect([...matched]).toEqual(tokens)
    expect(css).toContain('.vs\\:c-\\$c{color:var(--c);}')
    expect(css).toContain('@media (min-width: 768px)')
    expect(css).toContain('.vs\\:md\\:c-\\$c-md{color:var(--c-md);}')
  })

  it('serves bgi and bgv with its own rules, at every breakpoint', async () => {
    const uno = await createGenerator({
      presets: [preset(), presetVUnoStyle({ properties: ['bgi', 'bgv'] })],
      theme: { [themeKey]: canvasBreakpoints }
    })
    const { css, matched } = await uno.generate('', { preflights: false })

    expect(matched).toContain('vs:bgi-$bgi')
    expect(matched).toContain('vs:md:bgv-$bgv-md')
    expect(css).toContain('.vs\\:bgi-\\$bgi{background-image:var(--bgi);}')
    expect(css).toContain('.vs\\:md\\:bgv-\\$bgv-md{background:var(--bgv-md);}')
  })

  it('writes no CSS for bgi or bgv unless they are configured', async () => {
    const uno = await createGenerator({
      presets: [preset(), presetVUnoStyle({ properties: ['c'] })],
      theme: { [themeKey]: canvasBreakpoints }
    })
    const { css } = await uno.generate('', { preflights: false })

    expect(css).not.toContain('bgi')
    expect(css).not.toContain('bgv')
  })

  it('lets a consumer rule replace a built-in one', async () => {
    const uno = await createGenerator({
      presets: [preset(), presetVUnoStyle({ properties: ['bgv'] })],
      rules: [[/^bgv-\$([\w-]+)$/, ([, name]) => ({ 'background-color': `var(--${name})` })]],
      theme: { [themeKey]: canvasBreakpoints }
    })
    const { css } = await uno.generate('', { preflights: false })

    expect(css).toContain('.vs\\:bgv-\\$bgv{background-color:var(--bgv);}')
  })

  it('safelists every runtime class for exactly the configured properties', async () => {
    const uno = await createUno({ breakpoints: canvasBreakpoints })
    const { matched } = await uno.generate('', { preflights: false })

    expect([...matched].sort()).toEqual(safelisted(canvasBreakpoints))
  })

  /**
   * UnoCSS's own breakpoint variants read the user's theme value and ignore the preset's
   * defaults (`resolveBreakpoints` in `@unocss/rule-utils`). The merged theme still holds the
   * defaults' `xl` and `2xl`, and reading it used to safelist them too - classes whose media blocks
   * then landed before `md` and `lg`, so an `xl` value never won.
   */
  it('takes the user\'s theme breakpoints, which replace the preset\'s defaults', async () => {
    const uno = await createUno()
    const { matched } = await uno.generate('', { preflights: false })

    expect([...matched].sort()).toEqual(safelisted(canvasBreakpoints))
    expect(matched).not.toContain('vs:xl:c-$c-xl')
    expect(matched).not.toContain('vs:2xl:c-$c-2xl')
  })

  it('falls back to the preset\'s own breakpoints when the app sets none', async () => {
    const uno = await createUno({ baseBreakpoint: 'sm' }, null)
    const { css, matched } = await uno.generate('', { preflights: false })

    expect([...matched].sort()).toEqual(safelisted(defaults, 'sm'))
    expect(css).toContain(`@media (min-width: ${defaults.md})`)
  })

  it('hands configured breakpoints to the preset\'s own variants, under its theme key', async () => {
    const uno = await createUno({ breakpoints: { sm: 0, md: '900px', lg: '1200px' } }, null)
    const { css } = await uno.generate('', { preflights: false })

    expect((uno.config.theme as Record<string, unknown>)[themeKey])
      .toEqual({ sm: '0px', md: '900px', lg: '1200px' })
    expect(mediaOrder(css)).toEqual(['900px', '1200px'])
    expect(css).not.toContain(`@media (min-width: ${defaults.md})`)
  })

  it.each([
    ['default names from the theme', null, canvasBreakpoints],
    ['default names from the option', canvasBreakpoints, null],
    ['custom names from the theme', null, customBreakpoints],
    ['custom names from the option', customBreakpoints, null]
  ])('emits media blocks in breakpoint order: %s', async (_label, option, theme) => {
    const breakpoints = option ?? theme!
    const uno = await createUno(option ? { breakpoints: option } : {}, theme)
    const { css } = await uno.generate('', { preflights: false })

    expect(mediaOrder(css)).toEqual(Object.values(breakpoints).slice(1))
  })

  it('emits the v-uno-style layer after the default layer', async () => {
    const uno = await createUno()
    const { css } = await uno.generate(['c-red', 'vs:c-$c'], {
      preflights: false,
      safelist: false
    })

    expect(css.indexOf('/* layer: default */')).toBeGreaterThanOrEqual(0)
    expect(css.indexOf('/* layer: v-uno-style */')).toBeGreaterThan(css.indexOf('/* layer: default */'))
  })

  it('puts the vs: classes in the layer the option names', async () => {
    const uno = await createUno({ layer: 'v-style' })
    const { css } = await uno.generate(['c-red', 'vs:c-$c'], {
      preflights: false,
      safelist: false
    })

    expect(uno.config.layers['v-style']).toBeGreaterThan(uno.config.layers.default ?? 0)
    expect(uno.config.layers['v-uno-style']).toBeUndefined()
    expect(css.indexOf('/* layer: v-style */')).toBeGreaterThan(css.indexOf('/* layer: default */'))
    expect(css.slice(css.indexOf('/* layer: v-style */'))).toContain('.vs\\:c-\\$c{color:var(--c);}')
  })

  it('leaves a project\'s own o: variant and override layer alone', async () => {
    const uno = await createGenerator({
      presets: [preset(), presetVUnoStyle({ properties })],
      theme: { [themeKey]: canvasBreakpoints },
      layers: { override: 20 },
      variants: [(matcher) => matcher.startsWith('o:') ? { matcher: matcher.slice(2), layer: 'override' } : undefined]
    })
    const { css } = await uno.generate(['o:c-red', 'vs:c-$c'], {
      preflights: false,
      safelist: false
    })

    expect(css.slice(css.indexOf('/* layer: override */'))).toContain('.o\\:c-red{')
    expect(css.slice(css.indexOf('/* layer: v-uno-style */'), css.indexOf('/* layer: override */')))
      .toContain('.vs\\:c-\\$c{color:var(--c);}')
  })

  /**
   * The emission-order test above cannot fail in the direction that matters.
   * UnoCSS sorts layers by `(layers[a] ?? 0) - (layers[b] ?? 0) || a.localeCompare(b)`,
   * so with no declared order both layers sit at 0 and the tiebreak is
   * alphabetical - and `default` happens to sort before `v-uno-style`. Delete the
   * `layers` declaration from the preset and the emission test still passes,
   * because the layer would be winning by how the word is spelled.
   *
   * This asserts the declaration itself, so removing it fails here even while
   * the behaviour it buys still looks correct. Both tests are needed: one pins
   * the guarantee, the other pins the thing being guaranteed.
   */
  it('declares an explicit order rather than relying on the alphabetical tiebreak', async () => {
    const uno = await createUno()
    const { layers } = uno.config

    expect(layers['v-uno-style']).toBeGreaterThan(layers.default ?? 0)
  })

  it('supports a stock theme when the base breakpoint is explicit', async () => {
    const uno = await createUno(
      { baseBreakpoint: 'sm' },
      { sm: '640px', md: '768px', lg: '1024px' }
    )
    const { matched } = await uno.generate('', { preflights: false })

    expect(matched).toContain('vs:c-$c')
    expect(matched).toContain('vs:md:c-$c-md')
  })

  it('supports an explicit breakpoint override', async () => {
    const uno = await createUno({
      breakpoints: { mobile: 0, desktop: '64rem' }
    })
    const { css, matched } = await uno.generate('', { preflights: false })

    expect(matched).toContain('vs:c-$c')
    expect(matched).toContain('vs:desktop:c-$c-desktop')
    expect(matched).not.toContain('vs:md:c-$c-md')
    expect(css).toContain('@media (min-width: 64rem)')
  })

  it('throws when no base breakpoint can be resolved', async () => {
    const uno = await createUno({}, { sm: '640px', md: '768px' })

    await expect(uno.generate('', { preflights: false }))
      .rejects.toThrow('Unable to resolve a base breakpoint')
  })
})

describe('presetVUnoStyle without a base preset', () => {
  /**
   * With presetMini, presetWind3 or presetWind4 their own breakpoint variant matches first, so
   * only a setup without one exercises the package's variant on its own - and its ordering.
   */
  it('orders its own media blocks by breakpoint, not as strings', async () => {
    const uno = await createGenerator({
      presets: [presetVUnoStyle({ properties: ['c'], breakpoints: customBreakpoints })],
      rules: [[/^c-\$([\w-]+)$/, ([, name]) => ({ color: `var(--${name})` })]]
    })
    const { css } = await uno.generate('', { preflights: false })

    expect(mediaOrder(css)).toEqual(['768px', '1200px'])
  })

  it('throws when neither the theme nor options provide breakpoints', async () => {
    const uno = await createGenerator({
      presets: [presetVUnoStyle({ properties })]
    })

    await expect(uno.generate('', { preflights: false }))
      .rejects.toThrow('No breakpoints found')
  })

  it.each([
    ['missing', undefined],
    ['empty', []]
  ])('throws at configuration time when properties are %s and the defaults are off', (_label, configured) => {
    expect(() => presetVUnoStyle({ properties: configured as never, defaultProperties: false }))
      .toThrow('No properties configured')
    expect(() => presetVUnoStyle({ properties: configured as never })).not.toThrow()
  })
})

/**
 * The preset safelists a default property only once the scanned source sets it, so an unused
 * side such as `mb` costs no CSS. `generate(code)` runs the preset's extractor on `code` the way
 * the Vite plugin runs it on each module.
 */
describe.each(basePresets)('presetVUnoStyle scanning with $name', ({ preset, themeKey }) => {
  const createUno = async (options: Parameters<typeof presetVUnoStyle>[0] = {}) => createGenerator({
    presets: [preset(), presetVUnoStyle(options)],
    theme: { [themeKey]: canvasBreakpoints }
  })
  const classesOf = (props: string[]) => safelisted(canvasBreakpoints, undefined, props)
  const vsClasses = (matched: Set<string>) => [...matched].filter((name) => name.startsWith('vs:')).sort()

  it('safelists nothing for the defaults until the source uses them', async () => {
    const uno = await createUno()
    const { matched } = await uno.generate('', { preflights: false })

    expect(vsClasses(matched)).toEqual([])
  })

  it('safelists every breakpoint class of each default property the source sets, and no other', async () => {
    const uno = await createUno()
    const code = '<div v-uno-style:mt="a" v-uno-style="{ px: b, \'gap-y\': c }" /><p v-uno-style="data" />'
    const { matched } = await uno.generate(code, { preflights: false })

    expect(vsClasses(matched)).toEqual(classesOf(['mt', 'px', 'gap-y']))
  })

  it('always safelists the configured properties, next to the scanned ones', async () => {
    const uno = await createUno({ properties: ['c', 'mb'] })
    const { matched } = await uno.generate('<div v-uno-style:mt="a" />', { preflights: false })

    expect(vsClasses(matched)).toEqual(classesOf(['c', 'mb', 'mt']))
  })

  it('keeps what earlier files used, as a build scans one module at a time', async () => {
    const uno = await createUno()
    await uno.generate('<div v-uno-style:mt="a" />', { preflights: false })
    const { matched } = await uno.generate('<div v-uno-style:pb="b" />', { preflights: false })

    expect(vsClasses(matched)).toEqual(classesOf(['mt', 'pb']))
  })

  it('ignores a property that is neither configured nor a default one', async () => {
    const uno = await createUno()
    const { matched } = await uno.generate('<div v-uno-style:paddign="a" v-uno-style:blur="b" />', { preflights: false })

    expect(vsClasses(matched)).toEqual([])
  })

  it('scans for the configured directive name', async () => {
    const uno = await createUno({ directiveName: 'style' })
    const { matched } = await uno.generate('<div v-style:mt="a" v-uno-style:mb="b" />', { preflights: false })

    expect(vsClasses(matched)).toEqual(classesOf(['mt']))
  })

  it('scans only the configured properties once the defaults are off', async () => {
    const uno = await createUno({ properties: ['c'], defaultProperties: false })
    const { matched } = await uno.generate('<div v-uno-style:mt="a" />', { preflights: false })

    expect(vsClasses(matched)).toEqual(classesOf(['c']))
  })

  it('neither scans for nor safelists a blocked default property', async () => {
    const uno = await createUno({ blockedProperties: ['mt', { name: 'px', message: 'Use the container.' }] })
    const { matched } = await uno.generate('<div v-uno-style:mt="a" v-uno-style="{ px: b, pb: c }" />', { preflights: false })

    expect(vsClasses(matched)).toEqual(classesOf(['pb']))
  })

  it('throws when a property is both configured and blocked', () => {
    expect(() => presetVUnoStyle({ properties: ['mt'], blockedProperties: ['mt'] }))
      .toThrow('Property "mt" is both configured and blocked')
  })

  it('reports what each preset object has found so far, and nothing for other objects', async () => {
    const preset = presetVUnoStyle({ properties: ['c'], breakpoints: canvasBreakpoints })
    const other = presetVUnoStyle({ breakpoints: canvasBreakpoints })
    const uno = await createGenerator({ presets: [preset] })

    expect(getScannedProperties(preset)).toEqual([])
    await uno.generate('<div v-uno-style:mt="a" v-uno-style="{ px: b, c: d }" />', { preflights: false })

    expect(getScannedProperties(preset)).toEqual(['mt', 'px', 'c'])
    expect(getScannedProperties(other)).toEqual([])
    expect(getScannedProperties({ name: 'vue-uno-style' })).toBeUndefined()
  })

  it('serves every default property with a rule', async () => {
    const uno = await createUno({ properties: [...defaultProperties] })
    const { matched } = await uno.generate('', { preflights: false })
    const unserved = defaultProperties.filter((prop) => !matched.has(`vs:${prop}-$${prop}`))

    expect(unserved).toEqual([])
  })
})
