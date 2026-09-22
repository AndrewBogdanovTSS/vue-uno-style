<script setup lang="ts">
import { computed, ref } from 'vue'

/**
 * The second palette exists so the page can exercise the directive's update
 * path, not just its first render. Server rendering and `beforeMount` both
 * write the generated classes and variables once; swapping a bound value is
 * what drives `updated`, which has to remove the previous value's classes and
 * custom properties before applying the new ones. Without something on the page
 * that changes, that half of the directive is never run in a browser.
 */
const palettes = {
  indigo: {
    label: 'Indigo',
    titleColor: { sm: '#0f172a', md: '#ffffff' },
    surfaceBackground: {
      sm: 'linear-gradient(135deg, #e0e7ff, #f5f3ff)',
      md: 'linear-gradient(135deg, #4338ca, #7c3aed)',
    },
    cardPadding: { sm: '1.5rem', md: '3rem' },
    heroImage: { sm: '/dots.svg', md: '/dots.svg?wide' },
  },
  amber: {
    label: 'Amber',
    titleColor: { sm: '#451a03', md: '#fffbeb' },
    surfaceBackground: {
      sm: 'linear-gradient(135deg, #fef3c7, #fffbeb)',
      md: 'linear-gradient(135deg, #b45309, #f59e0b)',
    },
    // Only `sm` here: dropping the `md` entry proves `updated` removes the
    // `--p-md` custom property and its class rather than leaving them behind.
    cardPadding: { sm: '2.25rem' },
    heroImage: { sm: '/dots.svg?amber', md: '/dots.svg?amber-wide' },
  },
}

const active = ref('indigo')
const palette = computed(() => palettes[active.value])

const toggle = () => {
  active.value = active.value === 'indigo' ? 'amber' : 'indigo'
}
</script>

<template>
  <main class="min-h-screen grid place-items-center bg-slate-100 p-6 font-sans">
    <article
      data-demo-object
      class="relative max-w-3xl w-full overflow-hidden rounded-2xl shadow-xl"
      v-uno-style="{
        c: palette.titleColor,
        bgv: palette.surfaceBackground,
        p: palette.cardPadding,
      }"
    >
      <div
        data-demo-argument
        class="absolute inset-0 op-20"
        v-uno-style:bgi="palette.heroImage"
      />

      <div class="relative flex flex-col gap-4">
        <p class="font-semibold tracking-wide uppercase">v-uno-style</p>
        <h1 class="m-0 text-4xl font-bold">Runtime values, generated CSS</h1>
        <p class="m-0 max-w-2xl text-lg">
          This page is server-rendered with the Nuxt module. The card uses the
          object syntax, while its texture uses the argument syntax and the
          package's background-image rule.
        </p>

        <div class="flex items-center gap-3">
          <button
            data-demo-toggle
            type="button"
            class="cursor-pointer border-0 rounded-lg bg-white/90 px-4 py-2 text-sm text-slate-900 font-semibold"
            @click="toggle"
          >
            Switch palette
          </button>
          <span data-demo-palette class="text-sm font-medium">{{ palette.label }}</span>
        </div>
      </div>
    </article>
  </main>
</template>
