# vue-uno-style

Responsive runtime styles for Vue, backed by UnoCSS.

`vue-uno-style` turns API- or CMS-provided responsive values into CSS variables
and UnoCSS classes. It ships a Vue directive, a UnoCSS preset, an ESLint rule
and a Nuxt module that wires them together.

```vue
<h1 v-uno-style:c="{ sm: '#111827', md: '#4f46e5' }">Responsive heading</h1>
```

renders `class="o:c-$c o:md:c-$c-md"` with `--c: #111827; --c-md: #4f46e5`.
UnoCSS turns those classes into `color: var(--c)`, the second one inside the
`md` media query.

## Install

```bash
npm install vue-uno-style unocss vue
```

Requires Node 24 or newer, Vue 3.4 or newer, and UnoCSS 66 or newer. The Nuxt
module also needs Nuxt 3.17 and `@unocss/nuxt` 66 or newer; the ESLint rule
needs ESLint 9 and `vue-eslint-parser`.

## Properties

The package predefines no properties: you list the ones your app uses.
`properties` is required, and the build fails without it.

```ts
// vue-uno-style.properties.js (plain JS, so eslint.config.js can import it too)
export default ['c', 'bg', 'p', 'gap', { name: 'bgi', format: 'url' }]
```

Each entry is a UnoCSS utility prefix whose rule accepts a `<prefix>-$<variable>`
value. `presetWind3` already does for most utilities (`c`, `bg`, `p`, `m`, `w`,
`h`, `gap`, ...). For anything else, add the rule yourself:

```ts
// uno.config.ts
rules: [
  [/^bgi-\$(.+)$/, ([, name]) => ({ 'background-image': `var(--${name})` })],
]
```

`format: 'url'` wraps each value as `url(<value>)`, for properties fed plain
image URLs.

> [!IMPORTANT]
> The directive creates class names at runtime, so source scanning cannot find
> them. Always install `presetVUnoStyle()` as well: it safelists the classes for
> every configured property and adds the `o:` variant and override layer.

## Breakpoints

One breakpoint is the unprefixed base, used before any media query:

- A breakpoint valued `0`, `"0"`, `"0px"`, or `""` is selected automatically.
- If none has a zero value, `baseBreakpoint` is required.
- An explicit `baseBreakpoint` always wins.

The stock UnoCSS theme has `sm: 640px`, so it needs `baseBreakpoint: 'sm'` or a
zero-valued breakpoint. The package throws instead of guessing.

## Nuxt

```ts
// nuxt.config.ts
import properties from './vue-uno-style.properties.js'

export default defineNuxtConfig({
  modules: ['@unocss/nuxt', 'vue-uno-style/nuxt'],
  vUnoStyle: {
    properties,
    baseBreakpoint: 'sm',
    // directiveName: 'style', // register as v-style instead of v-uno-style
  },
})
```

The module adds the preset, reads breakpoints from the resolved UnoCSS theme
(or `breakpoints`, when given) and registers the directive.

## Vue and UnoCSS without Nuxt

Give the preset and the directive the same properties and breakpoints:

```ts
// uno.config.ts
import { defineConfig, presetWind3 } from 'unocss'
import { presetVUnoStyle } from 'vue-uno-style/preset'
import properties from './vue-uno-style.properties.js'

const breakpoints = { sm: 0, md: '768px', lg: '1024px' }

export default defineConfig({
  presets: [presetWind3(), presetVUnoStyle({ properties, breakpoints })],
  theme: { breakpoints },
})
```

```ts
// main.ts
import { createVUnoStyle } from 'vue-uno-style'
import properties from './vue-uno-style.properties.js'

app.directive('uno-style', createVUnoStyle({
  properties,
  breakpoints: { sm: 0, md: '768px', lg: '1024px' },
}))
```

Passing `properties` to the directive applies their formats and warns in
development about a property the preset does not safelist.

## Usage

Use an argument for one property, or an object for several:

```vue
<template>
  <article
    v-uno-style="{
      c: { sm: '#111827', md: '#ffffff' },
      bg: { sm: '#ffffff', md: '#4f46e5' },
    }"
  >
    <p v-uno-style:p="'1rem'">Body</p>
  </article>
</template>
```

A scalar applies to the base breakpoint. Adjacent breakpoints with the same
value collapse into one class.

A single-root component may carry the directive on its root while its usage
site applies another. Both apply, and the usage site wins a shared property.

## ESLint

`vue-uno-style/no-multiple-v-style` reports more than one directive on a tag
and autofixes adjacent ones into the object form. Given `properties`, it also
reports arguments outside them.

```js
// eslint.config.js
import vUnoStyle from 'vue-uno-style/eslint'
import vueParser from 'vue-eslint-parser'
import properties from './vue-uno-style.properties.js'

export default [
  ...vUnoStyle.configs.recommended,
  {
    files: ['**/*.vue'],
    languageOptions: { parser: vueParser },
    rules: {
      'vue-uno-style/no-multiple-v-style': ['error', { properties }],
    },
  },
]
```

Pass `directiveName` as well when the directive is registered under another
name.

## WebStorm completion

The package ships a [web-types](https://github.com/JetBrains/web-types) file,
so WebStorm completes `v-uno-style`. The Nuxt module rewrites it inside the
installed package with your `directiveName` and `properties`, so completion
offers exactly your properties. Nothing is written to your project.

The file is replaced rather than edited, so pnpm's shared store stays intact.
A read-only or missing `node_modules` (Yarn PnP) only logs a warning. Two apps
sharing one installed copy overwrite each other's file. `webTypes: false`
turns the rewrite off; `createWebTypes()` builds the file for setups without
Nuxt.

## API

The root entry exports the directive and the pure helpers behind it:
`createVUnoStyle`, `vUnoStyle` (sm/md/lg breakpoints, no properties),
`getStyle`, `getStyleProps`, `getVarsClasses`, `resolveBreakpoints`,
`resolveProperties`, `createWebTypes` and their types.

## Development

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm build
pnpm smoke
pnpm check:docs
pnpm demo:install && pnpm demo:verify
```

`demo/` is a Nuxt app using every entry, including custom `bgi` and `bgv`
properties. `pnpm release` bumps, tags and pushes; the tag starts the release
workflow, which publishes with provenance.

## Licence

MIT
