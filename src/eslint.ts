import type { BlockedPropertyConfig, PropertyConfig } from './core/properties'
import type { Linter, Rule } from 'eslint'
import { blockedPropertyMessage, findBlocked, resolveProperties } from './core/properties'

declare const __PACKAGE_VERSION__: string

export interface NoMultipleVStyleOptions {
  /** Directive registration name without the `v-` prefix. */
  directiveName?: string
  /** The properties configured for the preset. Arguments outside them and the defaults are reported. */
  properties?: PropertyConfig[]
  /**
   * Whether the default properties are known. Defaults to `true`. With `false` and no
   * `properties`, any argument is accepted.
   */
  defaultProperties?: boolean
  /**
   * Properties the project forbids. A static argument or an object literal key naming one is
   * reported with its message, default properties included.
   */
  blockedProperties?: BlockedPropertyConfig[]
}

export interface VUnoStyleEslintPlugin {
  meta: {
    name: string
    version: string
  }
  rules: Record<string, Rule.RuleModule>
  configs: Record<string, Linter.Config[]>
}

interface VueNode {
  type: string
  range: [number, number]
}

interface VueIdentifier extends VueNode {
  type: 'VIdentifier'
  name: string
}

interface VueDirectiveKey {
  name?: { name?: string }
  argument?: VueNode | VueIdentifier | null
}

interface ObjectProperty extends VueNode {
  type: string
  computed?: boolean
  key?: VueNode & { name?: string, value?: unknown }
}

/** The static name of an object literal key: `mt` in `{ mt: a }` or `{ 'mt': a }`. */
const objectKeyName = (property: ObjectProperty): string | undefined => {
  if (property.type !== 'Property' || property.computed || !property.key) return undefined
  if (property.key.type === 'Identifier') return property.key.name
  if (property.key.type === 'Literal' && typeof property.key.value === 'string') return property.key.value
  return undefined
}

interface VueDirectiveAttribute extends VueNode {
  directive: boolean
  key?: VueDirectiveKey
  value?: { expression?: VueNode | null } | null
}

interface VueStartTag extends VueNode {
  attributes: VueDirectiveAttribute[]
}

interface VueParserServices {
  defineTemplateBodyVisitor: (visitor: {
    VStartTag: (node: VueStartTag) => void
  }) => Rule.RuleListener
}

interface RenderEntry {
  dynamic?: boolean
  key?: string
  raw?: string
  spread?: string
  value?: string
}

const defaultDirectiveName = 'uno-style'
const asRuleNode = (node: VueNode): Rule.Node => node as unknown as Rule.Node

/**
 * Disallows multiple v-uno-style directives on one element, and argument names outside the
 * known properties: the configured ones and the defaults.
 */
