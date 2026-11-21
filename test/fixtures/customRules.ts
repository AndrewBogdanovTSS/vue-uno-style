import type { Rule } from 'unocss'

/**
 * The custom rules the README's "Custom rules" section shows, kept in one place so that
 * `test/customRules.test.ts` runs them and `pnpm check:docs` checks that the README quotes each
 * rule line verbatim. Edit a rule here and in the README together, or the docs check fails.
 */

/** The README's `format: 'url'` example: the directive writes `url(...)`, the rule stays plain. */
export const urlRule: Rule = [/^bgi-\$([\w-]+)$/, ([, name]) => ({ 'background-image': `var(--${name})` })]

export type GapPrefix = 'object' | 'blur' | 'columns' | 'col-span'

/** Rules for the prefixes that `presetMini`, and in one case `presetWind3`, do not ship. */
export const gapRules: Record<GapPrefix, Rule> = {
  'object': [/^object-\$([\w-]+)$/, ([, name]) => ({ 'object-fit': `var(--${name})` })],
  'blur': [/^blur-\$([\w-]+)$/, ([, name]) => ({ filter: `blur(var(--${name}))` })],
  'columns': [/^columns-\$([\w-]+)$/, ([, name]) => ({ columns: `var(--${name})` })],
  'col-span': [/^col-span-\$([\w-]+)$/, ([, name]) => ({ 'grid-column': `span var(--${name}) / span var(--${name})` })],
}

/** The declaration each gap rule writes for a variable, as UnoCSS prints it. */
export const gapDeclarations: Record<GapPrefix, (variable: string) => string> = {
  'object': (variable) => `object-fit:var(--${variable});`,
  'blur': (variable) => `filter:blur(var(--${variable}));`,
  'columns': (variable) => `columns:var(--${variable});`,
  'col-span': (variable) => `grid-column:span var(--${variable}) / span var(--${variable});`,
}

/** The README's table: which presets ship a `<prefix>-$<variable>` rule of their own. */
export const builtIn: Record<GapPrefix, { presetMini: boolean, presetWind3: boolean }> = {
  'object': { presetMini: false, presetWind3: true },
  'blur': { presetMini: false, presetWind3: true },
  'columns': { presetMini: false, presetWind3: true },
  'col-span': { presetMini: false, presetWind3: false },
}
