import type { PropertyConfig } from './properties'
import { resolveProperties } from './properties'

export interface WebTypesOptions {
  /** Directive registration name without the `v-` prefix. */
  directiveName: string
  /** Version recorded in the file; WebStorm uses it to tell revisions apart. */
  version: string
  /** Configured properties to offer as arguments, after the default properties. */
  properties?: readonly PropertyConfig[]
  /**
   * Whether to offer the default properties too. Defaults to `true`. With `false` and no
   * `properties`, any argument is accepted.
   */
  defaultProperties?: boolean
}

/** Shape of the generated file, limited to the parts this package writes. */
export interface WebTypes {
  '$schema': string
  'name': string
  'version': string
  'framework': 'vue'
  'js-types-syntax': 'typescript'
  'description-markup': 'markdown'
  'contributions': {
    html: {
      'vue-directives': Array<{
        'name': string
        'description': string
        'doc-url': string
        'attribute-value': { type: string, required: boolean }
        'argument': {
          name: string
          description: string
          pattern?: { or: string[] }
        }
      }>
    }
  }
}

const DOC_URL = 'https://github.com/AndrewBogdanovTSS/vue-uno-style#readme'

/**
 * Builds the JetBrains web-types description of the directive, so WebStorm completes
 * `v-<directiveName>` and the known properties as its arguments: the configured ones and the
 * defaults. The list is the same one the preset accepts, so completion cannot drift from it.
 */
export const createWebTypes = ({ directiveName, version, properties, defaultProperties = true }: WebTypesOptions): WebTypes => ({
  '$schema': 'https://raw.githubusercontent.com/JetBrains/web-types/master/schema/web-types.json',
  'name': 'vue-uno-style',
  version,
  'framework': 'vue',
  'js-types-syntax': 'typescript',
  'description-markup': 'markdown',
  'contributions': {
    html: {
      'vue-directives': [{
        'name': directiveName,
        'description': 'Generates UnoCSS classes and CSS variables from a responsive value, '
          + 'so a CSS property can take a different value per breakpoint. '
          + `Use \`v-${directiveName}:<property>="{ sm: ..., md: ... }"\` for one property, `
          + `or \`v-${directiveName}="{ <property>: { ... } }"\` for several.`,
        'doc-url': DOC_URL,
        'attribute-value': {
          type: 'VUnoStyleValue',
          required: true
        },
        'argument': {
          name: 'property',
          description: 'Style property to set responsively. Omit it to pass several '
            + 'properties as an object.',
          ...(defaultProperties || properties?.length
            ? { pattern: { or: resolveProperties(properties, { defaultProperties }).known } }
            : {})
        }
      }]
    }
  }
})

/** Serialises web-types the same way for the shipped file and the Nuxt module's rewrite. */
export const serializeWebTypes = (webTypes: WebTypes): string =>
  `${JSON.stringify(webTypes, null, 2)}\n`
