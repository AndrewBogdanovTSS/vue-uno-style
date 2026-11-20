import type { Linter as LinterType } from 'eslint'
import { Linter } from 'eslint'
import * as vueParser from 'vue-eslint-parser'
import { describe, expect, it } from 'vitest'
import plugin, { noMultipleVStyle } from '../src/eslint'

const properties = ['c', 'bg', { name: 'bgi', format: 'url' as const }]

const createConfig = (
  directiveName?: string,
  configured?: typeof properties,
): LinterType.Config[] => [{
  files: ['**/*.vue', '*.vue'],
  plugins: {
    'vue-uno-style': {
      rules: { 'no-multiple-v-style': noMultipleVStyle },
    },
  },
  rules: {
    'vue-uno-style/no-multiple-v-style': directiveName || configured
      ? ['error', { directiveName, properties: configured }]
      : 'error',
  },
  languageOptions: { parser: vueParser },
}]

const verify = (code: string, directiveName?: string, configured?: typeof properties) =>
  new Linter({ configType: 'flat' })
    .verify(code, createConfig(directiveName, configured), { filename: 'test.vue' })

const fix = (code: string, directiveName?: string) => new Linter({ configType: 'flat' })
  .verifyAndFix(code, createConfig(directiveName), { filename: 'test.vue' }).output

describe('vue-uno-style/no-multiple-v-style', () => {
  describe('valid', () => {
    it('allows a single argument-style directive', () => {
      expect(verify('<template><div v-uno-style:c="color" /></template>')).toHaveLength(0)
    })

    it('allows object syntax on a single directive', () => {
      expect(verify('<template><div v-uno-style="{ c: color, display }" /></template>'))
        .toHaveLength(0)
    })

    it('allows elements without the configured directive', () => {
      expect(verify('<template><div v-style:c="color" /></template>')).toHaveLength(0)
    })

    it('allows one directive per element across multiple elements', () => {
      expect(verify(
        '<template><div v-uno-style:c="a" /><div v-uno-style:c="b" /></template>',
      )).toHaveLength(0)
    })

    it.each(['c', 'bg', 'bgi'])('allows the configured "%s" property', (prop) => {
      expect(verify(`<template><div v-uno-style:${prop}="value" /></template>`, undefined, properties))
        .toHaveLength(0)
    })

    it('accepts any property when none are configured', () => {
      expect(verify('<template><div v-uno-style:paddign="value" /></template>'))
        .toHaveLength(0)
    })

    it('allows a dynamic argument because it cannot be checked statically', () => {
      expect(verify('<template><div v-uno-style:[prop]="value" /></template>'))
        .toHaveLength(0)
    })

    it('supports a renamed directive', () => {
      expect(verify('<template><div v-style:c="value" /></template>', 'style')).toHaveLength(0)
    })
  })

  describe('invalid', () => {
    it('reports a static property outside the configured ones', () => {
      expect(verify('<template><div v-uno-style:paddign="value" /></template>', undefined, properties))
        .toEqual([expect.objectContaining({
          messageId: 'unknownStyleProp',
          message:
            'Unknown v-uno-style property "paddign". Add it to the configured properties.',
        })])
    })

    it('reports an unconfigured property for a renamed directive', () => {
      expect(verify('<template><div v-style:paddign="value" /></template>', 'style', properties))
        .toEqual([expect.objectContaining({
          messageId: 'unknownStyleProp',
          message: 'Unknown v-style property "paddign". Add it to the configured properties.',
        })])
    })

    it('merges two argument-style directives into an object', () => {
      const code = '<template><div v-uno-style:c="textColor" v-uno-style:display="display" /></template>'

      expect(verify(code)).toEqual([
        expect.objectContaining({ messageId: 'multipleVStyle' }),
      ])
      expect(fix(code)).toBe(
        '<template><div v-uno-style="{ c: textColor, display: display }" /></template>',
      )
    })

    it('merges directives using the configured name', () => {
      const code = '<template><div v-style:c="textColor" v-style:display="display" /></template>'

      expect(verify(code, 'style')).toEqual([
        expect.objectContaining({ messageId: 'multipleVStyle' }),
      ])
      expect(fix(code, 'style')).toBe(
        '<template><div v-style="{ c: textColor, display: display }" /></template>',
      )
    })

    it('merges three argument-style directives into a single object', () => {
      const code = '<template><div v-uno-style:c="a" v-uno-style:display="b" v-uno-style:p="c" /></template>'

      expect(fix(code)).toBe(
        '<template><div v-uno-style="{ c: a, display: b, p: c }" /></template>',
      )
    })

    it('inlines object-syntax properties beside an argument directive', () => {
      const code = '<template><div v-uno-style="{ c: a }" v-uno-style:display="b" /></template>'

      expect(fix(code)).toBe(
        '<template><div v-uno-style="{ c: a, display: b }" /></template>',
      )
    })

    it('spreads a plain directive expression into the merged object', () => {
      const code = '<template><div v-uno-style="myStyles" v-uno-style:display="b" /></template>'

      expect(fix(code)).toBe(
        '<template><div v-uno-style="{ ...myStyles, display: b }" /></template>',
      )
    })

    it('reports only the violating element and leaves siblings untouched', () => {
      const code = '<template><div v-uno-style:c="a" v-uno-style:display="b" /><span v-uno-style:c="c" /></template>'

      expect(verify(code)).toEqual([
        expect.objectContaining({ messageId: 'multipleVStyle' }),
      ])
      expect(fix(code)).toBe(
        '<template><div v-uno-style="{ c: a, display: b }" /><span v-uno-style:c="c" /></template>',
      )
    })

    it('does not autofix across an unrelated attribute', () => {
      const code = '<template><div v-uno-style:c="a" class="card" v-uno-style:p="b" /></template>'

      expect(verify(code)).toEqual([
        expect.objectContaining({ messageId: 'multipleVStyle' }),
      ])
      expect(fix(code)).toBe(code)
    })

    it('quotes all keys when any argument name contains a hyphen', () => {
      const code = '<template><div v-uno-style:m="a" v-uno-style:text-size="b" /></template>'

      expect(fix(code)).toBe(
        `<template><div v-uno-style="{ 'm': a, 'text-size': b }" /></template>`,
      )
    })
  })

  it('exports a flat recommended config', () => {
    expect(plugin.meta).toEqual({
      name: 'vue-uno-style',
      version: '0.0.0-dev',
    })
    expect(plugin.configs.recommended).toEqual([
      expect.objectContaining({
        files: ['**/*.vue'],
        plugins: { 'vue-uno-style': plugin },
        rules: { 'vue-uno-style/no-multiple-v-style': 'error' },
      }),
    ])
  })

  it('enables the rule through the recommended config', () => {
    const config: LinterType.Config[] = [
      ...plugin.configs.recommended,
      {
        files: ['**/*.vue'],
        languageOptions: { parser: vueParser },
      },
    ]
    const messages = new Linter({ configType: 'flat' }).verify(
      '<template><div v-uno-style:c="a" v-uno-style:p="b" /></template>',
      config,
      { filename: 'test.vue' },
    )

    expect(messages).toEqual([
      expect.objectContaining({ messageId: 'multipleVStyle' }),
    ])
  })
})
