# vue-uno-style demo

A minimal Nuxt app that exercises the built package through all four public
integration paths: the Nuxt module, UnoCSS preset, Vue directive, and ESLint
plugin.

## Run it

From the package root:

```bash
pnpm build
pnpm demo:install
pnpm demo:verify
pnpm demo:dev
```

`demo:verify` lints the real Vue template with `vue-uno-style/eslint`, lints a
fixture that is expected to fail, generates the Nuxt site, and checks the
generated HTML and CSS. The assertions prove that directive classes and custom
properties are present during SSR and that the preset emitted the matching base
and responsive CSS.

The fixture matters: linting only clean files reports success whether the rule
fires or has silently stopped matching, so `fixtures/multiple-directives.vue`
carries a known violation and `verify:lint` fails if it is not reported.

## What only a browser can show

`demo:verify` reads files off disk, so it covers server rendering and the
directive's first write - never its update path. `updated` has to remove the
previous value's classes and custom properties before applying the new ones, and
that only runs when a bound value changes after hydration.

The palette toggle exists for that. Run `pnpm demo:dev`, open the page and click
**Switch palette**, then check the card element:

- classes and `--c` / `--bgv` / `--p` swap to the new palette
- `o:md:p-$p-md` and `--p-md` are **removed**, because the amber palette has no
  `md` padding - stale output being left behind is the failure this catches
- clicking back restores them, with no duplicated classes

## Checking a renamed directive

Canvas registers the directive as `v-style`. The module option is unit-tested at
`test/nuxt.test.ts`, which asserts the generated plugin registers the configured
name. To see it end to end, set `vUnoStyle: { directiveName: 'style' }` in
`nuxt.config.ts`, rename the directives in `app/app.vue` to `v-style`, and run
`pnpm demo:verify` - the generated classes and variables are identical.

This is not wired into CI on purpose. The default-name build already proves that
Nuxt loads the generated plugin, so a second full build would re-verify Nuxt
rather than this package.

## What it covers

- Object syntax for `c`, `bgv`, and `p`.
- Argument syntax for `bgi`.
- A zero-valued `sm` base plus `md` and `lg` media-query breakpoints.
- Nuxt module registration through `vue-uno-style/nuxt`.
- ESLint resolution through the built `vue-uno-style/eslint` export, plus a
  fixture proving the rule still fires and withholds its unsafe autofix.
- The directive's update path, via the palette toggle (browser only).
