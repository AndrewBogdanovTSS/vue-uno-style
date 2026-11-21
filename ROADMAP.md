# Roadmap

Where `vue-uno-style` goes after 0.1.0: first UnoCSS `presetWind4`, then Tailwind CSS 4 as a
second engine. Each phase ships as its own minor release, and UnoCSS with `presetWind3` keeps
working unchanged throughout.

| Phase | Scope | Release |
| --- | --- | --- |
| 1 | UnoCSS `presetWind4`, plus the breakpoint fixes it depends on (they fix `presetWind3` too) | 0.2.0 |
| 2 | Tailwind CSS 4.1+ as an alternative engine | 0.3.0 |

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

## Phase 2: Tailwind CSS 4

**Goal:** Tailwind CSS 4.1+ works as an engine for the same directive, ESLint rule and web-types.
UnoCSS stays the default, and existing UnoCSS setups need no changes.

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
  JS, so `breakpoints` must be explicit in Tailwind mode. A breakpoint name Tailwind does not know
  generates nothing, and nothing reports it.
- **CSS variables collide.** Tailwind's default theme defines `--text-sm|lg|xl|2xl`,
  `--shadow-*`, `--radius-*`, `--blur-*`, `--drop-shadow-*` and `--container-*` on `:root`. A
  directive with the property `text` and the breakpoint `lg` writes an inline `--text-lg`, which
  breaks `text-lg` (`font-size: var(--text-lg)`) on every descendant.

### Work items

1. **A class-format adapter in the core.** Add one `formatClass({ prop, breakpoint, variable, type })`
   per engine, used by both `getStyleProps` and `getVarsClasses`. Runtime/safelist parity then
   holds by construction instead of relying on `test/parity.test.ts`. The directive gains
   `engine: 'unocss' | 'tailwind'`, defaulting to `'unocss'`.
2. **A variable namespace.** Add a `variablePrefix` option, so that `vus` gives `--vus-text-lg`.
   It stays empty for UnoCSS, so nothing breaks, and defaults to a non-empty prefix for Tailwind.
   The directive, the safelist and the Nuxt module must share it.
3. **Type hints on property entries.** Add an optional `type` (`color`, `length`, `image`, ...)
   rendered as `text-(color:--...)` for Tailwind and ignored by UnoCSS. `resolveProperties`, the
   ESLint rule's schema and web-types accept it.
4. **A `vue-uno-style/tailwind` entry.** It turns the configured properties and breakpoints into
   the stylesheet fragment Tailwind needs: `@custom-variant o (&&);` plus the
   `@source inline(...)` safelist. It also gets a small writer for setups that keep that fragment
   in a file.
5. **Nuxt.** Add `engine: 'tailwind'` to the module. It drops the `@unocss/nuxt` requirement and
   writes the fragment to `#build`, and the app imports it from its Tailwind stylesheet.
   **Spike first:** can the module inject the fragment into the stylesheet that
   `@tailwindcss/vite` compiles, without a user-side import?
6. **Tests.** Contract tests against the real compiler (`@tailwindcss/node` `compile().build()`)
   that mirror the preset tests:
   - every safelisted class generates CSS;
   - `o:` beats a static utility;
   - media blocks follow breakpoint order;
   - no generated variable matches a default theme variable.

   Plus one Chromium cascade check.
7. **Playground, docs and package metadata.**
   - A Tailwind playground app with its own `verify` run in CI.
   - A README section.
   - `tailwindcss >=4.1` as an optional peer dependency.
   - Keywords and description updated.

**Done when:** a Tailwind 4 app and a UnoCSS app render the same responsive values from the same
directive bindings, with both contract suites green.

### Open decisions

- **Override strategy:** `&&` (recommended, same semantics as UnoCSS's layer for static
  utilities) or `!` (simpler, but it also beats inline styles).
- **The default `variablePrefix` for Tailwind**, and whether UnoCSS should adopt one in a later
  major version.
- **The name.** `vue-uno-style` and `v-uno-style` read oddly with Tailwind. The directive name is
  already configurable; settle the package name before 1.0.

### Not planned

- **Tailwind CSS 3.** Its `safelist` config and `[--var]` arbitrary values would fit the same
  adapter. It can follow on request, but Tailwind 4 comes first.
- **Engine-free CSS generation** from a `{ name, css: 'color' }` map. It would work with any
  stack, but it drops the "a property is an engine utility prefix" model the package is built on.
