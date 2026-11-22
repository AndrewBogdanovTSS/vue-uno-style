import { describe, expect, it } from 'vitest'
import {
  CHURN_THRESHOLD,
  effectiveValue,
  elementFlags,
  escapeHtml,
  formatBytes,
  formatTime,
  matchesFilter,
  parseReplValue,
  valuesByBreakpoint
} from '../src/devtools/clientUtils'

describe('DevTools client helpers', () => {
  it('escapes HTML', () => {
    expect(escapeHtml('<a href="x">\'&\'</a>')).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;')
    expect(escapeHtml(undefined)).toBe('')
  })

  it('formats bytes and times', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1536)).toBe('1.5 kB')
    expect(formatBytes(20 * 1024)).toBe('20 kB')
    expect(formatTime(new Date(2026, 0, 1, 9, 5, 7, 42).getTime())).toBe('09:05:07.042')
  })

  it('reads the REPL value as JSON, else as text', () => {
    expect(parseReplValue('{ "sm": "red" }')).toEqual({ sm: 'red' })
    expect(parseReplValue('12')).toBe(12)
    expect(parseReplValue('#111')).toBe('#111')
    expect(parseReplValue('  ')).toBeUndefined()
  })

  it('tabulates values per breakpoint from the element variables', () => {
    expect(valuesByBreakpoint(
      ['c', 'bg', 'p'],
      { '--c': 'white', '--c-md': 'red', '--bg-lg': 'gray', '--bg-image': 'x' },
      'sm',
      ['md', 'lg']
    )).toEqual({
      c: { sm: 'white', md: 'red' },
      bg: { lg: 'gray' },
      p: {}
    })
  })

  it('finds the value that applies at a breakpoint', () => {
    const order = ['sm', 'md', 'lg']

    expect(effectiveValue({ sm: 'a', lg: 'c' }, order, 'md')).toBe('a')
    expect(effectiveValue({ sm: 'a', lg: 'c' }, order, 'lg')).toBe('c')
    expect(effectiveValue({ md: 'b' }, order, 'sm')).toBeUndefined()
    // The directive skips a numeric zero, so the cascade does too
    expect(effectiveValue({ sm: 'a', md: 0 }, order, 'md')).toBe('a')
  })

  it('flags unchanged and churning elements', () => {
    expect(elementFlags({ updates: 0 })).toEqual({ churn: false, unchanged: true })
    expect(elementFlags({ updates: CHURN_THRESHOLD })).toEqual({ churn: true, unchanged: false })
  })

  it('filters by label, property or class', () => {
    const element = { label: 'Card › section', properties: ['bg'], className: 'card o:bg-$bg' }

    expect(matchesFilter(element, '')).toBe(true)
    expect(matchesFilter(element, 'card')).toBe(true)
    expect(matchesFilter(element, 'BG')).toBe(true)
    expect(matchesFilter(element, 'nav')).toBe(false)
  })
})
