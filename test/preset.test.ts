import { createGenerator, presetWind3 } from 'unocss'
import { describe, expect, it } from 'vitest'
import { resolveBreakpoints } from '../src/core/breakpoints'
import { styleProps } from '../src/core/getStyle'
import { getVarsClasses } from '../src/core/varsClasses'
import { presetVUnoStyle } from '../src/preset'

const canvasBreakpoints = { sm: '0px', md: '768px', lg: '1024px' }

const createUno = async (
  options: Parameters<typeof presetVUnoStyle>[0] = {},
  themeBreakpoints: Record<string, string> = canvasBreakpoints,
) => createGenerator({
  presets: [presetWind3(), presetVUnoStyle(options)],
  theme: { breakpoints: themeBreakpoints },
})

describe('presetVUnoStyle', () => {
  it('generates color utilities for base and responsive runtime variables', async () => {
    const uno = await createUno()
    const tokens = ['o:c-$c', 'o:md:c-$c-md']
    const { css, matched } = await uno.generate(tokens, {
      preflights: false,
      safelist: false,
    })

    expect([...matched]).toEqual(tokens)
    expect(css).toContain('.o\\:c-\\$c{color:var(--c);}')
    expect(css).toContain('@media (min-width: 768px)')
    expect(css).toContain('.o\\:md\\:c-\\$c-md{color:var(--c-md);}')
  })

  it('generates the background-image and background variable rules', async () => {
    const uno = await createUno()
    const { css, matched } = await uno.generate(['o:bgi-$bgi', 'o:bgv-$bgv'], {
      preflights: false,
      safelist: false,
    })

    expect([...matched]).toEqual(['o:bgi-$bgi', 'o:bgv-$bgv'])
    expect(css).toContain('background-image:var(--bgi);')
    expect(css).toContain('background:var(--bgv);')
  })

  it('safelists every runtime class for every supported property', async () => {
    const uno = await createUno({ breakpoints: canvasBreakpoints })
    const resolved = resolveBreakpoints({ breakpoints: canvasBreakpoints })
    const expected = styleProps.flatMap((prop) => getVarsClasses(prop, resolved).split(' '))
    const { matched } = await uno.generate('', { preflights: false })

    expect([...matched].sort()).toEqual(expected.sort())
  })

  it('derives the safelist from the resolved UnoCSS theme breakpoints', async () => {
    const uno = await createUno()
    const breakpoints = (uno.config.theme as { breakpoints: Record<string, string> }).breakpoints
    const resolved = resolveBreakpoints({ breakpoints })
    const expected = styleProps.flatMap((prop) => getVarsClasses(prop, resolved).split(' '))
    const { matched } = await uno.generate('', { preflights: false })

    expect([...matched].sort()).toEqual(expected.sort())
    expect(matched).toContain('o:xl:c-$c-xl')
    expect(matched).toContain('o:2xl:c-$c-2xl')
  })

  it('emits the override layer after the default layer', async () => {
    const uno = await createUno()
    const { css } = await uno.generate(['c-red', 'o:c-$c'], {
      preflights: false,
      safelist: false,
    })

    expect(css.indexOf('/* layer: default */')).toBeGreaterThanOrEqual(0)
    expect(css.indexOf('/* layer: override */')).toBeGreaterThan(css.indexOf('/* layer: default */'))
  })

  /**
   * The emission-order test above cannot fail in the direction that matters.
   * UnoCSS sorts layers by `(layers[a] ?? 0) - (layers[b] ?? 0) || a.localeCompare(b)`,
   * so with no declared order both layers sit at 0 and the tiebreak is
   * alphabetical - and `default` happens to sort before `override`. Delete the
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

    expect(layers.override).toBeGreaterThan(layers.default ?? 0)
  })

  it('supports a stock theme when the base breakpoint is explicit', async () => {
    const uno = await createUno(
      { baseBreakpoint: 'sm' },
      { sm: '640px', md: '768px', lg: '1024px' },
    )
    const { matched } = await uno.generate('', { preflights: false })

    expect(matched).toContain('o:c-$c')
    expect(matched).toContain('o:md:c-$c-md')
  })

  it('supports an explicit breakpoint override', async () => {
    const uno = await createUno({
      breakpoints: { mobile: 0, desktop: '64rem' },
    })
    const { css, matched } = await uno.generate('', { preflights: false })

    expect(matched).toContain('o:c-$c')
    expect(matched).toContain('o:desktop:c-$c-desktop')
    expect(matched).not.toContain('o:md:c-$c-md')
    expect(css).toContain('@media (min-width: 64rem)')
  })

  it('throws when neither the theme nor options provide breakpoints', async () => {
    const uno = await createGenerator({
      presets: [presetVUnoStyle()],
    })

    await expect(uno.generate('', { preflights: false }))
      .rejects.toThrow('No breakpoints found')
  })

  it('throws when no base breakpoint can be resolved', async () => {
    const uno = await createUno({}, { sm: '640px', md: '768px' })

    await expect(uno.generate('', { preflights: false }))
      .rejects.toThrow('Unable to resolve a base breakpoint')
  })
})
