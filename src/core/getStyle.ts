import type { ResolvedBreakpoints } from './breakpoints'
import { getStyleProps } from './getStyleProps'

export const styleProps = [
  'aspect-ratio',
  'b',
  'bg',
  'bgi',
  'bgv',
  'c',
  'display',
  'gap',
  'gap-x',
  'gap-y',
  'grid-area',
  'grid-col',
  'cols',
  'grid-row',
  'rows',
  'h',
  'inset',
  'lh',
  'max-h',
  'max-w',
  'min-h',
  'min-w',
  'm',
  'mb',
  'mt',
  'ml',
  'mr',
  'mx',
  'my',
  'object-position',
  'p',
  'pb',
  'pr',
  'pt',
  'px',
  'py',
  'row-start',
  'text-size',
  'top',
  'w',
] as const

export type StyleProp = typeof styleProps[number]
export type StyleValue = number | string
export type Responsive<T = StyleValue> = Record<string, T | undefined>
export type ResponsiveStyles = Partial<Record<StyleProp, Responsive>>

export interface StyleResult {
  classes: string
  style: Record<string, StyleValue>
}

const supportedStyleProps = new Set<string>(styleProps)
const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

const warnUnknownStyleProp = (prop: string) => {
  const isDevelopment = typeof process === 'undefined' || process.env.NODE_ENV !== 'production'
  if (isDevelopment && !supportedStyleProps.has(prop)) {
    console.warn(`[v-uno-style] Unknown style property "${prop}".`)
  }
}

/**
 * Converts responsive values into UnoCSS classes and CSS custom properties.
 */
export const getStyle = (
  config: Responsive | ResponsiveStyles,
  breakpoints: ResolvedBreakpoints,
  arg?: string,
): StyleResult => {
  const styleConfig = (arg ? { [arg]: config } : config) as Record<string, Responsive | undefined>

  const result = Object.entries(styleConfig).reduce<{
    classes: string[]
    style: Record<string, StyleValue>
  }>((acc, [prop, value]) => {
    if (!value || (isObject(value) && Object.keys(value).length === 0)) return acc

    warnUnknownStyleProp(prop)
    const { styles = {}, classList = [] } = getStyleProps(prop as StyleProp, value, breakpoints)

    return {
      classes: [...acc.classes, ...classList],
      style: { ...acc.style, ...styles },
    }
  }, {
    classes: [],
    style: {},
  })

  return { ...result, classes: result.classes.join(' ') }
}
