# vue-uno-style

Let data from your CMS or API style an element differently on phones, tablets
and desktops, with plain CSS that UnoCSS generates at build time.

```vue
<h1 v-uno-style:c="{ sm: '#111827', md: '#4f46e5' }">Responsive heading</h1>
```

This heading is dark grey on phones and indigo from 768px up. The two colours
can come from anywhere: a CMS field, an API response, a user's settings.

## Why this exists

Utility CSS such as UnoCSS works when you know the values while you write the
code. You write `md:c-indigo-600`, the build finds that class in your files, and
it generates the CSS for it.

That stops working when a value only arrives once the page runs. Say a CMS
editor picks a heading colour per screen size:

- **A utility class for the value**, such as `md:c-[#4f46e5]`, appears nowhere
  in your source, so the build never generated CSS for it.
- **An inline style** (`style="color: #4f46e5"`) works, but inline styles have no
  media queries. You get one value for every screen.
- **Runtime CSS-in-JS** works, but ships a styling engine to the browser and
  writes new CSS rules while the page runs.

## How it works

The value goes into a CSS variable. A small, fixed set of classes, generated at
build time, decides which variable applies at which screen width:

```html
<!-- what the directive renders -->
<h1 class="o:c-$c o:md:c-$c-md" style="--c: #111827; --c-md: #4f46e5">Responsive heading</h1>
```

```css
/* what the preset generated at build time */
.o\:c-\$c { color: var(--c); }
@media (min-width: 768px) {
  .o\:md\:c-\$c-md { color: var(--c-md); }
}
```

The classes depend only on the properties and breakpoints you configure, never
on the values. Three properties and three breakpoints give nine classes, whatever
the CMS sends. When a value changes, only a CSS variable changes: nothing is
generated in the browser.

What that buys you:

- **Any value from data, per breakpoint.**
- **Static CSS.** There is no styling engine in the browser. The directive only
  sets classes and CSS variables, and it works with server rendering.
- **Defaults stay in the template.** A value from data overrides the element's
  own utility classes. When the data has no value, the template's class applies:

  ```vue
  <h1 class="c-gray-900" v-uno-style:c="cms.headingColor">Responsive heading</h1>
  ```

## When to use it

| Your values are | Use |
|-----------------|-----|
| known while you write the code | plain utility classes |
| from data, and the same on every screen | a plain `:style` binding |
| from data, and different per screen size | `vue-uno-style` |

## What's in the package

