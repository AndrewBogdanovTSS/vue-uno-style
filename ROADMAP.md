# Roadmap

Where `vue-uno-style` goes after 0.1.0, in three phases:

1. UnoCSS `presetMini` and `presetWind4` next to `presetWind3`.
2. Design-system values: a property takes a theme key such as `red-300`, as well as an
   arbitrary value.
3. Tailwind CSS 4, through a separate package, `vue-tw-style`, built from this repository on a
   shared directive core.

UnoCSS with `presetWind3` keeps working unchanged throughout.

| Phase | Scope | Release |
| --- | --- | --- |
| 1 | UnoCSS `presetMini` and `presetWind4`, plus the breakpoint fixes they need (which also fix `presetWind3`) | `vue-uno-style` 0.2.0 |
| 2 | Design-system values: theme keys resolve to the theme's CSS variables, arbitrary values pass through | `vue-uno-style` 0.3.0 |
| 3a | Split the repository into a private core, `vue-uno-style` and `vue-tw-style`, with no API change | `vue-uno-style` 0.3.x |
| 3b | Tailwind CSS 4.1+ support in the new package | `vue-tw-style` 0.1.0 |

Every finding below was measured on 2026-11-21 against `unocss` 66.13.0 (`presetMini`,
`presetWind3`, `presetWind4`) and `tailwindcss` 4.3.5, generating real CSS. Cascade claims were
checked in Chromium. The throwaway scripts are not committed. Each finding names its inputs, so it
can be turned into a regression test as part of the phase that fixes it.

---

## Where the engine coupling lives today

The directive itself is engine-agnostic: it writes whatever class strings and CSS variables
`getStyleProps` returns. Everything engine-specific sits around it.

| Part | Engine-specific? | What ties it to UnoCSS |
| --- | --- | --- |
| `src/directive.ts`, `core/getStyle.ts`, `core/breakpoints.ts` | no | - |
| `core/getStyleProps.ts:16`, `core/varsClasses.ts:14` | yes | Both hard-code `o:<bp>:<prop>-$<prop>-<bp>`, in two expressions kept equal only by `test/parity.test.ts` |
| `src/preset.ts` | yes | Safelist, the `o:` variant and `override` layer, its own breakpoint variant |
| `src/themeBreakpoints.ts` | yes | Reads breakpoints the way UnoCSS's variants do, from `theme.breakpoint` or `theme.breakpoints` |
| `src/knownRules.ts` | yes | UnoCSS rules for the prefixes some base presets lack |
| `src/nuxt.ts` | yes | Requires `@unocss/nuxt`, reads breakpoints from a UnoCSS generator, wires the DevTools tab |
| `src/devtools/server.ts` | yes | The tab's rule coverage, REPL output and rule suggestions run on the app's UnoCSS generator |
| `src/devtools/registry.ts`, `inspect.ts`, `client.ts`, `clientUtils.ts`, `page.ts` | no | Record and show directive bindings, and the values the directive ignores |
| `src/eslint.ts`, `core/webTypes.ts`, `core/properties.ts` | wording only | Messages and docs say "UnoCSS utility prefix" |

---

## Phase 1: UnoCSS `presetMini` and `presetWind4`

**Status: implemented, waiting for the 0.2.0 release.** Every item below is done, and each
"Done when" condition holds:
- 227 unit tests pass, run under all three presets.
- `playground:verify` passes under each preset locally, and CI now runs it for all three.
- The Chromium checks for #4 and #5 pass under all three presets.

One more defect turned up along the way. The README's "Vue and UnoCSS without Nuxt" example put
`sm: 0` straight into `theme.breakpoints`, which UnoCSS's own breakpoint variant cannot sort
(`b[1].replace is not a function`). The example threw before this phase as well. It now passes
breakpoints only through the preset's option, which converts numbers and writes them under the
right theme key, and the README states that theme values must be strings.

**Goal:** `presetMini()`, `presetWind3()` and `presetWind4()` all work with the preset, the
directive and the Nuxt module.
- `presetWind4` is a drop-in replacement for `presetWind3`, with no configuration beyond what
  `presetWind3` already needs.
