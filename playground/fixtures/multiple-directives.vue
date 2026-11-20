<!--
  Not part of the app. This file exists to be linted and to fail, so that
  `playground:verify` proves the ESLint plugin actually fires through the package
  export rather than merely resolving. Linting only clean files reports success
  whether the rule works or has silently stopped matching.
-->
<template>
  <div v-uno-style:c="titleColor" class="card" v-uno-style:bgv="surface" />
</template>

<script setup lang="ts">
const titleColor = { sm: '#0f172a' }
const surface = { sm: '#ffffff' }
</script>
