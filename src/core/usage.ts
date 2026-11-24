import { isPropertyName } from './properties'

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const hyphenate = (name: string) => name.replace(/\B([A-Z])/g, '-$1').toLowerCase()

/**
 * The spellings a template may use for a directive registered as `directiveName`: the name as
 * given, and its kebab-case form, which Vue also resolves - `v-uno-style` for `unoStyle`.
 */
export const directiveNameForms = (directiveName: string): string[] =>
  [...new Set([directiveName, hyphenate(directiveName)])]

/**
 * Matches a whole attribute name of the directive: the static argument in group 1. A dynamic
 * argument (`:[prop]`) does not match, so it names no property.
 */
const directiveAttributePattern = (directiveName: string) => new RegExp(
  `^v-(?:${directiveNameForms(directiveName).map(escapeRegExp).join('|')})(?::([\\w-]+))?(?:\\.[\\w-]+)*$`
)

const TAG_START = /<[a-z][\w.:-]*/gi
const COMMENT = /<!--[\s\S]*?-->/g
const isSpace = (char: string | undefined) => char !== undefined && /\s/.test(char)

interface Attribute {
  name: string
  value?: string
}

/**
 * Reads the attributes of the tag whose name ends at `start`, up to its closing `>`. Quoted values
 * may hold `>` or `<`. Returns them with the index just past the tag.
 */
const readAttributes = (source: string, start: number): { attributes: Attribute[], end: number } => {
  const attributes: Attribute[] = []
  let index = start

  while (index < source.length) {
    while (isSpace(source[index])) index++
    const char = source[index]
    if (char === undefined || char === '>') return { attributes, end: index + 1 }
    if (char === '/' || char === '<') {
      index++
      continue
    }

    let name = ''
    while (index < source.length && !isSpace(source[index]) && !'=>/'.includes(source[index]!)) {
      name += source[index]
      index++
    }
    while (isSpace(source[index])) index++

    let value: string | undefined
    if (source[index] === '=') {
      index++
      while (isSpace(source[index])) index++
      const quote = source[index]
      if (quote === '"' || quote === '\'') {
        const close = source.indexOf(quote, index + 1)
        const end = close === -1 ? source.length : close
        value = source.slice(index + 1, end)
        index = end + 1
      }
      else {
        value = ''
        while (index < source.length && !isSpace(source[index]) && source[index] !== '>') {
          value += source[index]
          index++
        }
      }
    }

    if (name) attributes.push({ name, value })
  }

  return { attributes, end: index }
}

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
 * The properties a source file sets through `v-<directiveName>` on a tag: each static argument,
 * and the top-level keys of each object literal value. A value that is not an object literal,
 * such as `v-uno-style="block.styles"`, names no property: its keys only exist at runtime.
 *
 * Only attributes of real tags count, so HTML comments and escaped code samples
 * (`&lt;p v-uno-style:mb="..."&gt;`) do not. A tag written out in a Markdown code block does.
 */
export const findUsedProperties = (code: string, directiveName: string): string[] => {
  if (!directiveNameForms(directiveName).some((form) => code.includes(`v-${form}`))) return []

  const source = code.replace(COMMENT, '')
  const pattern = directiveAttributePattern(directiveName)
  const tags = new RegExp(TAG_START.source, TAG_START.flags)
  const found = new Set<string>()

  for (let match = tags.exec(source); match; match = tags.exec(source)) {
    const { attributes, end } = readAttributes(source, match.index + match[0].length)
    tags.lastIndex = end

    for (const { name, value } of attributes) {
      const directive = pattern.exec(name)
      if (!directive) continue
      if (directive[1]) found.add(directive[1])
      else objectLiteralKeys(value ?? '').forEach((key) => found.add(key))
    }
  }

  return [...found]
}
