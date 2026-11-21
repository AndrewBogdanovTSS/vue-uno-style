# Roadmap

Where `vue-uno-style` goes after 0.1.0: first UnoCSS `presetWind4`, then Tailwind CSS 4 through a
separate package, `vue-tw-style`, built from this repository on a shared directive core. UnoCSS
with `presetWind3` keeps working unchanged throughout.

| Phase | Scope | Release |
| --- | --- | --- |
| 1 | UnoCSS `presetWind4`, plus the breakpoint fixes it depends on (they fix `presetWind3` too) | `vue-uno-style` 0.2.0 |
| 2a | Split the repository into a private core, `vue-uno-style` and `vue-tw-style`, with no API change | `vue-uno-style` 0.2.x |
| 2b | Tailwind CSS 4.1+ support in the new package | `vue-tw-style` 0.1.0 |

Every finding below was measured on 2026-11-21 against `unocss` 66.13.0 (`presetWind3`,
`presetWind4`) and `tailwindcss` 4.3.5, generating real CSS. Cascade claims were checked in
Chromium. The throwaway scripts are not committed. Each finding names its inputs, so it can be
turned into a regression test as part of the phase that fixes it.

---

## Where the engine coupling lives today

The directive itself is engine-agnostic: it writes whatever class strings and CSS variables
`getStyleProps` returns. Everything engine-specific sits around it.

| Part | Engine-specific? | What ties it to UnoCSS |
| --- | --- | --- |
| `src/directive.ts`, `core/getStyle.ts`, `core/breakpoints.ts` | no | - |
| `core/getStyleProps.ts:16`, `core/varsClasses.ts:14` | yes | Both hard-code `o:<bp>:<prop>-$<prop>-<bp>`, in two expressions kept equal only by `test/parity.test.ts` |
| `src/preset.ts` | yes | Safelist, the `o:` variant and `override` layer, its own breakpoint variant, reads `theme.breakpoints` |
| `src/nuxt.ts` | yes | Requires `@unocss/nuxt`, reads `theme.breakpoints` from a UnoCSS generator |
| `src/eslint.ts`, `core/webTypes.ts`, `core/properties.ts` | wording only | Messages and docs say "UnoCSS utility prefix" |

---

## Phase 1: UnoCSS `presetWind4`

**Goal:** `presetWind4()` is a drop-in replacement for `presetWind3()` next to the preset, the
directive and the Nuxt module, with no configuration beyond what `presetWind3` already needs.

### What already works

- **The `$` utilities.** Every prefix checked gives the same declaration under both presets:
  `c bg p m w h gap text rounded shadow opacity font leading b top`. Only the helper variables
  differ: `shadow` adds the inset-shadow variables, and `leading` also sets `--un-leading`.
- **The `o:` variant and the `override` layer.** `presetWind4` adds the layers `properties` (-200),
  `theme` (-150) and `base` (-100). `override: 10` still sorts after `default`, so directive
  classes keep beating static utilities.
- **CSS variables.** The theme variables `presetWind4` emits (`--radius-lg`, `--container-lg`,
  `--text-lg-fontSize`, `--spacing`, `--colors-*`, ...) are named after theme keys, not utility
  prefixes (`radius`, not `rounded`). None of them collides with the variables the directive
  writes for the prefixes above.
- **The base breakpoint.** `presetWind4`'s default `sm` is `40rem`, so it needs
  `baseBreakpoint: 'sm'` or a zero-valued breakpoint, exactly like `presetWind3`'s `640px`.

### What breaks

