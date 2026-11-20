# Extraction plan: `vue-uno-style`

Standalone, publishable package extracted from Canvas (`GLOBAL15-132320`).
Reference for package shape: `D:/personal/eslint-unocss-normalize-classes`.

Status as of 2026-11-20: **phases 1-7 done, phase 8 (publish) pending.** PR AndrewBogdanovTSS/v-style-directive#1 carries the work; `vue-uno-style` is still unclaimed on npm.

- **Phases 1-7:** package, directive, preset, ESLint plugin, Nuxt module, docs, demo and CI are in place. Unit tests, typecheck, lint, build (publint + attw), smoke and `check:docs` are green.
- **Synced with Canvas `develop` on 2026-11-20:** the directive includes Canvas `fd50a1df54` (2026-10-28, nested v-style fix), which composes every binding on a vnode. The ESLint rule, `getStyleProps`, `getVarsClasses`, the `o:` variant, the `bgi`/`bgv` rules and the safelist have not drifted.
- **Phase 0 in Canvas: partly done.** Only the `'**/.claude/**'` vitest exclude has landed. Still open: `layers: { override: 10 }`, the `getVarsClasses` docblock (`md:o:c-$c-md`), the `v-style.c` example in `docs/core/plugins/style.md`, unknown-prop linting, and the contract tests. The package already fixes each of these on its side, so none blocks publishing; they matter only for Canvas until it migrates. The two Canvas records cited below are not present in Canvas `develop`.

Audited against the running UnoCSS generator on 2026-09-21 at Canvas `13c8288c5e`. Result: **v-style works** - 40/40 props generate CSS, runtime classes are byte-identical to safelisted tokens, 44/44 directive tests pass. Six issues found around it, now scheduled as phase 0. Recorded in Canvas at `docs/development/proposals/GLOBAL15-132320-extract-v-style-package.md` and `docs/development/findings/GLOBAL15-132320-v-style-extraction-defects.md`.

---

## 1. What "everything related to v-style" actually is

The directive is the visible part. It does not work alone: the classes it generates are resolved by an UnoCSS variant, two UnoCSS rules, and a safelist, and its core invariant is enforced by an ESLint rule. All of it moves.

Line counts as of Canvas `develop` `599e6fdc04` (2026-11-20).

| Canvas source                                     | Lines | Role                                                                          | Moves?                       |
| ------------------------------------------------- | ----- | ----------------------------------------------------------------------------- | ---------------------------- |
| `domains/core/directives/style.ts`                | 216   | `vStyle` directive, `getStyle`, `styleProps` (40 props), `ResponsiveStyles`    | yes                          |
| `domains/core/directives/getStyleProps.ts`        | 38    | Responsive value to `{ styles, classList }`                                   | yes                          |
| `domains/core/utils/style/getVarsClasses.ts`      | 24    | Safelist token generator                                                      | yes                          |
| `domains/brands/config/unocss/safelist.ts`        | 23    | Feeds `getVarsClasses` output into the uno safelist                           | partial - the v-style rows   |
| `domains/core/config/unocss/variants/index.ts:10` | 1     | `variantMatcher('o', () => ({ layer: 'override' }))`                          | yes                          |
| `domains/core/config/unocss/rules/background.ts`  | 2     | `bgi-$*` to `background-image: var(--*)`, `bgv-$*` to `background: var(--*)`   | no - stays as Canvas rules   |
| `domains/core/plugin/style/index.ts`              | 5     | Nuxt plugin registering the directive                                         | yes, as module               |
| `eslint/rules/no-multiple-v-style.ts`             | 97    | Enforces one directive per element                                            | yes                          |
| `domains/core/directives/tests/style.test.ts`     | 784   | Directive behaviour, 40+ cases                                                | yes                          |
| `.../tests/getStyleProps.test.ts`                 | 88    | Class/var composition                                                         | yes                          |
| `domains/core/plugin/style/index.test.ts`         | 22    | Plugin registration                                                           | rewrite as module test       |
| `eslint/rules/no-multiple-v-style.test.ts`        | 76    | Rule and autofix                                                              | yes                          |
| `domains/core/directives/README.md`               | -     | Usage docs                                                                    | source for package README    |
| `docs/core/plugins/style.md`                      | -     | Usage docs, has a stale modifier example                                      | source for package README    |
| `web-types.json`                                  | 75    | WebStorm completion for `v-style`, hand-written and drifted                   | replaced by the package's    |

