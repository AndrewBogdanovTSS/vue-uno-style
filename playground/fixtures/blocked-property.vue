<!--
  Not part of the app. This file exists to be linted and to fail, so that
  `playground:verify` proves the rule reports a blocked property, here as a key
  of an object literal, with the message from `config/vue-uno-style.ts`.
-->
<template>
  <div v-uno-style="{ c: titleColor, tracking: spacing }" />
</template>

<script setup lang="ts">
const titleColor = { sm: '#0f172a' }
const spacing = { sm: '0.02em' }
</script>