| # | Severity | Finding | Evidence |
| --- | --- | --- | --- |
| 1 | high | **The preset throws when breakpoints come from the theme.** `presetWind4` keeps them in `theme.breakpoint` (singular). The preset reads only `theme.breakpoints` (`src/preset.ts:44`, `:83`). | `presetVUnoStyle({ properties: ['c'], baseBreakpoint: 'sm' })` next to `presetWind4()` throws `No breakpoints found`, even with `theme: { breakpoint: { ... } }` set. |
| 2 | high | **The Nuxt module fails the build unless `breakpoints` is passed.** `getThemeBreakpoints` reads `theme.breakpoints` (`src/nuxt.ts:95`). | Same root cause as #1. |
| 3 | high | **Configured `breakpoints` are silently ignored for names `presetWind4` already knows.** `extendTheme` writes `theme.breakpoints` (`src/preset.ts:78`), which `presetWind4` never reads, and its own `md:` variant matches first with its default value. | `breakpoints: { sm: 0, md: '900px' }` generates `@media (min-width: 48rem)` for `o:md:c-$c-md`. |
| 4 | high | **Custom breakpoint names cascade in the wrong order.** The package's own variant returns `parent` without a `parentOrder` (`src/preset.ts:56`), so its media blocks sort as strings and `1200px` lands before `768px`. UnoCSS's own variant sets `parentOrder: 3000 + index + 1`. | Chromium at 1300px, `breakpoints: { mobile: '0px', tablet: '768px', desktop: '1200px' }`: the `tablet` value wins over `desktop`. |
| 5 | high, **also affects `presetWind3` today** | **Breakpoints are read from the merged theme, not the way UnoCSS reads them.** UnoCSS resolves `userConfig.theme[key] \|\| theme[key]` (`@unocss/rule-utils` `resolveBreakpoints`), so a user's breakpoints *replace* the defaults. The package reads the merged theme, which still contains the base preset's `xl: 1280px` and `2xl: 1536px`. The safelist and the Nuxt-registered directive therefore include them, UnoCSS's own variant does not know them, and the package's unordered variant (#4) emits them before `md` and `lg`. | The playground's own config (`presetWind3`, `theme.breakpoints` with `sm`/`md`/`lg`) through the Nuxt module's code path, Chromium at 1300px: `{ sm, lg, xl }` renders the `lg` value, never `xl`. |

### Work items

1. **Resolve breakpoints the way UnoCSS does.** One helper used by the preset's safelist, its
   variant and the Nuxt module: `userConfig.theme[key] ?? theme[key]`, with `key` set to
   `breakpoint` when the resolved theme has that key and `breakpoints` otherwise. Safelist and
   variant contexts both expose `generator`, so the user config is available. Fixes #1, #2, #5.
2. **Write configured `breakpoints` under the key the base preset reads.** `extendTheme` sets
   `theme.breakpoint` for `presetWind4` and `theme.breakpoints` otherwise, so the base preset's
   own variant serves the configured values. Document that `breakpoints` and a hand-written
   `theme.breakpoint(s)` must not disagree: UnoCSS's variant prefers the user's theme. Fixes #3.
3. **Order the package's own breakpoint variant.** Return `parentOrder` from the configured
   breakpoint order (smallest first, as the README already requires), matching
   `@unocss/rule-utils`. Fixes #4, and keeps media order correct for names no base preset knows.
4. **Nuxt module.** `getThemeBreakpoints` switches to the helper from item 1, reading
   `generator.userConfig` and `generator.config.theme`. Its error message names both keys.
5. **Tests.**
   - Run `test/preset.test.ts` and `test/nuxt.test.ts` against both presets
     (`describe.each([presetWind3, presetWind4])`).
   - Add a cascade-order test: the media blocks of the `override` layer follow breakpoint order,
     for default and custom names.
   - Add a regression test for #5: a user's `theme.breakpoints` replaces the defaults, so no
     `xl`/`2xl` classes are safelisted.
   - Add a per-prefix generation test for `presetWind4` covering the prefixes listed above.
6. **Playground.** Let `uno.config.ts` pick the preset from an environment variable and run
   `playground:verify` for both presets in CI. The Pages deployment stays on one preset.
7. **Docs.** Update these README sections:
   - Properties: `presetWind4` ships the same `$` rules.
   - Breakpoints: the `breakpoint` theme key and the `40rem` default.
   - The options tables: "the UnoCSS theme's" becomes `theme.breakpoint` or `theme.breakpoints`.

   Extend `scripts/check-docs.ts` to cover the new claims.

**Behaviour change to note in the release:** with item 1, a `presetWind3` app that sets its own
`theme.breakpoints` stops registering the base preset's `xl` and `2xl`. That matches what UnoCSS
itself does with those names. It is a fix, but it changes the directive's breakpoint list.

**Done when:** all unit tests pass under both presets, `playground:verify` passes under both, and
the Chromium checks for #4 and #5 pass.

---

## Phase 2: `vue-tw-style` for Tailwind CSS 4

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
| `packages/core` | no, private | Directive factory, `getStyle`, breakpoints, properties, the ESLint rule factory, the web-types builder. It is engine-neutral through a class-format adapter. |
| `packages/vue-uno-style` | yes | Core + UnoCSS adapter, `presetVUnoStyle`, the Nuxt module for `@unocss/nuxt`. |
| `packages/vue-tw-style` | yes | Core + Tailwind adapter, the stylesheet fragment builder, its own Nuxt module. |

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

### Step 2a: split the repository (`vue-uno-style` patch release, no API change)

1. **Workspace.** Move to `packages/core`, `packages/vue-uno-style` and `packages/vue-tw-style` (an
   empty shell at this point) in the pnpm workspace. The directive, breakpoint, properties and
   ESLint suites move with the core.
2. **A class-format adapter in the core.** The adapter is `formatClass({ prop, breakpoint, variable, type })`
   plus `variableName(prop, breakpoint)`, and both the directive and the safelist go through it.
   Runtime/safelist parity then holds by construction. `test/parity.test.ts` becomes a contract
   test every adapter runs. The UnoCSS adapter reproduces today's `o:<bp>:<prop>-$<prop>-<bp>`
   byte for byte.
3. **Proof of no change.** `vue-uno-style`'s `npm pack` file list, its exports (publint and attw
   already run on build) and `pnpm smoke` must match the last release. The playground keeps
   passing `playground:verify`.