**Stays in Canvas:** `getResponsiveClasses.ts` and `getStateClasses.ts` (same folder, unrelated to the directive), the brand/typography/button rows of `safelist.ts`, the `text-size-$text-size` allowance in `domains/core/config/unocss/blocklist.ts:171` (Canvas policy, not package behaviour), and every other `o:` consumer.

### The safelist is load-bearing

`v-style` composes class names at runtime from CMS data, so UnoCSS's extractor never sees them in source. Without `safelist.ts:22` feeding `styleProps.map((prop) => getVarsClasses(prop).split(' '))` into the config, every class the directive writes resolves to no CSS.

A package that ships the directive and the preset but leaves the safelist to the README ships something that silently does nothing. **The preset must contribute the safelist itself.**

### What the audit found

The feature is correct. The problems are around it, and phase 0 fixes them in Canvas first:

| # | Sev | Issue |
| --- | --- | --- |
| 1 | MEDIUM | `override` layer outranks `default` only by alphabetical tiebreak. Proven: renaming it to `aaa-override` inverts the cascade for every call site; declaring `layers: { override: 10 }` restores it |
| 2 | LOW | `getVarsClasses.ts:12-13` JSDoc claims `md:o:c-$c-md`; code emits `o:md:c-$c-md`. Code and its test are right, only the comment is wrong |
| 3 | LOW | `docs/core/plugins/style.md:9` documents `v-style.c="color"`. The directive reads `binding.arg`, so that form yields `o:sm-$sm` / `--sm` junk. Do not carry it into the package docs |
| 4 | LOW | Unknown props in the arg form are silent no-ops - `getStyle({sm:'1rem'}, 'paddign')` returns `o:paddign-$paddign` |
| 5 | MEDIUM | Nothing tests the directive-to-UnoCSS contract: no per-prop generation test, no layer-order test, no `getStyleProps` / `getVarsClasses` parity test |
| 6 | MEDIUM | Canvas `vitest.config.ts` has no `test.exclude`, so vitest runs `.claude/worktrees/**` copies too. Unrelated to v-style; it misdirected the audit for three runs |

Gap 5 is the one that matters for the port. `getStyleProps` and `getVarsClasses` are each tested against their own hardcoded literals. Change the variant order in one and update its test - the natural move - and the other keeps passing with the old order. The two then disagree, the safelisted token stops matching the emitted class, and every `v-style` declaration silently produces no CSS.

### `styleProps` is type-only at runtime

`getStyle` iterates whatever keys the binding object has; nothing validates them against the 40-entry list. An unknown prop produces a class and a CSS variable that no rule matches - a silent no-op. The array's only runtime consumer is the safelist.

The package should add a dev-mode `console.warn` on unknown props (stripped in production builds), since in a published package that failure lands on someone with no access to the list.

---

## 2. Decisions taken

| Question          | Decision                                                  |
| ----------------- | --------------------------------------------------------- |
| Scope             | Directive + UnoCSS preset + ESLint plugin + Nuxt module   |
| Breakpoints       | Read from the UnoCSS theme, with explicit override        |
| Canvas migration  | Adoption out of scope; defect fixes are phase 0           |
| Properties        | Consumer-configured; the package predefines none (2026-11-20) |

### Properties are consumer configuration

Decided 2026-11-20, superseding the 40-entry `styleProps` port. The package exports no property list. `properties` is required by the preset and the Nuxt module, which throw without it, since an empty safelist would make every generated class resolve to no CSS. The same list optionally feeds the directive (value formats, development warning), the ESLint rule (unknown-argument check) and the module's web-types rewrite.

The Canvas-specific `bgi`/`bgv` rules left the preset. A property entry can declare `{ name, format: 'url' }`, which replaces the hardcoded `url()` wrap for `bgi` and stays JSON-serialisable through the Nuxt plugin template. A consumer that needs a non-preset utility adds its own `<prefix>-$<variable>` rule.

### Naming

**Decided: package `vue-uno-style`, directive `v-uno-style`.**

Renaming away from `v-style` is right for three reasons. `v-style` sits next to Vue's own `:style` and means something different, which is a real reading cost in a template that has both. Directive names are a single global namespace per app, and `v-style` is generic enough that an app or another library could reasonably want it. And the UnoCSS coupling is not incidental - strip the preset and the directive emits class names that resolve to nothing - so naming it after UnoCSS is accurate rather than decorative.

