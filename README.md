# vue-uno-style

Responsive runtime styles for Vue, backed by UnoCSS custom properties.

`vue-uno-style` turns API- or CMS-provided responsive values into CSS variables and
UnoCSS classes. The package includes the Vue directive, the UnoCSS preset that
makes its generated classes work, an ESLint rule, and a Nuxt module that wires
the pieces together.

## Breakpoints: choose the base explicitly

The directive needs one breakpoint to mean “unprefixed” (the value used before
any media query):

- A breakpoint valued `0`, `"0"`, `"0px"`, or `""` is selected automatically.
- If none has a zero value, `baseBreakpoint` is required.
- An explicit `baseBreakpoint` always wins.

This matters with the stock UnoCSS theme, where `sm` is `640px`, not a base
breakpoint. In that case configure `baseBreakpoint: 'sm'` deliberately, or add a
zero-valued breakpoint. The package throws instead of guessing.

> [!IMPORTANT]
> The directive creates class names at runtime, so source scanning cannot find
> them. Always install `presetVUnoStyle()` as well. It supplies the safelist,
> `o:` variant, variable rules, and override layer used by the directive.

## Install

```bash
npm install vue-uno-style unocss vue
```

Requires Node 24 or newer, Vue 3.4 or newer, and UnoCSS 66 or newer. The Nuxt
integration additionally requires Nuxt 3.17 or newer and `@unocss/nuxt` 66 or
newer. The ESLint integration requires ESLint 9 or newer and
`vue-eslint-parser`.

## Nuxt module

The Nuxt module is the shortest setup. Register UnoCSS first, then
`vue-uno-style/nuxt`:

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@unocss/nuxt', 'vue-uno-style/nuxt'],
  vUnoStyle: {
    baseBreakpoint: 'sm',
  },
})
```

The module reads the resolved UnoCSS theme, adds the preset, and registers the
directive as `v-uno-style`. To keep an existing `v-style` API:

```ts
export default defineNuxtConfig({
  modules: ['@unocss/nuxt', 'vue-uno-style/nuxt'],
  vUnoStyle: {
    directiveName: 'style',
    baseBreakpoint: 'sm',
  },
})
```

The same options can provide `breakpoints` directly when they should not come
from the UnoCSS theme.

## Vue directive

For plain Vue, create the directive with the same breakpoints used by UnoCSS:

```ts
// main.ts
import { createApp } from 'vue'
import { createVUnoStyle } from 'vue-uno-style'
import App from './App.vue'

const app = createApp(App)

app.directive('uno-style', createVUnoStyle({
  breakpoints: { sm: 0, md: '768px', lg: '1024px' },
}))

app.mount('#app')
```

The package also exports `vUnoStyle`, preconfigured with the Canvas-compatible
`{ sm: 0, md: 768, lg: 1024 }` breakpoints.

Use an argument for one property:

```vue
<template>
  <h1 v-uno-style:c="{ sm: '#111827', md: '#4f46e5' }">
    Responsive heading
  </h1>
</template>
```

Use the object form for several properties on one element:

```vue
<template>
  <article
    v-uno-style="{
      c: { sm: '#111827', md: '#ffffff' },
      bg: { sm: '#ffffff', md: '#4f46e5' },
      p: { sm: '1rem', md: '2rem' },
    }"
  >
    Responsive card
  </article>
</template>
```

Values may also be scalar. A scalar is assigned to the resolved base
breakpoint: `v-uno-style:p="'1rem'"`.

## UnoCSS preset

The preset and directive must use the same breakpoints:

```ts
// uno.config.ts
import { defineConfig, presetWind3 } from 'unocss'
import { presetVUnoStyle } from 'vue-uno-style/preset'

const breakpoints = { sm: 0, md: '768px', lg: '1024px' }

