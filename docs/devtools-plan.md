# Nuxt DevTools integration: plan

Status as of 2026-11-21: **implemented** on branch
`claude/vue-uno-nuxt-devtools-features-5fb0c8`, not yet committed. Lint, typecheck, 209 unit
tests, smoke, `check:docs` and `playground:verify` pass. Every section was checked by hand in
the playground's Nuxt DevTools (Nuxt 4.6.4, DevTools 3.4.4). Section 7 lists where the
implementation departs from this plan.

The Nuxt module gains a **vue-uno-style** tab in Nuxt DevTools. The tab shows how the package
is configured and whether that configuration works, lists every directive on the current page
with what it produced, and lets a developer try a value against the app's real UnoCSS config.
Nothing changes outside development: the production build and its bundle stay as they are.

---

## 1. Features

Thirteen features from the brainstorm, grouped by where their data comes from.

### Server side (build-time data, from the module)

| # | Feature | What it shows |
|---|---------|---------------|
| 1 | Resolved config | Package version, directive name, properties with their `format`, breakpoints in order with their widths, the resolved base and prefixed breakpoints, and where the breakpoints came from (`breakpoints` option or UnoCSS theme). |
| 2 | Rule coverage | For each property, every safelisted token (`o:c-$c`, `o:md:c-$c-md`, ...) and whether UnoCSS generated CSS for it. A property with no matching rule is an error, shown with a `rules` entry to add. |
| 3 | Safelist cost | Classes and CSS bytes per property and in total. |
| 4 | Status | Whether the web-types rewrite was written, unchanged, disabled or failed (with the reason), whether the preset came from the UnoCSS config or was added by the module, and which UnoCSS config files were loaded. |
| 10 | REPL | Type a property and a value, get the classes, the CSS variables and the CSS that the app's own generator produces for them. |

### Client side (live data, from a dev-only directive wrapper)

| # | Feature | What it shows |
|---|---------|---------------|
| 5 | Elements | One row per element carrying the directive: tag, owning component, properties, update count. Selecting a row shows each binding's value, classes and variables, and the final `class`/`style` read from the element. Hovering highlights the element on the page; a button scrolls to it. |
| 6 | Active breakpoint | The breakpoint the app window is in now, updated on resize. In the element detail, a value table per breakpoint with the active column marked. A toggle puts a small breakpoint badge on the page itself. |
| 7 | Merged bindings | For an element with several bindings (a component's own root binding plus its usage site), every binding with its owning component, and which properties a later binding overrides. |
| 8 | Warnings | Problems found in binding values, with the element they came from: a property that is not configured, a breakpoint key that does not exist (the directive drops it silently today), and a value that is neither a string nor a number. |
| 9 | Usage coverage | Configured properties seen at least once this session, and the ones never used, as candidates to remove from the safelist. |
| 11 | Timeline | The last 200 directive events (mount, update, unmount) with time, element and the variables that changed. Elements that update often are flagged as churn. |
| 12 | Unchanged values | Elements whose value has not changed since mount are marked "never updated", a hint that plain classes could do. |
| 13 | UnoCSS link | A link from the tab to the UnoCSS inspector tab, which `@unocss/nuxt` already provides. |

### Decisions

- **No Vue DevTools API.** Item 11 was first described as a Vue DevTools custom inspector and
  timeline. That needs `@vue/devtools-api` resolvable from the app, which pnpm's strict layout
  does not guarantee. The timeline and per-element detail live in our own tab instead.
- **No viewport resizing.** Nuxt DevTools has no API to resize the app viewport. Item 6 shows
  the active breakpoint and per-breakpoint values instead, plus the on-page badge.
- **No open-in-editor.** Nuxt DevTools' `openInEditor` RPC needs its auth token. The tab shows
  the component's file path with a copy button.
- **Static values stay a runtime hint.** A compile-time "use plain classes" suggestion belongs
  in the ESLint rule. It is out of scope here and listed under follow-ups.

---

## 2. Architecture

```
nuxt.config        Nuxt module (src/nuxt.ts)
                     |- devtools:customTabs hook  -> iframe tab at /__vue-uno-style/
                     |- Vite plugin (dev only)    -> serves the page, client script, JSON API
                     |- plugin template (dev)     -> wraps the directive with the registry
App window         registry (src/devtools/registry.ts, entry vue-uno-style/devtools)
                     provided as nuxtApp.$vUnoStyleDevtools
DevTools iframe    client (src/devtools/client.ts, built to dist/devtools-client.mjs)
                     reads window.__NUXT_DEVTOOLS__.host.nuxt.$vUnoStyleDevtools
                     fetches /__vue-uno-style/api/*
```

### No new dependencies

- The tab is registered with `nuxt.hook('devtools:customTabs', ...)`, the hook
  `@nuxt/devtools-kit`'s `addCustomTab` wraps. `@unocss/nuxt` registers its tab the same way.
  When DevTools is off the hook never fires.
- The page and the API are served by a Vite plugin's `configureServer` middleware, added with
  `addVitePlugin(..., { server: false })`. That is how the UnoCSS inspector serves `/__unocss/`
  in Nuxt. The middleware uses Node's `req`/`res`, so it needs no `h3`.
- The iframe reaches the app through `window.__NUXT_DEVTOOLS__`, which Nuxt DevTools sets on
  every custom-tab iframe. Its `host.nuxt` is the app's `NuxtApp`.

### Module option

`devtools?: boolean`, default `true`. Has an effect only in `nuxt dev`. `false` registers no
tab, no middleware and no wrapper. Documented in the README options table, which
`check:docs` enforces.

### Server data (`src/devtools/server.ts`)

`createDevtoolsData(context)` takes what `modules:done` already has (options, the loaded UnoCSS
config and its sources, the generator, resolved breakpoints, the breakpoint source, the
web-types result) and returns one JSON-safe object:

```ts
interface DevtoolsData {
  version: string
  directiveName: string
  properties: Array<{ name: string, format?: 'url' }>
  breakpoints: { source: 'option' | 'theme', values: Record<string, string>, base: string, prefixed: string[] }
  preset: 'config' | 'module'
  configSources: string[]
  webTypes: { status: 'written' | 'unchanged' | 'disabled' | 'failed', file?: string, error?: string }
  coverage: Array<{ property: string, tokens: Array<{ token: string, matched: boolean }>, bytes: number, suggestion?: string }>
  safelist: { classes: number, bytes: number }
}
```

Coverage generates each property's `getVarsClasses()` tokens with `safelist: false` and
`preflights: false`, and reads `matched` and the CSS length. `generateSample(input)` runs
`getStyle()` with the resolved breakpoints and properties, then the generator on the classes;
the REPL calls it.

`createDevtoolsMiddleware(data, generate)` routes:

| Route | Response |
|-------|----------|
| `GET /__vue-uno-style/` | The tab's HTML page |
| `GET /__vue-uno-style/client.mjs` | `dist/devtools-client.mjs` |
| `GET /__vue-uno-style/api/data` | `DevtoolsData` |
| `POST /__vue-uno-style/api/generate` | `{ classes, style, css }` or `{ error }` for `{ property?, value }` |

Anything else under the prefix gets 404; other paths fall through to `next()`.

### Registry (`src/devtools/registry.ts`, entry `vue-uno-style/devtools`)

`createDevtoolsRegistry({ breakpoints, baseBreakpoint, properties })` returns a registry and
`instrument(directive)`, which returns a copy of the directive whose hooks call the original
and then record. The copy keeps the directive's marker symbol (object spread copies symbol
keys), so binding composition is unchanged. `directive.ts` gains one export,
`getDirectiveContext(dir)`, so the registry can find sibling bindings the way the directive does.