The package name and the directive name are separate decisions, and they landed differently:

- package name: `vue-uno-style`. `v-uno-style` was the first choice but reads as cryptic outside a Vue template, and `vue-uno-style-directive` was rejected for the opposite reason - the package ships four entries, and the directive on its own renders nothing, so a name ending in `-directive` would understate it and encourage exactly the install-the-directive-without-the-preset mistake. Discoverability for "directive" is carried by `keywords`, which npm search matches, so the name does not have to.
- default registration name: `uno-style`, which Vue renders as `v-uno-style` in templates
- exported directive: `vUnoStyle`, named after the directive rather than the package
- Nuxt module option `directiveName`, so Canvas can pass `'style'` and keep `v-style` with zero call-site churn across its 686 template uses in 196 `.vue` files (counted on `develop` `599e6fdc04`, 2026-11-20)
- the ESLint rule takes the same option. Canvas's copy hardcodes `attr.key?.name?.name === 'style'` (`no-multiple-v-style.ts:34`); the port must read a configured name, or the rule silently stops firing for any consumer that renames the directive. Since Canvas `fd50a1df54` (2026-10-28) the directive composes every binding on a vnode, so duplicate directives on one tag now render correctly; the rule keeps templates in the single object form rather than guarding correctness.

**`vue-uno-style` is free on npm** - confirmed 2026-09-22 and again 2026-11-20 (`E404`) against `registry.npmjs.org`. Canvas's `.npmrc` points at a jFrog mirror that returns `E401` for unauthenticated reads, so the check needs `--registry=https://registry.npmjs.org`:

```bash
npm view vue-uno-style version --registry=https://registry.npmjs.org
```

Also free at that check: `vue-unocss-style`, `unocss-vue-style`, `vue-uno-style-directive`, `vue-unocss-directive`, `v-uno-style`. Not an option: `@unocss/*` - the scope exists and belongs to the UnoCSS org.

---

## 3. Package shape

Mirrors the reference package: tsdown with named entries, ESM only, `publint` + `attw` on every build, MIT, provenance on publish.

```
vue-uno-style/
  src/
    core/
      breakpoints.ts     resolveBreakpoints(), base-breakpoint rule
      getStyleProps.ts   from Canvas, breakpoints injected not imported
      getStyle.ts        getStyle() + types
      properties.ts      resolveProperties() - consumer list validation, value formats
      varsClasses.ts     from getVarsClasses.ts, doc corrected
      webTypes.ts        createWebTypes() - WebStorm completion from styleProps
    directive.ts         createVUnoStyle(options) -> Directive
    preset.ts            presetVUnoStyle() - variants, safelist from properties, layer
    eslint.ts            plugin with the no-multiple rule
    nuxt.ts              Nuxt module: plugin + preset + directive name + web-types
    webTypes.ts          node-only writer for the installed web-types file
    index.ts             directive + types + core re-exports
  test/                  ported suites + preset generation tests
  demo/                  Nuxt app proving all four entries together
  scripts/               build-web-types.ts, check-docs.ts, release.ts, smoke.mjs
  .github/workflows/     ci.yml, release.yml
  .githooks/pre-push
  tsdown.config.ts  vitest.config.ts  tsconfig.json
  mise.toml  pnpm-workspace.yaml  .gitattributes  .gitignore
  README.md  LICENSE  package.json
```

### Entries

| Export                | Entry           | Consumer                                 |
| --------------------- | --------------- | ---------------------------------------- |
| `vue-uno-style`       | `src/index.ts`  | `app.directive('uno-style', vUnoStyle)`  |
| `vue-uno-style/preset`  | `src/preset.ts` | `uno.config.ts` presets array            |
| `vue-uno-style/eslint`  | `src/eslint.ts` | flat config                              |
| `vue-uno-style/nuxt`    | `src/nuxt.ts`   | `nuxt.config.ts` modules                 |

