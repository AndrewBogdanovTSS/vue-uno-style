import type { GapPrefix } from './fixtures/customRules'
import type { Preset, Rule } from 'unocss'
import { createGenerator, presetMini, presetWind3 } from 'unocss'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveBreakpoints } from '../src/core/breakpoints'
import { getStyle } from '../src/core/getStyle'
import { resolveProperties } from '../src/core/properties'
import { getVarsClasses } from '../src/core/varsClasses'
import { presetVUnoStyle } from '../src/preset'
import { builtIn, gapDeclarations, gapRules, urlRule } from './fixtures/customRules'

/**
 * Proves what the README's "Custom rules" section claims: which prefixes each preset lacks, that
 * the documented rules serve every class the directive can write for them, and that an app rule
 * replaces the preset's own. The rules come from the fixture the docs check compares the README
 * against, so the README can only show rules that pass here.
 */

const breakpoints = { sm: 0, md: '768px' }
const resolved = resolveBreakpoints({ breakpoints })
const presets = { presetMini, presetWind3 } as const satisfies Record<string, () => Preset>
const prefixes = Object.keys(gapRules) as GapPrefix[]

const generate = async (preset: () => Preset, tokens: string, rules: Rule[] = []) => {
  const uno = await createGenerator({ presets: [preset()], rules })
  return (await uno.generate(tokens, { preflights: false })).css
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('custom rules', () => {
  describe.each(Object.entries(presets))('%s', (presetName, preset) => {
    it.each(prefixes)('ships a rule for "%s" exactly when the README says so', async (prefix) => {
      const css = await generate(preset, `${prefix}-$${prefix}`)

      expect(css !== '').toBe(builtIn[prefix][presetName as keyof typeof presets])
    })

    const missing = prefixes.filter((prefix) => !builtIn[prefix][presetName as keyof typeof presets])

    it.each(missing)('serves every class the directive writes for "%s" with the documented rule', async (prefix) => {
      const uno = await createGenerator({
        presets: [preset(), presetVUnoStyle({ properties: [prefix], breakpoints })],
        rules: [gapRules[prefix]],
      })
      const { css, matched } = await uno.generate('', { preflights: false })

      expect([...matched].sort()).toEqual(getVarsClasses(prefix, resolved).split(' ').sort())
      expect(css).toContain(gapDeclarations[prefix](prefix))
      expect(css).toContain('@media (min-width: 768px)')
      expect(css).toContain(gapDeclarations[prefix](`${prefix}-md`))
    })
  })

  it('pairs the url rule with format: \'url\', so the rule itself stays a plain var()', async () => {
    const properties = [{ name: 'bgi', format: 'url' }] as const
    const { style } = getStyle({ sm: '/hero.png' }, resolved, 'bgi', resolveProperties(properties))
    const uno = await createGenerator({
      presets: [presetMini(), presetVUnoStyle({ properties, breakpoints })],
      rules: [urlRule],
    })
    const { css } = await uno.generate('', { preflights: false })

    expect(style).toEqual({ '--bgi': 'url(/hero.png)' })
    expect(css).toContain('background-image:var(--bgi);')
  })

  it('replaces the preset\'s own rule for the same class, which is why the README warns', async () => {
    const own = await generate(presetWind3, 'blur-$blur')
    const replaced = await generate(presetWind3, 'blur-$blur', [gapRules.blur])

    expect(own).toContain('--un-blur:blur(var(--blur));')
    expect(replaced).toContain('filter:blur(var(--blur));')
    expect(replaced).not.toContain('--un-blur')
  })

  it('leaves prose such as `blur-$*` alone, thanks to the [\\w-]+ variable match', async () => {
    const css = await generate(presetMini, 'use blur-$* or col-span-$ in docs', Object.values(gapRules))

    expect(css).toBe('')
  })

  it('reports nothing for a property no rule serves, as the README states', async () => {
    const warn = vi.spyOn(console, 'warn')
    const uno = await createGenerator({
      presets: [presetMini(), presetVUnoStyle({ properties: ['object'], breakpoints })],
    })
    const { css, matched } = await uno.generate('', { preflights: false })

    expect(css).toBe('')
    expect(matched.size).toBe(0)
    expect(warn).not.toHaveBeenCalled()
  })
})
