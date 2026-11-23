# Playground

A Nuxt app that uses `vue-uno-style` the way a project would, through its Nuxt module. One page shows every behaviour of the directive, each next to the markup and the output it produced. CI builds it to check the published package, and GitHub Pages serves it.

Live: https://andrewbogdanovtss.github.io/vue-uno-style/. [`.github/workflows/pages.yml`](../.github/workflows/pages.yml) deploys it on every push to `main`. The Pages build sets `NUXT_APP_BASE_URL=/vue-uno-style/` and the `github_pages` Nitro preset, and runs the SSR checks under that base before uploading.

## Run it

The playground links to the package in the folder above (`link:..`) and loads its built `dist/`, so build the package first:

```bash
pnpm install
pnpm build
pnpm playground:install
pnpm playground:dev
```

After changing the package's source, run `pnpm build` again and restart the dev server.

`pnpm playground:verify` lints the app, lints a fixture that must fail, generates the static site into `playground/.output/public` and checks the generated HTML and CSS.

## Base presets

`PLAYGROUND_PRESET` picks the UnoCSS preset the playground runs on: `mini`, `wind3` (the default, and what Pages deploys) or `wind4`. CI runs `playground:verify` under all three.

```bash
PLAYGROUND_PRESET=wind4 pnpm playground:verify
```

The page needs no extra rules under any preset: its properties are either in every preset or are `bgi` and `bgv`, whose rules the package's preset ships.

## What it shows

| Where | What |
|-------|------|
| `config/vue-uno-style.ts` | The breakpoints and properties, in one TypeScript file that `nuxt.config.ts`, `uno.config.ts`, `eslint.config.js` and the page all import. |
| `uno.config.ts` | The base preset chosen by `PLAYGROUND_PRESET`. |
| `app/app.vue` | The page, one section per behaviour: values per breakpoint, argument and object forms, scalars and collapsed repeats, value formats, updates, composition and the directive's layer. |
| `app/components/GeneratedOutput.vue` | Shows the classes and variables for a value, from the same `getStyle()` call the directive makes. |
| `app/components/StatusBadge.vue` | A component with its own directive on its root, for the composition demo. |

The header shows the breakpoint the window is in, so the responsive demos can be read against it while resizing.

## What only a browser can show

`playground:verify` reads files off disk, so it covers server rendering and the directive's first write, never its update path. The **Updates** section exists for that: **Switch palette** replaces the classes and variables, and the amber palette has no `md` padding, so `--p-md` and its class must disappear. The lists under the card are read from the element itself, so stale output would show up there.

## Known SSR difference

In the **Scope relationships and composition** demo, the pre-rendered HTML has the component's own values winning the shared `c` and `bg` keys, and its classes are listed twice. Vue's SSR compiler merges a component's own directive output after the attributes its parent passed down, and `getSSRProps` gets no vnode to look at the parent's binding. On the client the directive recombines both bindings when it mounts, so the usage site wins from then on. The first paint shows the component's colors until then.

## Checking a renamed directive

Canvas registers the directive as `v-style`. To see it end to end, set `vUnoStyle: { directiveName: 'style', properties }` in `nuxt.config.ts`, pass the same `directiveName` to the ESLint rule, rename the directives in `app/` to `v-style`, and run `pnpm playground:verify`: the generated classes and variables are identical. The module option is unit-tested in `test/nuxt.test.ts`; a second full build in CI would re-verify Nuxt rather than this package.