`preset` must not import the directive, and the directive must not import the preset. The preset is loaded by the build (including by the ESLint rule's config loader); the directive is loaded by the browser. Same split as the reference package's `config` vs `index` entries, and for the same reason.

### Dependencies

- peer: `vue >= 3.4`, `unocss >= 66` (preset entry), `eslint >= 9` (eslint entry), `@nuxt/kit >= 3.17`, `@unocss/nuxt >= 66` and `@unocss/config >= 66` (nuxt entry) - all optional peers except `vue`
- runtime deps: none. `normalizeClass` / `normalizeStyle` come from `vue`; `isObject` (`domains/core/utils/is.ts:72`, auto-imported in Canvas) is four tokens and gets inlined rather than depended on

---

## 4. Breakpoints from the UnoCSS theme

`getBreakpointMarkers()` reads `#root/design-system`, and `getStyleProps` treats **the first key** as the unprefixed base. Canvas's design system is `{ sm: 0, md: 768, lg: 1024 }`, so `sm` is base and `md`/`lg` get prefixes. The package cannot import that file.

### Mechanism

The directive runs in the browser and cannot read `uno.config.ts`. So the theme is read at build time and handed to the runtime:

1. `presetVUnoStyle()` reads `theme.breakpoints` from the resolved config and generates the safelist from the real keys.
2. The Nuxt module resolves the UnoCSS config through `@unocss/config`, extracts the breakpoints, and generates the runtime plugin with `addPluginTemplate`. The plugin calls `createVUnoStyle()` with the breakpoints inlined, so the browser never reads a config file.
3. `createVUnoStyle({ breakpoints, baseBreakpoint })` stays public for consumers with no build step (plain Vue, Vitest, Storybook without the module).

### The hazard, stated plainly

"First key is base" is safe in Canvas because `sm: 0` is not a media query. In a **stock** UnoCSS theme `sm` is `640px` - a real media query - and treating it as base would emit unprefixed CSS for a breakpoint that should be gated. Silently wrong output, on the default config, for anyone who installs this.

So the rule is explicit rather than positional:

- a breakpoint whose value is `0`, `'0'`, `'0px'` or empty is the base
- if no breakpoint qualifies, `baseBreakpoint` must be set, and the package throws at config time naming the problem if it is not
- `baseBreakpoint` always wins when passed

This preserves Canvas behaviour exactly (`sm: 0` becomes base) while refusing to guess on a stock theme. It is a deliberate divergence from `getStyleProps.ts:7` (`const [firstBr] = getBreakpointMarkers().all`) and needs a test asserting both branches.

Second divergence to cover: `getVarsClasses` uses `processable` (truthy values only) while `getStyleProps` uses `all`. Under the new rule both derive from the same resolved `{ base, prefixed[] }` pair, which removes the two-sources-of-truth problem rather than porting it.

---

## 5. The `override` layer is currently winning by accident

`variantMatcher('o', () => ({ layer: 'override' }))` puts the generated classes in an `override` layer, and Canvas never declares a layer order. UnoCSS sorts layers with `(layers[a] ?? 0) - (layers[b] ?? 0) || a.localeCompare(b)` (`@unocss/core/dist/index.mjs:824`). Both layers are order `0`, so the tiebreak is alphabetical: `default` < `override`. The override layer wins **because of how the word is spelled**.

Rename the layer, or add a consumer layer that sorts after it, and v-style loses silently. The preset declares the order outright:

```ts
layers: { override: 10 }
```

with a test asserting `override` CSS follows `default` CSS in the generated output. Cheap insurance against a property that no one wrote down.

---

## 6. Test port

The existing suites are good and carry most of the value. Port them first, then add what a standalone package needs.

**Ported as-is** (path and import rewrites only):

- `style.test.ts` (681 lines) - `#types/common` to local types, `../style` to `../src/directive`. Uses `@vue/test-utils` + jsdom, which the package needs as devDeps. The reference package's vitest env is `node`; this needs `jsdom` for the directive suite, so the vitest config gets per-file environments or an `environmentMatchGlobs` entry.
- `getStyleProps.test.ts` (88 lines) - breakpoints injected instead of read from the design system.
- `no-multiple-v-style.test.ts` (76 lines) - plus new cases for a renamed directive.

**New:**

- preset generation: `presetVUnoStyle()` through a real `createGenerator`, asserting `o:c-$c` and `o:md:c-$c-md` produce the expected CSS, that `bgi`/`bgv` resolve, and that safelist coverage matches `styleProps`
- layer ordering (section 5)
- breakpoint resolution: Canvas-style `sm: 0`, stock theme with explicit `baseBreakpoint`, and the throw when neither applies
- a `styleProps` / safelist parity test, so adding a prop without safelisting it fails in CI rather than in a CMS-driven page
- `smoke.mjs`: the built package through a real ESLint and a real UnoCSS generator, matching the reference package's `verify` job

---

## 7. Build and release infra

Copied from the reference package, adjusted:

- `tsdown.config.ts` - four named entries, `format: ['esm']`, `dts: true`, `hash: false`, `.mjs`/`.d.mts`, `publint: true`, `attw: true`. `platform` is `neutral` here, not `node`: the directive and preset run in a browser. Only `eslint` and `nuxt` entries are node-only.
- `ci.yml` - build once, fan out to a Node matrix on `test:unit`, plus a `verify` job running `smoke` and `check:docs`
- `release.yml` - tag-triggered, `id-token: write` for provenance, NPM_TOKEN presence check, tag/version match check, publish, then GitHub Release
- `.githooks/pre-push` - `typecheck` + `check:docs`
- `check-docs.ts` - adapted so README examples are checked against the real exports. Its highest-value assertion here: every prop in the README's prop table exists in `styleProps`, and every entry in `styleProps` is documented. The Canvas README currently punts with "Check the directive's source code for all available CSS property prefixes" - a published package cannot.
- `demo/` - a Nuxt app using the module, exercising responsive values, the arg form, the object form, `bgi`/`bgv`, and SSR output

---

## 8. Open risks

| Risk                                                        | Handling                                                                                   |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `vue-uno-style` claimed before publish                      | Confirmed free 2026-09-22 and 2026-11-20; re-check at phase 8. Fallback `vue-unocss-style`  |
| Breakpoint semantics divergence (section 4)                 | Explicit base rule + throw + tests on both branches                                         |
| Layer order accident (section 5)                            | Declared `layers` + ordering test                                                           |
| ESLint rule silently dead after rename                      | Rule reads the configured name; test with a renamed directive                               |
| SSR `getSSRProps` in non-Nuxt SSR                           | Covered by existing tests; demo asserts real SSR markup                                     |
| Canvas transformers (`transformerCompileClass({ classPrefix: 'vf-' })`, `unocss-build-themes`) | Canvas-specific, not ported; confirm neither touches safelisted tokens during the Canvas migration (section 10) |
| Properties not configured, or a prop missing from the list  | Preset and module throw without `properties`; dev-mode warn and ESLint report for an unlisted prop |

---

## 9. Phases

Each phase ends green before the next starts.

**Phase 0 - fix the source defects in Canvas.** Before any package work, in Canvas, one PR: declare `layers: { override: 10 }`; add the three missing tests (per-prop CSS generation, layer ordering, `getStyleProps` / `getVarsClasses` parity); correct the `getVarsClasses` docblock and the `v-style.c` docs example; reject unknown props via the ESLint rule; add `'**/.claude/**'` to `test.exclude` in `vitest.config.ts`. Extracting first would copy the defects into the package and need the same fixes applied twice.

**Phase 1 - groundwork.** `git init`, LICENSE, `.gitattributes` (`eol=lf` - the preset tests compare generated CSS as text, same reason as the reference package), `.gitignore`, `mise.toml`, `pnpm-workspace.yaml`, `package.json` skeleton, `tsconfig.json`, `vitest.config.ts`, `tsdown.config.ts`.

**Phase 2 - core.** Port `getStyleProps`, `getStyle`, `styleProps`, types, `varsClasses`, and the new `resolveBreakpoints`. Port `getStyleProps.test.ts`. No Vue, no UnoCSS yet.

**Phase 3 - directive.** Port `style.ts` as `createVUnoStyle(options)` plus a default-configured `vUnoStyle` export. Port the 681-line suite. jsdom env wired.

**Phase 4 - preset.** `o:` variant, `bgi`/`bgv` rules, declared layer order, safelist from resolved breakpoints times `styleProps`. Generation, layer-order and parity tests.

**Phase 5 - ESLint plugin, and the package's own lint gate.** Port the rule with a configurable directive name, port its tests, add renamed-directive cases, add a flat `recommended` config.

Also add `eslint.config.js` and a `lint` script covering `src/` and `test/`. A deliberate addition, not parity: the reference package has no root ESLint config and no `lint` script - its `eslint` dep is for `RuleTester` and `@unocss/eslint-config` serves the demo. Added here because a package whose deliverable is an ESLint plugin should be linted by ESLint and dogfood its own rule, and because this package has four entries to keep consistent rather than three.

In this phase rather than phase 7 because `eslint` is already a dev dependency the rule's tests need, so the config is nearly free here - while deferring it means phases 5 and 6 are written unlinted and the first run drops a large mechanical cleanup into the docs and CI work. Phase 7's CI then calls a script that already exists.

**Phase 6 - Nuxt module.** Registers the plugin, merges the preset, resolves breakpoints from the uno theme, honours `directiveName`. Module test.

**Phase 7 - docs, demo, CI.** README with the full prop table, four install paths, and the breakpoint contract stated up front. Demo app. `check-docs`, `smoke`, both workflows, pre-push hook.

The demo carries its own `eslint.config.js` and a `demo:lint` script running the **published** plugin against real Vue templates - the reference package's pattern, and a different check from phase 5's gate. Phase 5 proves the rule works under `RuleTester`; this proves it survives being resolved from a package export, loaded by a real ESLint, and pointed at a real `uno.config.ts`. CI runs both, plus `lint`.

**Phase 8 - publish.** `pnpm build` green with publint + attw, smoke green, `0.1.0` tagged, release workflow does the rest.

---

## 10. Out of scope

The Canvas migration. Once the package is on npm, a separate change under `GLOBAL15-132320`:

- removes `domains/core/directives/style.ts`, `getStyleProps.ts` and their `tests/`, `domains/core/utils/style/getVarsClasses.ts`, `domains/core/plugin/style/` (plugin and test), the `o:` variant line and the v-style safelist rows
- removes `eslint/rules/no-multiple-v-style.ts` and its test, its import and registration in `eslint.config.js` (lines 10, 23, 222) and its entry in `eslint/README.md`; registers `vue-uno-style/eslint` with `directiveName: 'style'` instead, so the `vf/no-multiple-v-style` rule id changes and any `eslint-disable` comments naming it must follow
- adds the dependency and registers the module with `directiveName: 'style'`, so none of the 686 template uses move
- repoints the 17 files importing from `#core/directives/style`: 11 `ResponsiveStyles` type imports, 1 `StyleProp`, 1 `styleProps` (`safelist.ts`, which goes away with its rows), and 3 `vStyle` imports (`tests/setup.ts`, `ColorSwatch.test.ts`, the plugin)
- moves the 40 entries of `styleProps` into a Canvas-owned properties file (plain JS, so `eslint.config.js` can import it), with `bgi` as `{ name: 'bgi', format: 'url' }`; passes it to the module (`properties`) and the ESLint rule
- keeps the `bgi-$*` and `bgv-$*` rules in `domains/core/config/unocss/rules/background.ts`, since the preset no longer ships them
- replaces the `StyleProp` import with a type derived from the Canvas list, and `ResponsiveStyles` with `ResponsiveStyles<CanvasProperty>` where the narrower key type matters
- updates `ProductGrid.vue:138`, the one direct `getStyle()` caller: the package signature is `getStyle(config, breakpoints, arg, properties)`, so it passes `resolveBreakpoints({ breakpoints: appConfig.ds.breakpoints })`
- registers the package's directive in `tests/setup.ts` and `ColorSwatch.test.ts` through `createVUnoStyle({ breakpoints, properties })` with the Canvas list, so `bgi` keeps its `url()` wrap in tests
- points the `o:` section of `domains/core/config/unocss/variants/README.md`, `domains/core/directives/README.md` and `docs/core/plugins/style.md` at the package README

The same change deletes Canvas's `web-types.json` and the `"web-types": "./web-types.json"` field in its `package.json`. The file was added for `v-style` alone (`71096611aa`, GLOBAL15-66025) and has never described anything else; the package's own web-types, rewritten by the module for `directiveName: 'style'`, replaces it. Two conditions keep completion working:

- `vue-uno-style` must be a direct dependency, since WebStorm reads web-types from direct dependencies only.
- The module must have run once (`nuxt prepare` on postinstall, or any dev or build run). Until then the shipped file describes `uno-style`.

Keeping Canvas's copy would show the directive twice in completion, and its list has already drifted from `styleProps`.

Worth doing only after the package's own suite is green - proving it against 196 files is a much worse first test than proving it against its own.