Per element the registry keeps: an id, the element, the owning component of each binding
(`binding.instance.$.type`: `__name` and `__file`), each binding's arg, value, classes and
variables, the final `class` and `style` from the element, mount time, update count, the
warnings and the overridden properties. Session-wide it keeps the properties seen and a ring
buffer of 200 events. Listeners are told after every change, batched per animation frame. A
listener that throws (an iframe that reloaded) is dropped.

The Nuxt plugin template, in dev and on the client only, creates the registry, registers
`instrument(directive)` and provides the registry as `$vUnoStyleDevtools`. Server rendering and
production use the plain directive. Production output from the template is byte-identical to
today's.

### Client (`src/devtools/client.ts`)

Plain TypeScript, no framework, no imports, built by a second tsdown config to
`dist/devtools-client.mjs` (browser platform, no `.d.ts`, not exported). It renders five
sections: **Overview** (items 1-4, 9, 13), **Elements** (5-7, 12), **Warnings** (8),
**Timeline** (11) and **REPL** (10). It follows DevTools' color mode. Opened outside DevTools,
the page still shows the server sections and says the live ones need DevTools.

Pure helpers (`activeBreakpoint`, `escapeHtml`, `formatBytes`, `diffStyle`) are exported for
unit tests.

---

## 3. Files

