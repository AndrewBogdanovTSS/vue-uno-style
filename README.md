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

## Options

Every option each entry accepts. The Nuxt module passes `properties`,
`breakpoints` and `baseBreakpoint` on to the preset and the directive, so a
Nuxt app sets them once.

### Property entries

Each item in `properties` is a string or an object. `'c'` is the same as
`{ name: 'c' }`.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `name` | `string` | required | UnoCSS utility prefix: a letter, then letters, digits or dashes. Each name may appear once. |
| `format` | `'url'` | none | `url` writes each value as `url(<value>)`. No other format exists. |

A missing or empty list, an invalid name, a repeated name or an unknown format
throws.

### Breakpoint values

`breakpoints` maps names to minimum widths, smallest first, for example
`{ sm: 0, md: '768px', lg: '1024px' }`. A number means pixels. A string is used
as written, so `'48rem'` works. Collapsing of repeated values follows this
order.

### Nuxt module

Set under `vUnoStyle` in `nuxt.config.ts`. The module needs `@unocss/nuxt`
registered, and fails the build without it.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `properties` | `PropertyConfig[]` | required | The properties the directive may set. See [Property entries](#property-entries). |
| `breakpoints` | `Record<string, number \| string>` | the UnoCSS theme's | Breakpoints for the preset and the directive. They replace `theme.breakpoints`. |
| `baseBreakpoint` | `string` | the zero-valued breakpoint | The unprefixed breakpoint. See [Breakpoints](#breakpoints). |
| `directiveName` | `string` | `'uno-style'` | Registration name without `v-`. `'style'` registers `v-style`. |
| `webTypes` | `boolean` | `true` | Rewrites the installed package's `web-types.json` with `directiveName` and `properties`. `false` keeps the shipped file. |

Without `breakpoints`, the module reads `theme.breakpoints` from the same
UnoCSS config that `@unocss/nuxt` loads: `uno.config.*`, the file named in
`unocss.configFile`, and the inline `unocss` options.

### UnoCSS preset

`presetVUnoStyle(options)` from `vue-uno-style/preset`.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `properties` | `PropertyConfig[]` | required | Safelists every class the directive can write for these properties. |
| `breakpoints` | `Record<string, number \| string>` | `theme.breakpoints` | Breakpoints for the media queries and the safelist. They replace `theme.breakpoints`. |
| `baseBreakpoint` | `string` | the zero-valued breakpoint | The unprefixed breakpoint. |

The preset throws when it finds neither `breakpoints` nor `theme.breakpoints`.

### Directive

`createVUnoStyle(options)` from `vue-uno-style`. Give it the same values as the
preset.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `breakpoints` | `Record<string, number \| string>` | required | Only the names, their order and the base are used; widths live in the CSS. |
| `baseBreakpoint` | `string` | the zero-valued breakpoint | The unprefixed breakpoint. |
| `properties` | `PropertyConfig[]` | none | Applies value formats. In development, warns about a property that is not listed. |

`vUnoStyle` is `createVUnoStyle({ breakpoints: { sm: 0, md: 768, lg: 1024 } })`,
with no properties, so it applies no formats.

### ESLint rule

Options for `vue-uno-style/no-multiple-v-style`.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `directiveName` | `string` | `'uno-style'` | Directive name without `v-`. |
| `properties` | `PropertyConfig[]` | none | Reports a static argument (`v-uno-style:x`) that is not listed. Object keys and dynamic arguments are not checked. |

`configs.recommended` turns the rule on as `error` for `**/*.vue`, without
options and without a parser. The autofix is skipped when another attribute
sits between the directives.

### Web-types

`createWebTypes(options)` from `vue-uno-style`. `serializeWebTypes()` turns the
result into the file's text.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `directiveName` | `string` | required | Directive name without `v-`. |
| `version` | `string` | required | Version recorded in the file. WebStorm uses it to tell revisions apart. |
| `properties` | `PropertyConfig[]` | none | Arguments offered for completion. Without them, any argument is accepted. |

## API

The root entry exports the directive and the pure helpers behind it:
`createVUnoStyle`, `vUnoStyle`, `getStyle`, `getStyleProps`,
`getVarsClasses`, `formatValue`, `resolveBreakpoints`, `resolveProperties`,
`createWebTypes`, `serializeWebTypes` and their types.

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
