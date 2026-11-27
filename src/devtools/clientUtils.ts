/** Pure helpers of the DevTools tab, kept apart from the DOM code so they can be unit-tested. */

/** An element updated this many times or more is flagged as churning. */
export const CHURN_THRESHOLD = 10

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  '\'': '&#39;'
}

export const escapeHtml = (value: unknown): string =>
  String(value ?? '').replace(/[&<>"']/g, (character) => ESCAPES[character] ?? character)

export const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} kB`
}

const pad = (value: number, length = 2) => String(value).padStart(length, '0')

/**
 * A hook duration in milliseconds. Browsers round `performance.now()` to 0.1 ms or coarser
 * outside cross-origin isolation, so anything shorter reads as `< 0.1 ms`.
 */
export const formatDuration = (milliseconds: number): string => {
  if (milliseconds < 0.1) return '< 0.1 ms'
  return `${milliseconds.toFixed(milliseconds < 10 ? 2 : 1)} ms`
}

/** `HH:MM:SS.mmm` in local time. */
export const formatTime = (time: number): string => {
  const date = new Date(time)
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`
}

export const formatValue = (value: unknown): string => {
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value) ?? String(value)
  }
  catch {
    return String(value)
  }
}

/**
 * Reads the REPL's value field: JSON when it parses, otherwise the raw text, which only makes
 * sense as a scalar for a given property.
 */
export const parseReplValue = (text: string): unknown => {
  const trimmed = text.trim()
  if (!trimmed) return undefined
  try {
    return JSON.parse(trimmed)
  }
  catch {
    return trimmed
  }
}

/**
 * The value each property has at each breakpoint, read from the CSS variables on the element:
 * `--<property>` for the base, `--<property>-<breakpoint>` for the others. Reading the element
 * rather than the binding values shows what the CSS really gets after bindings merge variable
 * by variable and repeated values collapse.
 */
export const valuesByBreakpoint = (
  properties: readonly string[],
  variables: Readonly<Record<string, string>>,
  base: string,
  prefixed: readonly string[]
): Record<string, Record<string, string>> => Object.fromEntries(properties.map((property) => [
  property,
  Object.fromEntries([base, ...prefixed]
    .map((breakpoint) => [
      breakpoint,
      variables[breakpoint === base ? `--${property}` : `--${property}-${breakpoint}`]
    ])
    .filter(([, value]) => value !== undefined))
]))

/**
 * The value that applies at `breakpoint`: the closest one at or below it, the way min-width
 * media queries cascade.
 */
export const effectiveValue = (
  values: Record<string, unknown>,
  order: readonly string[],
  breakpoint: string
): unknown => {
  const index = order.indexOf(breakpoint)
  for (let position = index; position >= 0; position--) {
    const value = values[order[position]!]
    if (value !== undefined && value !== null && value !== '' && value !== false) return value
  }
  return undefined
}

export interface ElementFlags {
  churn: boolean
  unchanged: boolean
}

export const elementFlags = (element: { updates: number }): ElementFlags => ({
  churn: element.updates >= CHURN_THRESHOLD,
  unchanged: element.updates === 0
})

export const matchesFilter = (
  element: { label: string, properties: readonly string[], className: string },
  filter: string
): boolean => {
  const query = filter.trim().toLowerCase()
  if (!query) return true
  return element.label.toLowerCase().includes(query)
    || element.properties.some((property) => property.toLowerCase().includes(query))
    || element.className.toLowerCase().includes(query)
}
