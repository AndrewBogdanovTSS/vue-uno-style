import type { Rule } from 'unocss'

/**
 * Rules for `<prefix>-$<variable>` prefixes some base presets do not ship: presetMini lacks all
 * four, presetWind3 lacks `col-span`, presetWind4 ships them all. The README's "Custom rules"
 * section quotes them, and the DevTools tab suggests them for a property no rule serves.
 *
 * Each rule is kept as data, so one entry yields both the rule the tests run and the source text
 * the README and the tab show. The two cannot drift apart.
 */
interface KnownRule {
  /** The CSS property the rule writes. */
  property: string
  /** The declaration's value, with `{name}` where the variable name goes. */
  value: string
}

export const knownRules = {
  'object': { property: 'object-fit', value: 'var(--{name})' },
  'blur': { property: 'filter', value: 'blur(var(--{name}))' },
  'columns': { property: 'columns', value: 'var(--{name})' },
  'col-span': { property: 'grid-column', value: 'span var(--{name}) / span var(--{name})' },
} as const satisfies Record<string, KnownRule>

export type KnownRulePrefix = keyof typeof knownRules

export const isKnownRulePrefix = (prefix: string): prefix is KnownRulePrefix =>
  Object.hasOwn(knownRules, prefix)

/** The rule for UnoCSS's `rules`. */
export const knownRule = (prefix: KnownRulePrefix): Rule => {
  const { property, value } = knownRules[prefix]

  return [
    new RegExp(`^${prefix}-\\$([\\w-]+)$`),
    ([, name]) => ({ [property]: value.replaceAll('{name}', name) }),
  ]
}

/** The same rule as source text, in the shape the README's recipe teaches. */
export const knownRuleSource = (prefix: KnownRulePrefix): string => {
  const { property, value } = knownRules[prefix]
  const key = /^[a-z]+$/.test(property) ? property : `'${property}'`

  return `[/^${prefix}-\\$([\\w-]+)$/, ([, name]) => ({ ${key}: \`${value.replaceAll('{name}', '${name}')}\` })]`
}