- `presetMini` needs only rules for the prefixes it does not ship, and the README shows how to
  write them.

### What already works

**`presetMini`** behaves like `presetWind3` today. It uses the same theme key (`breakpoints`) and
the same defaults (`sm: 640px` up to `2xl: 1536px`). The preset, explicit `breakpoints`, custom
breakpoint names, the `o:` variant and the `override` layer all work. Only #5 below applies to it.

Of 49 prefixes checked, 45 give exactly the same CSS as under `presetWind3`. The checked set
covers the README's, the playground's and the layout, typography, transform and colour utilities
a CMS-driven page typically sets. The remaining four are listed under
[Prefixes a preset does not ship](#prefixes-a-preset-does-not-ship).

**`presetWind4`:**
- **The `$` utilities.** Every prefix checked gives the same declaration as under
  `presetWind3`: `c bg p m w h gap text rounded shadow opacity font leading b top`. Only the
  helper variables differ: `shadow` adds the inset-shadow variables, and `leading` also sets
  `--un-leading`.
- **The `o:` variant and the `override` layer.** `presetWind4` adds the layers `properties` (-200),
  `theme` (-150) and `base` (-100). `override: 10` still sorts after `default`, so directive
  classes keep beating static utilities.
- **CSS variables.** The theme variables `presetWind4` emits (`--radius-lg`, `--container-lg`,
  `--text-lg-fontSize`, `--spacing`, `--colors-*`, ...) are named after theme keys, not utility
  prefixes (`radius`, not `rounded`). None of them collides with the variables the directive
  writes for the prefixes above.
- **The base breakpoint.** `presetWind4`'s default `sm` is `40rem`, so it needs
  `baseBreakpoint: 'sm'` or a zero-valued breakpoint, exactly like `presetWind3`'s `640px`.

### Prefixes a preset does not ship

The directive only writes `<prefix>-$<variable>` classes. The CSS has to come from a rule in the
base preset or in the app's own config. Among the 49 prefixes checked, these four are missing
from at least one preset:

| Prefix | `presetMini` | `presetWind3` | `presetWind4` | Built-in declaration where it exists |
| --- | --- | --- | --- | --- |
| `object` | missing | yes | yes | `object-fit: var(--x)` |
| `blur` | missing | yes | yes | `filter`, composed with the other `--un-*` filter variables |
| `columns` | missing | yes | yes | `columns: var(--x)` |
| `col-span` | missing | missing | yes | `grid-column: span var(--x)/span var(--x)` |

These rules fill the gaps. All four generate the expected CSS for every safelisted class under
all three presets, including inside the media queries. Text such as `blur-$*` in prose generates
nothing.

```ts
// uno.config.ts - only the rules your preset lacks (see the table)
rules: [
  [/^object-\$([\w-]+)$/, ([, name]) => ({ 'object-fit': `var(--${name})` })],
  [/^blur-\$([\w-]+)$/, ([, name]) => ({ filter: `blur(var(--${name}))` })],
  [/^columns-\$([\w-]+)$/, ([, name]) => ({ columns: `var(--${name})` })],
  [/^col-span-\$([\w-]+)$/, ([, name]) => ({ 'grid-column': `span var(--${name}) / span var(--${name})` })]
],
```

**A rule in the app's config replaces the preset's built-in rule for the same class.** This was
checked: under `presetWind3`, the app's `object` rule generated its own declaration instead of
the built-in one. So add only the rules the base preset lacks. A custom `blur` rule under
`presetWind3` would, for example, stop `blur` composing with the other filter utilities.

The list is not exhaustive. The docs therefore teach the recipe, not just these four rules.

### What breaks

| # | Severity | Finding | Evidence |
| --- | --- | --- | --- |
| 1 | high | **The preset throws when breakpoints come from the theme.** `presetWind4` keeps them in `theme.breakpoint` (singular). The preset reads only `theme.breakpoints` (`src/preset.ts:44`, `:83`). | `presetVUnoStyle({ properties: ['c'], baseBreakpoint: 'sm' })` next to `presetWind4()` throws `No breakpoints found`, even with `theme: { breakpoint: { ... } }` set. |
| 2 | high | **The Nuxt module fails the build unless `breakpoints` is passed.** `getThemeBreakpoints` reads `theme.breakpoints` (`src/nuxt.ts:95`). | Same root cause as #1. |
| 3 | high | **Configured `breakpoints` are silently ignored for names `presetWind4` already knows.** `extendTheme` writes `theme.breakpoints` (`src/preset.ts:78`), which `presetWind4` never reads, and its own `md:` variant matches first with its default value. | `breakpoints: { sm: 0, md: '900px' }` generates `@media (min-width: 48rem)` for `o:md:c-$c-md`. |
| 4 | high | **Custom breakpoint names cascade in the wrong order.** The package's own variant returns `parent` without a `parentOrder` (`src/preset.ts:56`), so its media blocks sort as strings and `1200px` lands before `768px`. UnoCSS's own variant sets `parentOrder: 3000 + index + 1`. | Chromium at 1300px, `breakpoints: { mobile: '0px', tablet: '768px', desktop: '1200px' }`: the `tablet` value wins over `desktop`. |
| 5 | high, **also affects `presetWind3` and `presetMini` today** | **Breakpoints are read from the merged theme, not the way UnoCSS reads them.** UnoCSS resolves `userConfig.theme[key] \|\| theme[key]` (`@unocss/rule-utils` `resolveBreakpoints`), so a user's breakpoints *replace* the defaults. The package reads the merged theme, which still contains the base preset's `xl: 1280px` and `2xl: 1536px`. The safelist and the Nuxt-registered directive therefore include them, UnoCSS's own variant does not know them, and the package's unordered variant (#4) emits them before `md` and `lg`. | The playground's own config (`theme.breakpoints` with `sm`/`md`/`lg`) through the Nuxt module's code path, Chromium at 1300px: `{ sm, lg, xl }` renders the `lg` value, never `xl`. Reproduced under both `presetWind3` and `presetMini`. |

### Work items

1. **Resolve breakpoints the way UnoCSS does.** One helper used by the preset's safelist, its
   variant and the Nuxt module: `userConfig.theme[key] ?? theme[key]`, with `key` set to
   `breakpoint` when the resolved theme has that key and `breakpoints` otherwise. Safelist and
   variant contexts both expose `generator`, so the user config is available. Fixes #1, #2, #5.
2. **Write configured `breakpoints` under the key the base preset reads.** `extendTheme` sets
   `theme.breakpoint` for `presetWind4` and `theme.breakpoints` for `presetMini` and
   `presetWind3`, so the base preset's own variant serves the configured values. Document that
   `breakpoints` and a hand-written `theme.breakpoint(s)` must not disagree: UnoCSS's variant
   prefers the user's theme. Fixes #3.
3. **Order the package's own breakpoint variant.** Return `parentOrder` from the configured
   breakpoint order (smallest first, as the README already requires), matching
   `@unocss/rule-utils`. Fixes #4, and keeps media order correct for names no base preset knows.
4. **Nuxt module.** `getThemeBreakpoints` switches to the helper from item 1, reading
   `generator.userConfig` and `generator.config.theme`. Its error message names both keys.
5. **Tests.**
   - Run `test/preset.test.ts` and `test/nuxt.test.ts` against all three presets
     (`describe.each([presetMini, presetWind3, presetWind4])`).
   - Add a cascade-order test: the media blocks of the `override` layer follow breakpoint order,
     for default and custom names.
   - Add a regression test for #5: a user's `theme.breakpoints` replaces the defaults, so no
     `xl`/`2xl` classes are safelisted. This reverses the existing test "derives the safelist
     from the resolved UnoCSS theme breakpoints" in `test/preset.test.ts`, which currently
     asserts that `o:xl:c-$c-xl` and `o:2xl:c-$c-2xl` *are* safelisted.
   - Add a per-prefix generation test for each preset. It covers the 49 checked prefixes and
     records which ones each preset lacks, so a UnoCSS upgrade that adds or drops a rule fails
     the test and the docs table gets updated with it.
   - Extend `test/customRules.test.ts` and its fixture `test/fixtures/customRules.ts` with
     `presetWind4`. Both already exist for `presetMini` and `presetWind3`: the test proves the
     README's table and runs every documented rule under the presets that need it.
6. **Playground.** Let `uno.config.ts` pick the preset from an environment variable and run
   `playground:verify` for all three presets in CI. The playground's properties need no extra
   rules under `presetMini`: `bgi` and `bgv` are already its own rules. The Pages deployment
   stays on one preset.
7. **Docs.** Update the README:
   - **Supported presets:** `presetMini`, `presetWind3` and `presetWind4`, and what each needs.
   - **Breakpoints:** the `breakpoint` theme key and the `40rem` default under `presetWind4`.
   - **Options tables:** "the UnoCSS theme's" becomes `theme.breakpoint` or
     `theme.breakpoints`.
   - **Custom rules:** add a `presetWind4` column to the table under "Prefixes your preset
     lacks". `presetWind4` ships all four prefixes, `col-span` included. The section itself
     already exists: it landed together with this roadmap and covers the general form, the
     `[\w-]+` match, a wrapped value (`blur`), a value used twice (`col-span`), the pairing with
     `format: 'url'`, the gap table, and the warning that an app rule replaces the preset's own.

   Extend `scripts/check-docs.ts` to cover the new claims. It already checks that the README
   quotes the fixture's rules verbatim and that its table matches the tested one; the
   `presetWind4` column joins that check.

**Behaviour change to note in the release:** with item 1, a `presetMini` or `presetWind3` app
that sets its own `theme.breakpoints` stops registering the base preset's `xl` and `2xl`. That
matches what UnoCSS itself does with those names. It is a fix, but it changes the directive's
breakpoint list.

**Done when:**
- All unit tests pass under the three presets.
- `playground:verify` passes under each of them.
- The Chromium checks for #4 and #5 pass.
- The README's custom rules are the tested ones.

---

## Phase 2: design-system values

**Goal:** a property can take a key from the design system instead of an arbitrary value.
`v-uno-style:c="{ sm: 'red-300', md: 'blue-200' }"` renders the theme's colours, while
`'#fca5a5'` keeps working as it does today. One option, `designSystem`, turns it on for the
preset, the directive and the Nuxt module. With it off, output is unchanged.

### How it works

A token becomes a reference to the theme's CSS variable. The classes stay the same:

```
v-uno-style:c="{ sm: 'red-300', md: 'blue-200' }"
-> class="o:c-$c o:md:c-$c-md"   style="--c: var(--colors-red-300); --c-md: var(--colors-blue-200)"
```

- **Neither the classes nor the safelist change.**
- **The value stays tied to the design system.** Changing the theme, or redefining `--colors-*`
  for a brand or for `.dark`, restyles CMS content too.
- **SSR and the client agree.** Resolving a value is a set lookup plus a string template; no
  theme values reach the browser.

### Verified facts (`unocss` 66.13.0, Chromium)

- **The mechanism works.** Under `presetWind4` with the theme keys safelisted, `--c` and
  `--c-md` set to the two references render red-300 below `md` and blue-200 above it, and
  `--rounded: var(--radius-lg)` renders `8px`.
- **`presetWind4` emits theme variables on demand only.** `--colors-red-300` is absent unless
  something uses it. It can safelist theme keys natively, though: the safelist entry
  `colors:red-300` emits `--colors-red-300`.
- **`presetMini` and `presetWind3` keep the theme in JS only** (`colors.red.300` is `#fca5a5`)
  and emit no theme variables at all.
- **CSS cost.** All 310 `presetWind4` colours as variables take 17.8 KB, 5.0 KB gzipped. The
  alternative was real utility classes per token (`o:md:c-blue-200`). For three colour
  properties and three breakpoints that is 2790 classes: 634.7 KB, 35.4 KB gzipped. Rejected.
- **Tokens overlap across theme sections.**
  - `lg`, `sm` and `xl` exist in spacing, radius, shadow, blur and container;
  - `none` in radius, shadow and leading;
  - `normal` in leading, tracking and fontWeight.

  So the section has to come from the property, not from the value.
- **Spacing is a formula, not a list of keys.** `p-4` is `calc(var(--spacing) * 4)`. The
  spacing section itself only holds `DEFAULT` and named sizes.
- **The runtime token list is small.** Every `presetWind4` section together takes 4.8 KB, 1.1 KB
  gzipped. Colours stored as hue -> shades take 0.2 KB gzipped.
- **The order of checks does not matter for speed.** Per value, `Set.has` takes 7.9 ns, a
  raw-value regex 23.8 ns, and today's `getStyle` for one property over three breakpoints
  1245 ns. A regex fast path in front of the lookup would make it slower, not faster.
- **A blind mapping fails silently.** `var(--colors-nope-999)` falls back to the inherited
  colour. Hence a membership check, not a string transform alone.
- **Some words are both a CSS colour and a token.** `red`, `black` and `white` are CSS colour
  names and `presetWind4` tokens. `transparent`, `current` and `inherit` are not tokens.

### Design

1. **`designSystem` option.** The preset, the directive and the Nuxt module all read it, as they
   do `properties`.
   - `true`: covers every configured property whose prefix maps to a theme section.
   - An array narrows it, to sections (`['colors', 'radius']`) or token patterns
     (`['colors:brand-*']`).

   The same setting decides three things: which variables the preset emits (the CSS cost), what
   goes into the directive's runtime token set, and what the checks in item 6 accept. It is off
   by default.
2. **A prefix -> section table shipped by the package**, so `designSystem: true` needs no
   per-property setup. Examples:
   - `c`, `bg`, `b` -> colors;
   - `p*`, `m*`, `gap*` -> spacing;
   - `rounded` -> radius;
   - `text` -> colors and font sizes, which do not overlap;
   - `font` -> families and weights.

   A custom property declares its section (`{ name: 'bgv', theme: 'colors' }`) or opts out with
   `theme: false`. An entry with `format: 'url'` never has one.
3. **Resolving one value**, in this order:
   1. Found in the property's token set: the theme variable's reference. Font sizes map to
      `--text-<token>-fontSize`, and a bare hue such as `red` to its `DEFAULT` shade, the way
      `c-red` does.
   2. A spacing section and a unitless number: `calc(var(--spacing) * <n>)`, while `4px` stays
      raw.
   3. Anything else: written as is, exactly like today.
4. **The preset makes the variables exist.**
   - Under `presetWind4` it adds the enabled theme keys to the safelist (`colors:red-300`).
   - Under `presetMini` and `presetWind3` it adds a preflight that writes
     `:root { --colors-red-300: #fca5a5; ... }` from the resolved theme, under `presetWind4`'s
     names. That way the directive's mapping does not depend on the preset.

   This builds on phase 1 item 1, which resolves the theme key per preset.
5. **The runtime token set.** The Nuxt module inlines it from the resolved theme into the plugin
   template, as hue -> shades for colours. Without Nuxt, a helper builds it from the UnoCSS
   config, and the app passes it to `createVUnoStyle`.
6. **Diagnostics, in two layers.**
   - **ESLint.** A new rule reads the same `designSystem` setting. It flags literal values in
     templates that are neither a token nor a raw value (`red-301`). Optionally it also flags a
     CSS colour name used as a raw value, in favour of `#hex`. `eslint.config.js` can `await`
     the token helper at the top level. This only covers values written in the template.
   - **Runtime, in development.** Values from an API or CMS, the package's main case, never
     reach ESLint. They surface in the Nuxt DevTools tab:
     - `inspectValue` gains an `unknown-token` warning for a value shaped like a token
       (`word-123`) that is not one, so the **Warnings** tab lists it next to the existing
       unknown-breakpoint and dropped-value warnings.
     - The **REPL** and the **Elements** table show what each value resolved to: a token
       reference or the raw value.
     - The **Overview** lists the enabled theme sections, their token counts, and the CSS the
       emitted variables cost.

     Without Nuxt DevTools, the directive warns in the console instead. Both are stripped from
     production builds, like today's unknown-property warning.
7. **Docs.** A "Design-system values" README section covering:
   - how a value resolves;
   - the prefix table;
   - a table row for `designSystem` (`check:docs` requires one).

   It must state the precedence plainly. **A value found in the theme is always a token.**
   `c: 'red'` is the design system's red, not CSS `red`, so write arbitrary colours as `#hex`
   (or a colour function such as `oklch(...)`) and they can never collide with a token.
8. **Tests.**
   - Per preset (`presetMini`, `presetWind3`, `presetWind4`): every enabled token's variable is
     present in the generated CSS.
   - Resolution unit tests: a token, a spacing number, a raw passthrough, a CSS-word collision,
     an overlapping token under two properties.
   - A Chromium check: the computed colour equals the theme's colour.
   - A size budget for the runtime token set.
   - Tests for the ESLint rule.
   - With `designSystem` off, generated output matches the previous release.

**Done when:**
- `red-300` and `#fca5a5` render the same colour under all three presets.
- Unknown tokens are reported by ESLint for template literals and during development for
  runtime values.
- Turning `designSystem` off changes nothing.

### Open decisions

- **What `designSystem: true` emits by default:** every colour (about 5 KB gzipped of CSS), or
  only an explicit list.
- **Opacity:** whether `red-300/50` (as `color-mix(in oklab, var(--colors-red-300) 50%, transparent)`)
  ships in 0.3.0 or later.
- **The ESLint check:** a new rule or an extension of `no-multiple-v-style`, and whether it
  flags CSS colour names used as raw values by default.

---

## Phase 3: `vue-tw-style` for Tailwind CSS 4

**Goal:** a separate package, `vue-tw-style`, gives Tailwind CSS 4.1+ apps the same directive,
ESLint rule and web-types. Both packages are built from this repository on a shared directive
core. `vue-uno-style` gains no Tailwind code or dependencies, and its published API does not
change.

### Why a separate package

- **The Nuxt modules share nothing.** `src/nuxt.ts` is UnoCSS from end to end: `loadConfig`,
  `createGenerator` and the `unocss:config` hook. A Tailwind module would be a different module
  behind an `if`.
- **Peer dependencies stay honest.** `vue-uno-style` keeps `unocss` and `@unocss/*`, and
  `vue-tw-style` lists only `tailwindcss`.
- **Each package gets the right defaults without `engine` branches.** Tailwind needs a variable
  prefix, explicit breakpoints, type hints and the `&&` override (see the facts below). UnoCSS
  keeps its current behaviour.
- **Releases are independent.** `vue-tw-style` can iterate through 0.x without releasing
  `vue-uno-style`.
- **Both names are accurate.** `vue-uno-style` is already published on npm and stays as it is.
  `vue-tw-style` was free on 2026-11-21. Following the same pattern, its directive defaults to
  `v-tw-style`, its ESLint rule is `vue-tw-style/no-multiple-v-style`, and its Nuxt config key is
  `vTwStyle`.

### Shape of the split

| Package | Published | Contents |
| --- | --- | --- |
| `packages/core` | no, private | Directive factory, `getStyle`, breakpoints, properties, the ESLint rule factory, the web-types builder, and the DevTools registry, `inspectValue` and tab client. It is engine-neutral through a class-format adapter. |
| `packages/vue-uno-style` | yes | Core + UnoCSS adapter, `presetVUnoStyle`, the known gap rules, the Nuxt module for `@unocss/nuxt`, and the DevTools server part that checks coverage against the UnoCSS generator. |
| `packages/vue-tw-style` | yes | Core + Tailwind adapter, the stylesheet fragment builder, its own Nuxt module and DevTools server part. |

The core is bundled into each published package at build time, so only two packages are public
and a core version can never drift from its adapter. The cost: an app that installs both packages
ships the directive twice, and no realistic app does that. Publish the core separately only if a
third engine or an outside consumer appears. It would then need an engine-neutral name.

The row boundary in [Where the engine coupling lives today](#where-the-engine-coupling-lives-today)
is the split line. The rows marked "no" and "wording only" move to the core; everything else
stays with its package.

### Verified facts (`tailwindcss` 4.3.5)

- **There is no `$var` syntax.** Tailwind's `<utility>-(--var)` produces the same declarations:
  `p-(--p)` gives `padding: var(--p)`, and `bg-(--bg)`, `gap-(--gap)`, `w-(--w)` and
  `bg-(image:--bgi)` behave the same way.
- **Ambiguous utilities need a type hint.** `text-(--c)` sets `color`, while
  `text-(length:--fs)` sets `font-size`.
- **The `override` layer does not port.** Tailwind emits utilities into a native
  `@layer utilities`. A `@layer override` inside a custom variant becomes the sublayer
  `utilities.override`, which loses to plain utilities.
- **`@custom-variant o (&&);` works as the override.** It doubles the class
  (`.o\:p-\(--p\).o\:p-\(--p\)`, specificity 0,2,0), so it beats static utilities, composes with
  `md:` in either order and keeps media order. The `!` modifier also works, but it beats inline
  styles too, which UnoCSS's `override` layer does not.
- **The safelist comes from `@source inline("...")`.** It generates exactly the listed classes.
  Tailwind 4 has no JS-config safelist, and `@source inline` arrived in 4.1, so 4.1 is the floor.
- **Breakpoints live in CSS** (`--breakpoint-*` in `@theme`), and no stable API reads them from
  JS, so `vue-tw-style` requires `breakpoints`. A breakpoint name Tailwind does not know
  generates nothing, and nothing reports it.
- **CSS variables collide.** Tailwind's default theme defines `--text-sm|lg|xl|2xl`,
  `--shadow-*`, `--radius-*`, `--blur-*`, `--drop-shadow-*` and `--container-*` on `:root`. A
  directive with the property `text` and the breakpoint `lg` writes an inline `--text-lg`, which
  breaks `text-lg` (`font-size: var(--text-lg)`) on every descendant. Tailwind also owns every
  `--tw-*` variable, so `tw` cannot be the prefix.
- **Theme variables appear only when used, as under `presetWind4`.**
  - `@import "tailwindcss";` emits no `--color-red-300` until something uses it.
  - `@import "tailwindcss" theme(static);` emits every theme variable.
  - A safelisted utility (`@source inline("text-red-300")`) emits its own.

  The names differ from `presetWind4`'s: `--color-*` (singular) and `--text-lg` for a font size.
  `--radius-lg` and `--spacing` match. Phase 2's token references therefore need a per-engine
  mapping.

### Step 3a: split the repository (`vue-uno-style` patch release, no API change)

1. **Workspace.** Move to `packages/core`, `packages/vue-uno-style` and `packages/vue-tw-style` (an
   empty shell at this point) in the pnpm workspace. The directive, breakpoint, properties and
   ESLint suites move with the core.
2. **A class-format adapter in the core.** The adapter is `formatClass({ prop, breakpoint, variable, type })`,
   plus `variableName(prop, breakpoint)` and `themeVariable(section, token)` for phase 2's token
   references. Both the directive and the safelist go through it.
   Runtime/safelist parity then holds by construction. `test/parity.test.ts` becomes a contract
   test every adapter runs. The UnoCSS adapter reproduces today's `o:<bp>:<prop>-$<prop>-<bp>`
   and phase 2's `--colors-*` references byte for byte.
3. **Proof of no change.** `vue-uno-style`'s `npm pack` file list, its exports (publint and attw
   already run on build) and `pnpm smoke` must match the last release. The playground keeps
   passing `playground:verify`. `dist/devtools-client.mjs` is served as a file, so it must still
   build without imports once its code comes from the core; `pnpm smoke` already checks that.
4. **Release tooling.**
   - `scripts/release.ts` takes a package name and tags per package (`vue-uno-style@0.3.1`,
     `vue-tw-style@0.1.0`) instead of `v*`.
   - `release.yml` publishes the tagged package from its directory.
   - Trusted publishing is configured per package in its npm settings. If npm still requires a
     package to exist before a trusted publisher can be added, the first `vue-tw-style` publish
     is a one-off manual publish.
5. **CI.** Lint, typecheck, unit tests, smoke and `check:docs` run per package.

### Step 3b: `vue-tw-style` 0.1.0

1. **A variable namespace.** A core `variablePrefix` option, so that `vts` gives
   `--vts-text-lg`. `vue-tw-style` defaults to a non-empty prefix that is not `tw`.
   `vue-uno-style` keeps an empty default, so its output does not change. The directive, the
   fragment and the Nuxt module read the same value.
2. **Type hints on property entries.** An optional `type` (`color`, `length`, `image`, ...),
   which the Tailwind adapter renders as `text-(color:--...)` and the UnoCSS adapter ignores.
   `resolveProperties`, the ESLint rule's schema and web-types accept it.
3. **The stylesheet fragment.** `vue-tw-style` turns the configured properties and breakpoints
   into what Tailwind needs: `@custom-variant o (&&);` plus the `@source inline(...)` safelist.
   It also ships a small writer for setups that keep the fragment in a file.
4. **Design-system values.**
   - The Tailwind adapter maps tokens to `--color-red-300`, `--radius-lg`, `--text-lg` and
     `calc(var(--spacing) * <n>)`.
   - The fragment makes the enabled variables exist, either through `theme(static)` or by
     listing one utility per token in `@source inline(...)`. The spike measures which is
     lighter.
   - The ESLint rule and the development warning from phase 2 work unchanged.
5. **The Nuxt module** (`vue-tw-style/nuxt`, config key `vTwStyle`). It registers the directive
   and writes the fragment to `#build`, and the app imports it from its Tailwind stylesheet.
   **Spike first:**
   - Which Tailwind integration to support: `@tailwindcss/vite` directly, `@nuxtjs/tailwindcss`,
     or both.
   - Whether the module can inject the fragment into the stylesheet Tailwind compiles, without
     a user-side import.

   It also serves the same DevTools tab. Its server part checks coverage by compiling the
   safelist with `@tailwindcss/node`, and suggests the Tailwind form of a missing utility.
6. **Tests.** Contract tests against the real compiler (`@tailwindcss/node` `compile().build()`)
   that mirror `vue-uno-style`'s preset tests:
   - every safelisted class generates CSS;
   - every enabled token's variable exists;
   - `o:` beats a static utility;
   - media blocks follow breakpoint order;
   - no generated variable matches a default theme variable.

   Plus one Chromium cascade check.
7. **Playground, docs and package metadata.**
   - A Tailwind playground with its own `verify` run in CI.
   - Its own README and `check:docs`.
   - `tailwindcss >=4.1` as a peer dependency.
   - web-types for `v-tw-style`.

**Done when:**
- A Tailwind 4 app on `vue-tw-style` and a UnoCSS app on `vue-uno-style` render the same
  responsive values from the same directive bindings.
- Both contract suites are green.
- `vue-uno-style`'s published output is unchanged by step 3a.

### Open decisions

- **Override strategy:** `&&` (recommended, same semantics as UnoCSS's layer for static
  utilities) or `!` (simpler, but it also beats inline styles).
- **`vue-tw-style`'s default `variablePrefix`**, and whether `vue-uno-style` should adopt one in a
  later major version.
- **A public core:** only if a third engine or an outside consumer appears, and under an
  engine-neutral name.

### Not planned

- **Tailwind CSS 3.** Its `safelist` config and `[--var]` arbitrary values would fit as a second
  adapter inside `vue-tw-style`. It can follow on request, but Tailwind 4 comes first.
- **Engine-free CSS generation** from a `{ name, css: 'color' }` map. It would work with any
  stack, but it drops the "a property is an engine utility prefix" model both packages are built
  on.