- **A Vue directive**, `v-uno-style`, that writes the classes and variables.
- **A UnoCSS preset** that generates their CSS at build time. You always need it:
  see [Properties](#properties).
- **An ESLint rule** that catches a second directive on the same element and,
  given your properties, a property you have not configured.
- **A Nuxt module** that wires them together.

Next on the [roadmap](https://github.com/AndrewBogdanovTSS/vue-uno-style/blob/main/ROADMAP.md):
`presetWind4`, values taken from your design system (`c: 'red-300'`), and a
Tailwind CSS 4 version.

See every behaviour live in the [playground](https://andrewbogdanovtss.github.io/vue-uno-style/).

## Install

```bash
npm install vue-uno-style unocss vue
```

Requires Node 24 or newer, Vue 3.4 or newer, and UnoCSS 66 or newer. The Nuxt
module also needs Nuxt 3.17 and `@unocss/nuxt` 66 or newer; the ESLint rule
needs ESLint 9 and `vue-eslint-parser`.

### Base presets

Any of the three UnoCSS presets with breakpoints works as the base:

| Preset | Breakpoints live in | Default `sm` | Rules you add |
|--------|---------------------|--------------|---------------|
| `presetMini` | `theme.breakpoints` | `640px` | `object`, `blur`, `columns`, `col-span`, if you use them |
| `presetWind3` | `theme.breakpoints` | `640px` | `col-span`, if you use it |
| `presetWind4` | `theme.breakpoint` | `40rem` | none |

The missing rules are listed under [Custom rules](#custom-rules). None of the
three defaults has a zero-valued `sm`, so each needs `baseBreakpoint: 'sm'` or
breakpoints of your own: see [Breakpoints](#breakpoints).

## Properties

The package predefines no properties: you list the ones your app uses.
`properties` is required, and the build fails without it.

```ts
// vue-uno-style.properties.js (plain JS, so eslint.config.js can import it too)
export default ['c', 'bg', 'p', 'gap', { name: 'bgi', format: 'url' }]
```

Each entry is a UnoCSS utility prefix whose rule accepts a `<prefix>-$<variable>`
value. `presetMini`, `presetWind3` and `presetWind4` already do for most
utilities (`c`, `bg`, `p`, `m`, `w`, `h`, `gap`, ...). For anything else, add the
rule yourself: see [Custom rules](#custom-rules).

`format: 'url'` wraps each value as `url(<value>)`, for properties fed plain
image URLs.

> [!IMPORTANT]
> The directive creates class names at runtime, so source scanning cannot find
> them. Always install `presetVUnoStyle()` as well: it safelists the classes for
> every configured property and adds the `o:` variant and override layer.

### Custom rules

A property needs a UnoCSS rule that turns `<prefix>-$<variable>` into CSS.
Without one, its classes get no CSS, and nothing reports it: neither UnoCSS nor
the preset warns. When you add a property, check its CSS once.

Every rule has the same shape. The preset's variants remove `o:` and the
breakpoint before the rule runs, so the rule only ever sees
`<prefix>-$<variable>`, and `name` is the variable without its `--`:

```ts
[/^<prefix>-\$([\w-]+)$/, ([, name]) => ({ '<css-property>': `var(--${name})` })]
```

Match the variable name with `[\w-]+` rather than `.+`: UnoCSS scans every file, and
text such as `bgi-$*` would otherwise produce `var(--*)`, which fails CSS minification.

For a property fed plain image URLs, give its entry `format: 'url'`. The
directive then writes `url(<value>)` into the variable, so the rule stays a plain
`var()`:

```ts
// vue-uno-style.properties.js
export default [{ name: 'bgi', format: 'url' }]
```

```ts
// uno.config.ts
rules: [
  [/^bgi-\$([\w-]+)$/, ([, name]) => ({ 'background-image': `var(--${name})` })]
]
```

#### Prefixes your preset lacks

`presetWind3` builds on `presetMini` and adds rules of its own; `presetWind4`
ships all four below. Among the common utilities, these prefixes need a rule
from you:

| Prefix | `presetMini` | `presetWind3` | `presetWind4` |
|--------|--------------|---------------|---------------|
| `object` | add the rule | built in | built in |
| `blur` | add the rule | built in | built in |
| `columns` | add the rule | built in | built in |
| `col-span` | add the rule | add the rule | built in |

```ts
// uno.config.ts - add only the rules your preset lacks
rules: [
  [/^object-\$([\w-]+)$/, ([, name]) => ({ 'object-fit': `var(--${name})` })],
  // The value can sit inside a CSS function...
  [/^blur-\$([\w-]+)$/, ([, name]) => ({ filter: `blur(var(--${name}))` })],
  [/^columns-\$([\w-]+)$/, ([, name]) => ({ columns: `var(--${name})` })],
  // ...or appear more than once.
  [/^col-span-\$([\w-]+)$/, ([, name]) => ({ 'grid-column': `span var(--${name}) / span var(--${name})` })]
]
```

> [!WARNING]
> A rule in your config replaces your preset's own rule for the same class, so
> add only the rules your preset lacks. Under `presetWind3`, for example, a custom
> `blur` rule sets `filter` on its own, which drops any other filter utility on
> the element.

## Breakpoints

One breakpoint is the unprefixed base, used before any media query:

- A breakpoint valued `0`, `"0"`, `"0px"`, or `""` is selected automatically.
- If none has a zero value, `baseBreakpoint` is required.
- An explicit `baseBreakpoint` always wins.

The presets' own defaults start at `sm: 640px` (`presetMini`, `presetWind3`) or
`sm: 40rem` (`presetWind4`), so they need `baseBreakpoint: 'sm'` or a zero-valued
breakpoint. The package throws instead of guessing.

The package reads breakpoints where the base preset keeps them, the way
UnoCSS's own variants do:

- **The theme key** is `theme.breakpoint` under `presetWind4` and
  `theme.breakpoints` under the others.
- **Your theme value replaces the preset's defaults.** It is not merged with
  them: set `sm`, `md` and `lg`, and the defaults' `xl` and `2xl` are gone.
- **The `breakpoints` option replaces that theme key**, so the base preset's own
  variants use the same values. Set breakpoints in one place. If your theme sets
  them too, UnoCSS's variants follow the theme while the package follows the
  option, and the two must not disagree.
- **Theme values must be strings** (`'0px'`, not `0`): UnoCSS's own variants fail
  on numbers. The `breakpoints` option accepts numbers and converts them.

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
  }
})
```

The module adds the preset, reads breakpoints from the UnoCSS theme (or
`breakpoints`, when given) and registers the directive.

### Nuxt DevTools

During `nuxt dev`, the module adds a **vue-uno-style** tab to Nuxt DevTools:

- **Overview**: the resolved directive name, properties, formats and
  breakpoints, and where the breakpoints and the preset came from: the option or
  the theme key (`theme.breakpoint` or `theme.breakpoints`), and your other
  UnoCSS presets.
  - **Rule coverage.** It checks every safelisted class against your UnoCSS
    config, flags a property with no matching rule and suggests the rule to add.
    For a prefix from [Prefixes your preset lacks](#prefixes-your-preset-lacks),
    that is the tested rule from the table. For any other prefix, it is the
    general shape with the CSS property left for you to fill in.
  - **Status.** It also shows the safelist size, the web-types status, and which
    properties no page has used yet this session.
- **Elements**: every element on the current page that carries the directive.
  For each one it shows the owning component, the value per breakpoint with the
  active breakpoint marked, each binding's classes and variables, and what one
  binding overrides in another. You also see the final `class` and `style` on
  the element and how often it updated. Hover a row to outline the element on
  the page. Turn on **Highlight active** to keep the selected element outlined
  while you work in the tab; the outline follows the element as the page
  scrolls.
- **Warnings**: values the directive ignores without a word. That covers a
  property you did not configure, a breakpoint key that does not exist, a
  numeric `0` (use `'0'`), and a value that is neither a string nor a number.
- **Timeline**: the last 200 mounts, updates and unmounts, with the variables
  each one changed and how long the directive took. The timing covers every
  binding on the element and leaves out the tab's own bookkeeping. Browsers
  round it to 0.1 ms, so most events read `< 0.1 ms`; 1 ms or more is marked.
- **REPL**: runs a value through the directive and your UnoCSS generator and
  shows the classes, variables and CSS.

In development the directive is wrapped to report to the tab, on the client
only. Production builds and server rendering use the plain directive.
`devtools: false` leaves the tab out.

## Vue and UnoCSS without Nuxt

Give the preset and the directive the same properties and breakpoints:

```ts
// uno.config.ts
import { defineConfig, presetWind3 } from 'unocss'
import { presetVUnoStyle } from 'vue-uno-style/preset'
import properties from './vue-uno-style.properties.js'

export default defineConfig({
  // The same with presetMini() or presetWind4(): the option writes the
  // breakpoints into the theme key the base preset reads.
  presets: [
    presetWind3(),
    presetVUnoStyle({ properties, breakpoints: { sm: 0, md: '768px', lg: '1024px' } })
  ]
})
```

```ts
// main.ts
import { createVUnoStyle } from 'vue-uno-style'
import properties from './vue-uno-style.properties.js'

app.directive('uno-style', createVUnoStyle({
  properties,
  breakpoints: { sm: 0, md: '768px', lg: '1024px' }
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
      bg: { sm: '#ffffff', md: '#4f46e5' }
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
      'vue-uno-style/no-multiple-v-style': ['error', { properties }]
    }
  }
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
| `breakpoints` | `Record<string, number \| string>` | the UnoCSS theme's | Breakpoints for the preset and the directive. They replace the theme's breakpoints, so the base preset's own variants use them too. |
| `baseBreakpoint` | `string` | the zero-valued breakpoint | The unprefixed breakpoint. See [Breakpoints](#breakpoints). |
| `directiveName` | `string` | `'uno-style'` | Registration name without `v-`. `'style'` registers `v-style`. |
| `webTypes` | `boolean` | `true` | Rewrites the installed package's `web-types.json` with `directiveName` and `properties`. `false` keeps the shipped file. |
| `devtools` | `boolean` | `true` | Adds the [Nuxt DevTools](#nuxt-devtools) tab during `nuxt dev`. It has no effect in production or when Nuxt DevTools is off. |

Without `breakpoints`, the module reads `theme.breakpoints` (`theme.breakpoint`
under `presetWind4`) from the same UnoCSS config that `@unocss/nuxt` loads: `uno.config.*`, the file named in
`unocss.configFile`, and the inline `unocss` options.

### UnoCSS preset

`presetVUnoStyle(options)` from `vue-uno-style/preset`.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `properties` | `PropertyConfig[]` | required | Safelists every class the directive can write for these properties. |
| `breakpoints` | `Record<string, number \| string>` | `theme.breakpoints`, or `theme.breakpoint` under `presetWind4` | Breakpoints for the media queries and the safelist. They replace that theme key, so the base preset's own variants use them too. |
| `baseBreakpoint` | `string` | the zero-valued breakpoint | The unprefixed breakpoint. |

The preset throws when it finds neither `breakpoints` nor breakpoints in the theme.

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
`createWebTypes`, `serializeWebTypes`, `getDirectiveContext` and their types.

`vue-uno-style/devtools` exports what the DevTools tab runs on:
`createDevtoolsRegistry`, which records every element the directive writes,
and `inspectValue`, which lists what in a value the directive ignores. The Nuxt
module wires both for you.

## Development

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm build
pnpm smoke
pnpm check:docs
pnpm playground:install && pnpm playground:verify
```

`playground/` is a Nuxt app using every entry, including custom `bgi` and `bgv`
properties, and is deployed to GitHub Pages from `main`. `pnpm release` bumps, tags and pushes; the tag starts the release
workflow, which publishes through npm trusted publishing (OIDC, no token) with
provenance.

## Licence

MIT
