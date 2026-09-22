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

`demo:verify` lints the real Vue template with `vue-uno-style/eslint`, generates
the Nuxt site, and checks the generated HTML and CSS. The assertions prove that
directive classes and custom properties are present during SSR and that the
preset emitted the matching base and responsive CSS.

## What it covers

- Object syntax for `c`, `bgv`, and `p`.
- Argument syntax for `bgi`.
- A zero-valued `sm` base plus `md` and `lg` media-query breakpoints.
- Nuxt module registration through `vue-uno-style/nuxt`.
- ESLint resolution through the built `vue-uno-style/eslint` export.
