import type { PropertyConfig } from './properties'
import { resolveProperties } from './properties'

export interface WebTypesOptions {
  /** Directive registration name without the `v-` prefix. */
  directiveName: string
  /** Version recorded in the file; WebStorm uses it to tell revisions apart. */
  version: string
  /** Configured properties to offer as arguments. Without them any argument is accepted. */
  properties?: readonly PropertyConfig[]
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
 * `v-<directiveName>` and the configured properties as its arguments. The argument list is the
 * same configuration the preset safelists, so completion cannot drift from what generates CSS.
 */
export const createWebTypes = ({ directiveName, version, properties }: WebTypesOptions): WebTypes => ({
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
          required: true,
        },
        'argument': {
          name: 'property',
          description: 'Style property to set responsively. Omit it to pass several '
            + 'properties as an object.',
          ...(properties ? { pattern: { or: resolveProperties(properties).names } } : {}),
        },
      }],
    },
  },
})

/** Serialises web-types the same way for the shipped file and the Nuxt module's rewrite. */
export const serializeWebTypes = (webTypes: WebTypes): string =>
  `${JSON.stringify(webTypes, null, 2)}\n`