export const noMultipleVStyle: Rule.RuleModule = {
  meta: {
    type: 'problem',
    fixable: 'code',
    docs: {
      description: 'Disallow multiple v-uno-style directives and unknown properties'
    },
    schema: [{
      type: 'object',
      properties: {
        directiveName: {
          type: 'string',
          minLength: 1
        },
        properties: {
          type: 'array',
          minItems: 1,
          items: {
            anyOf: [
              { type: 'string', minLength: 1 },
              {
                type: 'object',
                properties: {
                  name: { type: 'string', minLength: 1 },
                  format: { type: 'string' }
                },
                required: ['name'],
                additionalProperties: false
              }
            ]
          }
        },
        defaultProperties: {
          type: 'boolean'
        },
        blockedProperties: {
          type: 'array',
          items: {
            anyOf: [
              { type: 'string', minLength: 1 },
              {
                type: 'object',
                properties: {
                  name: { type: 'string', minLength: 1 },
                  message: { type: 'string' }
                },
                required: ['name'],
                additionalProperties: false
              }
            ]
          }
        }
      },
      additionalProperties: false
    }],
    messages: {
      multipleVStyle:
        'Multiple v-{{directiveName}} directives on a single element are not allowed. '
        + 'Combine them using the object syntax: v-{{directiveName}}="{ prop1: val1, prop2: val2 }".',
      blockedStyleProp: 'v-{{directiveName}}: {{text}}',
      unknownStyleProp:
        'Unknown v-{{directiveName}} property "{{prop}}". It is not a default property: add it to the configured properties.'
    }
  },

  create(context) {
    const parserServices = context.sourceCode.parserServices as VueParserServices | undefined
    if (!parserServices?.defineTemplateBodyVisitor) return {}

    const sourceCode = context.sourceCode
    const options = context.options[0] as NoMultipleVStyleOptions | undefined
    const directiveName = options?.directiveName ?? defaultDirectiveName
    const defaultProperties = options?.defaultProperties ?? true
    // With the defaults off and no properties, nothing is known, so any argument passes. The
    // defaults then only stand in to resolve the blocked properties, which are still checked.
    const checksKnown = defaultProperties || Boolean(options?.properties?.length)
    const resolved = resolveProperties(options?.properties, {
      defaultProperties: checksKnown ? defaultProperties : true,
      blockedProperties: options?.blockedProperties
    })
    const configured = checksKnown ? new Set(resolved.known) : undefined

    /** Reports `name` when the project blocks it, and says whether it did. */
    const reportBlocked = (node: VueNode, name: string): boolean => {
      const blocked = findBlocked(resolved, name)
      if (blocked) {
        context.report({
          node: asRuleNode(node),
          messageId: 'blockedStyleProp',
          data: { directiveName, text: blockedPropertyMessage(blocked) }
        })
      }
      return Boolean(blocked)
    }

    return parserServices.defineTemplateBodyVisitor({
      VStartTag(node) {
        const directiveAttributes = node.attributes.filter(
          (attribute) => attribute.directive && attribute.key?.name?.name === directiveName
        )

        directiveAttributes.forEach((attribute) => {
          const expression = attribute.value?.expression
          if (!attribute.key?.argument && expression?.type === 'ObjectExpression') {
            (expression as unknown as { properties: ObjectProperty[] }).properties.forEach((property) => {
              const name = objectKeyName(property)
              if (name && property.key) reportBlocked(property.key, name)
            })
          }

          const argument = attribute.key?.argument
          if (argument?.type === 'VIdentifier' && reportBlocked(argument, (argument as VueIdentifier).name)) return
          if (
            configured
            && argument?.type === 'VIdentifier'
            && !configured.has((argument as VueIdentifier).name)
          ) {
            context.report({
              node: asRuleNode(argument),
              messageId: 'unknownStyleProp',
              data: {
                directiveName,
                prop: (argument as VueIdentifier).name
              }
            })
          }
        })

        if (directiveAttributes.length < 2) return

        const getEntries = (attribute: VueDirectiveAttribute): RenderEntry[] => {
          const argument = attribute.key?.argument
          if (argument) {
            const valueSource = attribute.value?.expression
              ? sourceCode.getText(asRuleNode(attribute.value.expression))
              : 'undefined'

            if (argument.type === 'VIdentifier') {
              return [{
                key: (argument as VueIdentifier).name,
                value: valueSource,
                dynamic: false
              }]
            }

            return [{
              key: sourceCode.getText(asRuleNode(argument)),
              value: valueSource,
              dynamic: true
            }]
          }

          const expression = attribute.value?.expression
          if (expression?.type === 'ObjectExpression') {
            const properties = (expression as unknown as { properties: VueNode[] }).properties
            return properties.map((property) => ({ raw: sourceCode.getText(asRuleNode(property)) }))
          }

          if (expression) {
            return [{ spread: sourceCode.getText(asRuleNode(expression)) }]
          }

          return []
        }

        const isValidIdentifier = (name: string) => /^[a-z_$][\w$]*$/i.test(name)
        const entries = directiveAttributes.flatMap(getEntries)
        const anyKeyNeedsQuotes = entries.some(
          (entry) => entry.key && !isValidIdentifier(entry.key)
        )
        const renderEntry = (entry: RenderEntry): string => {
          if (entry.spread) return `...${entry.spread}`
          if (entry.raw) return entry.raw
          if (entry.dynamic) return `[${entry.key}]: ${entry.value}`

          const key = anyKeyNeedsQuotes ? `'${entry.key}'` : entry.key
          return `${key}: ${entry.value}`
        }

        const mergedDirective = `v-${directiveName}="{ ${entries.map(renderEntry).join(', ')} }"`
        const firstAttribute = directiveAttributes[0]
        const lastAttribute = directiveAttributes[directiveAttributes.length - 1]
        const hasInterveningAttribute = node.attributes.some((attribute) =>
          !directiveAttributes.includes(attribute)
          && attribute.range[0] > firstAttribute.range[0]
          && attribute.range[1] < lastAttribute.range[1]
        )

        context.report({
          node: asRuleNode(firstAttribute),
          messageId: 'multipleVStyle',
          data: { directiveName },
          fix: hasInterveningAttribute
            ? undefined
            : (fixer) => fixer.replaceTextRange(
                [firstAttribute.range[0], lastAttribute.range[1]],
                mergedDirective
              )
        })
      }
    })
  }
}

const configs: Record<string, Linter.Config[]> = {}

const plugin: VUnoStyleEslintPlugin = {
  meta: {
    name: 'vue-uno-style',
    version: typeof __PACKAGE_VERSION__ === 'string' ? __PACKAGE_VERSION__ : '0.0.0-dev'
  },
  rules: {
    'no-multiple-v-style': noMultipleVStyle
  },
  configs
}

configs.recommended = [{
  name: 'vue-uno-style/recommended',
  files: ['**/*.vue'],
  plugins: { 'vue-uno-style': plugin },
  rules: { 'vue-uno-style/no-multiple-v-style': 'error' }
}]

export default plugin
