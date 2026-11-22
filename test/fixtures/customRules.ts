import type { KnownRulePrefix } from '../../src/knownRules'
import type { Rule } from 'unocss'
import { knownRule, knownRules } from '../../src/knownRules'

/**
 * The custom rules the README's "Custom rules" section shows. `test/customRules.test.ts` runs
 * them, and `pnpm check:docs` checks that the README quotes each rule line verbatim: the `bgi`
 * example below as written, the gap rules as `knownRuleSource()` prints them from
 * `src/knownRules.ts`, which the DevTools tab suggests too.
 */

/** The README's `format: 'url'` example: the directive writes `url(...)`, the rule stays plain. */
export const urlRule: Rule = [/^bgi-\$([\w-]+)$/, ([, name]) => ({ 'background-image': `var(--${name})` })]

export type GapPrefix = KnownRulePrefix

/** Rules for the prefixes `presetMini` lacks, and `col-span`, which `presetWind3` lacks too. */
export const gapRules = Object.fromEntries(
  (Object.keys(knownRules) as GapPrefix[]).map((prefix) => [prefix, knownRule(prefix)])
) as Record<GapPrefix, Rule>

/** The declaration each gap rule writes for a variable, as UnoCSS prints it: the tests' oracle. */
export const gapDeclarations: Record<GapPrefix, (variable: string) => string> = {
  'object': (variable) => `object-fit:var(--${variable});`,
  'blur': (variable) => `filter:blur(var(--${variable}));`,
  'columns': (variable) => `columns:var(--${variable});`,
  'col-span': (variable) => `grid-column:span var(--${variable}) / span var(--${variable});`
}

export type SupportedPreset = 'presetMini' | 'presetWind3' | 'presetWind4'

/** The README's table: which presets ship a `<prefix>-$<variable>` rule of their own. */
export const builtIn: Record<GapPrefix, Record<SupportedPreset, boolean>> = {
  'object': { presetMini: false, presetWind3: true, presetWind4: true },
  'blur': { presetMini: false, presetWind3: true, presetWind4: true },
  'columns': { presetMini: false, presetWind3: true, presetWind4: true },
  'col-span': { presetMini: false, presetWind3: false, presetWind4: true }
}

/**
 * The prefixes checked against every preset: the README's, the playground's, and the layout,
 * typography, transform and colour utilities a CMS-driven page typically sets. Each preset ships
 * a rule for all of them except the gaps in `builtIn`, so a UnoCSS upgrade that adds or drops one
 * fails the test and the README's table gets updated with it.
 */
export const checkedPrefixes = [
  'c', 'text', 'bg', 'p', 'px', 'pt', 'm', 'mx', 'w', 'h', 'min-w', 'max-w', 'min-h', 'max-h',
  'gap', 'gap-x', 'rounded', 'shadow', 'opacity', 'font', 'leading', 'tracking', 'b', 'top', 'left',
  'inset', 'z', 'order', 'flex', 'basis', 'grid-cols', 'col-span', 'aspect', 'object', 'translate-x',
  'rotate', 'scale', 'blur', 'duration', 'columns', 'indent', 'outline', 'ring', 'fill', 'stroke',
  'decoration', 'text-size', 'fw', 'lh'
] as const
