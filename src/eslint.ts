import type { PropertyConfig } from './core/properties'
import type { Linter, Rule } from 'eslint'
import { resolveProperties } from './core/properties'

declare const __PACKAGE_VERSION__: string

export interface NoMultipleVStyleOptions {
  /** Directive registration name without the `v-` prefix. */
  directiveName?: string
  /** The properties configured for the preset. When set, other argument names are reported. */
  properties?: PropertyConfig[]
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
 * configured properties when they are passed.
 */
export const noMultipleVStyle: Rule.RuleModule = {
  meta: {
    type: 'problem',
    fixable: 'code',
    docs: {
      description: 'Disallow multiple v-uno-style directives and unconfigured properties'
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
        }
      },
      additionalProperties: false
    }],
    messages: {
      multipleVStyle:
        'Multiple v-{{directiveName}} directives on a single element are not allowed. '
        + 'Combine them using the object syntax: v-{{directiveName}}="{ prop1: val1, prop2: val2 }".',
      unknownStyleProp:
        'Unknown v-{{directiveName}} property "{{prop}}". Add it to the configured properties.'
    }
  },

  create(context) {
    const parserServices = context.sourceCode.parserServices as VueParserServices | undefined
    if (!parserServices?.defineTemplateBodyVisitor) return {}

    const sourceCode = context.sourceCode
    const options = context.options[0] as NoMultipleVStyleOptions | undefined
    const directiveName = options?.directiveName ?? defaultDirectiveName
    const configured = options?.properties
      ? new Set(resolveProperties(options.properties).names)
      : undefined

    return parserServices.defineTemplateBodyVisitor({
      VStartTag(node) {
        const directiveAttributes = node.attributes.filter(
          (attribute) => attribute.directive && attribute.key?.name?.name === directiveName
        )

        directiveAttributes.forEach((attribute) => {
          const argument = attribute.key?.argument
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
