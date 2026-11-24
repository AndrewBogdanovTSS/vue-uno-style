import { describe, expect, it } from 'vitest'
import { findUsedProperties, objectLiteralKeys } from '../src/core/usage'

describe('objectLiteralKeys', () => {
  it.each<[string, string[]]>([
    ['{ c: color, mt: { sm: \'8px\', md: \'16px\' } }', ['c', 'mt']],
    ['{ \'gap-x\': a, "min-w": b }', ['gap-x', 'min-w']],
    ['{ c, bg }', ['c', 'bg']],
    ['{ c: a, }', ['c']],
    ['{ c: dark ? \'#fff\' : \'#000\', p: \'1rem\' }', ['c', 'p']],
    ['{ c: \'a,b:c\', p: `x${y}`, m: fn(1, { w: 2 }), h: [1, 2] }', ['c', 'p', 'm', 'h']],
    ['{ ...base, p: \'1rem\' }', ['p']],
    ['{ [prop]: value, w: \'1px\' }', ['w']],
    ['  { mx: a }  ', ['mx']]
  ])('reads %s', (expression, keys) => {
    expect(objectLiteralKeys(expression)).toEqual(keys)
  })

  it.each(['block.styles', 'cond ? { c: a } : { bg: b }', '', '[1, 2]'])('gives no keys for %j', (expression) => {
    expect(objectLiteralKeys(expression)).toEqual([])
  })
})

describe('findUsedProperties', () => {
  const sfc = `<template>
  <section>
    <h1 v-uno-style:c="{ sm: '#111', md: color }">Title</h1>
    <div v-uno-style="{ mt: { sm: '8px' }, 'px': '1rem' }" />
    <p v-uno-style='{ "gap-y": gap }'>Text</p>
    <p v-uno-style:w.lazy = "width" />
    <p v-uno-style="block.styles" />
    <p v-uno-style:[dynamic]="value" />
    <p v-uno-styles:h="nope" />
    <p data-v-uno-style:h="nope" />
  </section>
</template>`

  it('finds static arguments and object literal keys, and nothing dynamic', () => {
    expect(findUsedProperties(sfc, 'uno-style')).toEqual(['c', 'mt', 'px', 'gap-y', 'w'])
  })

  it('reads a renamed directive only', () => {
    const code = '<div v-style:mb="a" v-uno-style:mt="b" />'

    expect(findUsedProperties(code, 'style')).toEqual(['mb'])
  })

  it('ignores HTML comments and escaped code samples', () => {
    const code = '<!-- <p v-uno-style:pl="a" /> --><pre><code>&lt;p v-uno-style:mb="b" /&gt;</code></pre><p v-uno-style:mt="c" />'

    expect(findUsedProperties(code, 'uno-style')).toEqual(['mt'])
  })

  it('reads attributes after a quoted value that holds < or >', () => {
    const code = '<div v-if="count > 0 && a < b" title=\'x > y\' v-uno-style:mt="a"></div>'

    expect(findUsedProperties(code, 'uno-style')).toEqual(['mt'])
  })

  it('reads a string template inside a script', () => {
    expect(findUsedProperties('const template = `<div v-uno-style:mb="a" />`', 'uno-style')).toEqual(['mb'])
  })

  it('reads the kebab-case spelling of a camelCase directive name', () => {
    expect(findUsedProperties('<div v-uno-style:mt="a" v-unoStyle:mb="b" />', 'unoStyle')).toEqual(['mt', 'mb'])
  })

  it('skips a file without the directive', () => {
    expect(findUsedProperties('<div class="mt-4" />', 'uno-style')).toEqual([])
  })
})
