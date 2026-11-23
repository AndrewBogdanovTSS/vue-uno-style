import { isPropertyName } from './properties'

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Matches a `v-<directiveName>` attribute with a quoted value: the static argument in group 1,
 * the value in group 2 (double quotes) or 3 (single quotes). A dynamic argument (`:[prop]`) does
 * not match, so it names no property.
 */
const attributePattern = (directiveName: string) => new RegExp(
  `(?<![\\w-])v-${escapeRegExp(directiveName)}(?::([\\w-]+))?(?:\\.[\\w-]+)*\\s*=\\s*(?:"([^"]*)"|'([^']*)')`,
  'g'
)

const OPEN = '{[('
const CLOSE = '}])'
const QUOTES = '"\'`'

/** The index of the quote that closes the string opening at `start`. */
const stringEnd = (source: string, start: number) => {
  const quote = source[start]
  let index = start + 1
  while (index < source.length && source[index] !== quote) {
    index += source[index] === '\\' ? 2 : 1
  }
  return index
}

const unquote = (key: string) => QUOTES.includes(key[0] ?? '') && key.at(-1) === key[0] ? key.slice(1, -1) : key

/**
 * The top-level keys of an object literal, such as `c` and `mt` in
 * `{ c: color, mt: { sm: '8px', md: '16px' } }`. Quoted keys and shorthand properties count;
 * computed keys and spreads do not. Anything other than an object literal gives no keys.
 */
export const objectLiteralKeys = (expression: string): string[] => {
  const source = expression.trim()
  if (!source.startsWith('{') || !source.endsWith('}')) return []

  const keys: string[] = []
  let depth = 0
  let segment = ''
  let inValue = false

  const endEntry = () => {
    const key = unquote(segment.trim())
    if (!inValue && isPropertyName(key)) keys.push(key)
    segment = ''
    inValue = false
  }

  for (let index = 0; index < source.length; index++) {
    const char = source[index]!

    if (QUOTES.includes(char)) {
      const end = stringEnd(source, index)
      if (depth === 1 && !inValue) segment += source.slice(index, end + 1)
      index = end
    }
    else if (OPEN.includes(char)) {
      // A bracket that opens before the colon is a computed key, which names no property
      if (depth === 1 && !inValue) segment += char
      depth++
    }
    else if (CLOSE.includes(char)) {
      depth--
      if (depth === 0) endEntry()
    }
    else if (depth === 1) {
      if (char === ',') endEntry()
      else if (char === ':' && !inValue) {
        const key = unquote(segment.trim())
        if (isPropertyName(key)) keys.push(key)
        inValue = true
      }
      else if (!inValue) segment += char
    }
  }

  return keys
}

/**
 * The properties a source file sets through `v-<directiveName>`: each static argument, and the
 * top-level keys of each object literal value. A value that is not an object literal, such as
 * `v-uno-style="block.styles"`, names no property: its keys only exist at runtime.
 */
export const findUsedProperties = (code: string, directiveName: string): string[] => {
  if (!code.includes(`v-${directiveName}`)) return []

  const found = new Set<string>()
  for (const [, argument, double, single] of code.matchAll(attributePattern(directiveName))) {
    if (argument) found.add(argument)
    else objectLiteralKeys(double ?? single ?? '').forEach((key) => found.add(key))
  }

  return [...found]
}
