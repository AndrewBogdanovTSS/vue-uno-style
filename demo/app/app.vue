<script setup lang="ts">
const titleColor = {
  sm: '#0f172a',
  md: '#ffffff',
}

const surfaceBackground = {
  sm: 'linear-gradient(135deg, #e0e7ff, #f5f3ff)',
  md: 'linear-gradient(135deg, #4338ca, #7c3aed)',
}

const cardPadding = {
  sm: '1.5rem',
  md: '3rem',
}

const heroImage = {
  sm: '/dots.svg',
  md: '/dots.svg?wide',
}
</script>

<template>
  <main class="min-h-screen grid place-items-center bg-slate-100 p-6 font-sans">
    <article
      data-demo-object
      class="relative max-w-3xl w-full overflow-hidden rounded-2xl shadow-xl"
      v-uno-style="{
        c: titleColor,
        bgv: surfaceBackground,
        p: cardPadding,
      }"
    >
      <div
        data-demo-argument
        class="absolute inset-0 op-20"
        v-uno-style:bgi="heroImage"
      />

      <div class="relative flex flex-col gap-4">
        <p class="font-semibold tracking-wide uppercase">v-uno-style</p>
        <h1 class="m-0 text-4xl font-bold">Runtime values, generated CSS</h1>
        <p class="m-0 max-w-2xl text-lg">
          This page is server-rendered with the Nuxt module. The card uses the
          object syntax, while its texture uses the argument syntax and the
          package's background-image rule.
        </p>
      </div>
    </article>
  </main>
</template>
