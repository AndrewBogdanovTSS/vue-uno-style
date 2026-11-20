<script setup lang="ts">
defineProps<{ label: string }>()
</script>

<template>
  <!-- The component's own directive. A usage site can add another; both apply. -->
  <span
    class="status-badge"
    v-uno-style="{
      c: { sm: '#334155' },
      bg: { sm: '#e2e8f0' },
      p: { sm: '0.25rem 0.75rem', md: '0.375rem 1rem' },
    }"
  >{{ label }}</span>
</template>