4. **Release tooling.**
   - `scripts/release.ts` takes a package name and tags per package (`vue-uno-style@0.2.1`,
     `vue-tw-style@0.1.0`) instead of `v*`.
   - `release.yml` publishes the tagged package from its directory.
   - Trusted publishing is configured per package in its npm settings. If npm still requires a
     package to exist before a trusted publisher can be added, the first `vue-tw-style` publish
     is a one-off manual publish.
5. **CI.** Lint, typecheck, unit tests, smoke and `check:docs` run per package.

### Step 2b: `vue-tw-style` 0.1.0

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
4. **The Nuxt module** (`vue-tw-style/nuxt`, config key `vTwStyle`). It registers the directive
   and writes the fragment to `#build`, and the app imports it from its Tailwind stylesheet.
   **Spike first:**
   - Which Tailwind integration to support: `@tailwindcss/vite` directly, `@nuxtjs/tailwindcss`,
     or both.
   - Whether the module can inject the fragment into the stylesheet Tailwind compiles, without
     a user-side import.
5. **Tests.** Contract tests against the real compiler (`@tailwindcss/node` `compile().build()`)
   that mirror `vue-uno-style`'s preset tests:
   - every safelisted class generates CSS;
   - `o:` beats a static utility;
   - media blocks follow breakpoint order;
   - no generated variable matches a default theme variable.

   Plus one Chromium cascade check.
6. **Playground, docs and package metadata.**
   - A Tailwind playground with its own `verify` run in CI.
   - Its own README and `check:docs`.
   - `tailwindcss >=4.1` as a peer dependency.
   - web-types for `v-tw-style`.

**Done when:**
- A Tailwind 4 app on `vue-tw-style` and a UnoCSS app on `vue-uno-style` render the same
  responsive values from the same directive bindings.
- Both contract suites are green.
- `vue-uno-style`'s published output is unchanged by step 2a.

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
