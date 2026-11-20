<script setup lang="ts">
import type { Responsive, ResponsiveStyles } from 'vue-uno-style'
import { getStyle, resolveBreakpoints, resolveProperties } from 'vue-uno-style'
import { breakpoints, properties } from '~~/vue-uno-style.config.js'

/**
 * Shows what the directive writes for a value: the same `getStyle()` call it makes, with the
 * playground's breakpoints and properties.
 */
const props = defineProps<{
  value: Responsive | ResponsiveStyles | undefined
  arg?: string
}>()

const resolvedBreakpoints = resolveBreakpoints({ breakpoints })
const resolvedProperties = resolveProperties(properties)

const output = computed(() => props.value
  ? getStyle(props.value, resolvedBreakpoints, props.arg, resolvedProperties)
  : { classes: '', style: {} })
</script>

<template>
  <dl class="output">
    <dt>class</dt>
    <dd>
      <code v-for="name in output.classes.split(' ').filter(Boolean)" :key="name">{{ name }}</code>
      <span v-if="!output.classes" class="muted">none</span>
    </dd>
    <dt>style</dt>
    <dd>
      <code v-for="(value, name) in output.style" :key="name">{{ name }}: {{ value }}</code>
      <span v-if="!Object.keys(output.style).length" class="muted">none</span>
    </dd>
  </dl>
</template>