export default defineConfig({
  presets: [
    presetWind3(),
    presetVUnoStyle({ breakpoints }),
  ],
  theme: { breakpoints },
})
```

If the theme already contains the breakpoints, omit `breakpoints` from the
preset. For a stock non-zero theme, pass `baseBreakpoint`:

```ts
presetVUnoStyle({ baseBreakpoint: 'sm' })
```

The preset declares the `override` layer after UnoCSS’s default layer, so
runtime values win over ordinary utilities on the same element.

## ESLint plugin

The directive merges its output into one class and style binding. Write one
directive per element: multiple instances in one template tag are rejected by
`vue-uno-style/no-multiple-v-style`, which can autofix adjacent directives into
the object form. It also reports unsupported argument names.

A single-root component may still carry its own directive on its root element
while its usage site applies another. Vue merges both bindings onto that root,
and the directive composes them: classes and variables from both apply, and the
usage site wins when both set the same property.

```js
// eslint.config.js
import vUnoStyle from 'vue-uno-style/eslint'
import vueParser from 'vue-eslint-parser'

export default [
  ...vUnoStyle.configs.recommended,
  {
    files: ['**/*.vue'],
    languageOptions: { parser: vueParser },
  },
]
```

When the directive is registered under another name, configure the rule with
the same name:

```js
export default [{
  files: ['**/*.vue'],
  languageOptions: { parser: vueParser },
  plugins: { 'vue-uno-style': vUnoStyle },
  rules: {
    'vue-uno-style/no-multiple-v-style': ['error', { directiveName: 'style' }],
  },
}]
```

## Supported properties

Property names follow UnoCSS utility prefixes. Each responsive value becomes a
CSS custom property consumed by that utility.

| Property | CSS intent |
| --- | --- |
| `aspect-ratio` | Aspect ratio |
| `b` | Border colour |
| `bg` | Background colour |
| `bgi` | Background image; values are wrapped in `url(...)` |
| `bgv` | Raw `background` value, including gradients |
| `c` | Text colour |
| `display` | Display mode |
| `gap` | Grid or flex gap |
| `gap-x` | Column gap |
| `gap-y` | Row gap |
| `grid-area` | Grid area |
| `grid-col` | Grid column |
| `cols` | Grid template columns |
| `grid-row` | Grid row |
| `rows` | Grid template rows |
| `h` | Height |
| `inset` | Inset offsets |
| `lh` | Line height |
| `max-h` | Maximum height |
| `max-w` | Maximum width |
| `min-h` | Minimum height |
| `min-w` | Minimum width |
| `m` | Margin |
| `mb` | Bottom margin |
| `mt` | Top margin |
| `ml` | Left margin |
| `mr` | Right margin |
| `mx` | Horizontal margins |
| `my` | Vertical margins |
| `object-position` | Replaced-element object position |
| `p` | Padding |
| `pb` | Bottom padding |
| `pr` | Right padding |
| `pt` | Top padding |
| `px` | Horizontal padding |
| `py` | Vertical padding |
| `row-start` | Grid row start |
| `text-size` | Font size |
| `top` | Top offset |
| `w` | Width |

Adjacent breakpoints with the same value are collapsed. Missing breakpoint
values are omitted. A property not listed above is reported by the ESLint rule
and warned about by development builds of the runtime.

## Direct API

The root entry also exports the pure helpers and their types:

```ts
import {
  getStyle,
  getStyleProps,
  getVarsClasses,
  resolveBreakpoints,
  styleProps,
} from 'vue-uno-style'
```

## Demo

`demo/` is a minimal Nuxt app exercising the module, preset, directive, ESLint
plugin, argument and object syntaxes, `bgi`, `bgv`, and server-rendered output:

```bash
pnpm build
pnpm demo:install
pnpm demo:verify
pnpm demo:dev
```

## Development

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm build
pnpm smoke
pnpm check:docs
```

## Releasing

`pnpm release` validates the repository, bumps and tags the version, and pushes
the tag. The tag starts the GitHub Actions release workflow; publishing stays in
CI so npm can attach provenance.

## Licence

MIT