| File | Change |
|------|--------|
| `src/nuxt.ts` | `devtools` option, tab hook, Vite plugin, dev plugin template, web-types result capture |
| `src/devtools/server.ts` | New: data, coverage, sample generator, middleware |
| `src/devtools/page.ts` | New: the tab's HTML shell and styles |
| `src/devtools/inspect.ts` | New: `inspectValue`, shared by the registry and the REPL |
| `src/devtools/registry.ts` | New: registry and `instrument()` |
| `src/devtools/client.ts` | New: the tab's UI |
| `src/devtools/clientUtils.ts` | New: the client's pure helpers |
| `src/devtools.ts` | New: entry re-exporting the registry |
| `src/directive.ts` | Export `getDirectiveContext` |
| `tsdown.config.ts` | `devtools` and `devtools-client` entries |
| `package.json` | `./devtools` export |
| `test/devtoolsServer.test.ts` | New |
| `test/devtoolsRegistry.test.ts` | New (jsdom) |
| `test/devtoolsClient.test.ts` | New: pure helpers |
| `test/nuxt.test.ts` | New default and the `addVitePlugin` mock |
| `test/nuxtDevtools.test.ts` | New: option on and off, dev vs production template, served data |
| `test/devtoolsInspect.test.ts` | New |
| `.claude/launch.json` | New: `playground` dev server on port 3217 for the browser check |
| `scripts/smoke.mjs` | The devtools entry and client file are built |
| `README.md` | "Nuxt DevTools" section, `devtools` option row |
| `playground/nuxt.config.ts` | `devtools: { enabled: true }` so `playground:dev` shows the tab |

---

## 4. Verification

1. `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm smoke`, `pnpm check:docs`.
2. `pnpm playground:verify`: generated output must not change.
3. `pnpm playground:dev` in the browser: open DevTools, open the tab, check every section
   against the playground page. Resize to cross `md` and `lg`, switch the palette (update
   path), and confirm the warning list by adding an unknown breakpoint key.

## 5. Risks

- `window.__NUXT_DEVTOOLS__` and the `devtools:customTabs` hook are DevTools internals that
  `@nuxt/devtools-kit` wraps. A DevTools major could change them. Both are used by
  `@unocss/nuxt` too, so a change would be visible early.
- The registry holds element references. It drops them on unmount; a missed unmount (an
  element removed outside Vue) is cleaned when the element is no longer connected.
- The iframe calls functions across frames. A reloaded iframe leaves stale listeners, which
  the registry drops when they throw.

## 6. Follow-ups (not in this change)

- ESLint suggestion: a binding whose value is a literal could be plain UnoCSS classes.
- Open-in-editor, if DevTools exposes it without a token.

## 7. As built

- **Detached elements are marked, not pruned.** An element inside a deactivated `<KeepAlive>`
  is disconnected but still mounted, so pruning it would be wrong. The registry reports
  `connected: false` and the list shows a "detached" badge; unmount still removes it.
- **The per-breakpoint table reads the element's variables**, not the binding values.
  Bindings merge variable by variable and repeated values collapse, so only the variables show
  what the CSS gets. The first version replaced whole properties and was wrong for composed
  components.
- **The element label names the element's own component.** Vue lists a component's root
  binding before its usage site's, so the first binding's component is used.
- **The REPL starts on the app's first property and breakpoint names**, taken from the build
  data, instead of a hard-coded `sm`/`md` example.
- **A fourth warning kind, `dropped-value`:** `getStyleProps` skips falsy values, so a numeric
  `0` never reaches the CSS. The tab says to use `'0'`.
- **`getDirectiveContext` is exported from the root entry**, since the registry and the
  directive share its marker through the `directive` chunk.
- **One tsdown config.** The client is a normal entry that imports only `clientUtils.ts`, so it
  builds to one file without imports; `pnpm smoke` checks that it stays that way.

### Found while testing, fixed by phase 1

The playground sets `theme.breakpoints` to `sm`/`md`/`lg`, but the package used to read the
merged UnoCSS theme, which also holds `presetWind3`'s `xl` and `2xl`. The directive therefore got
five breakpoints and the safelist five classes per property, and the playground header (which
reads its own config file) showed `lg` while the tab showed `xl` at 1400px wide.

Phase 1 of `ROADMAP.md` fixed this. The package now reads breakpoints the way UnoCSS's own
variants do: the user's theme value replaces the preset's defaults. The tab and the header agree
on `sm`/`md`/`lg`.

The fix changes what an app sees when it sets its own `theme.breakpoints` and still passes
`xl` values: those values are now dropped. The **Warnings** tab is where that shows. It reports
each one as `unknown-breakpoint`, because `inspectValue` checks keys against the directive's own
breakpoints.

### Updated after phase 1

Once phase 1 had made `presetMini` and `presetWind4` supported base presets, the tab changed in
three ways:

- **The suggested rule is the tested one where one exists.** The four rules from the README's
  "Prefixes your preset lacks" table now live in `src/knownRules.ts` as data. One entry yields
  the rule the tests run and the source text the README quotes. For one of those prefixes, the
  tab suggests that text. For any other prefix it suggests the general shape, as before. A test
  evaluates the text to prove it works as pasted.
- **The Overview names the theme key and the base preset.** The breakpoints line says whether
  they came from the option or the theme, and under which key (`theme.breakpoint` under
  presetWind4, `theme.breakpoints` otherwise). A new "UnoCSS presets" line lists the other
  presets in the resolved config.
- **The server and module tests run under all three presets.**
