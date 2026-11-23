/**
 * The playground's vue-uno-style configuration, in one TypeScript file so the Nuxt config, the
 * UnoCSS config, the ESLint config and the page itself all read the same values. It uses only
 * erasable TypeScript, so Node runs it as is for the ESLint config and the check scripts.
 */
import type { BreakpointConfig, PropertyConfig } from 'vue-uno-style'

/** `sm: 0` is the unprefixed base; `md` and `lg` become media queries. */
export const breakpoints = { sm: '0px', md: '768px', lg: '1024px' } satisfies BreakpointConfig

// Every property the page's directives set. Every base preset has a `<prefix>-$<variable>` rule for the plain ones,
// and the package's preset serves `bgv` and `bgi`, whose plain URL values take the built-in `url` format
export const properties = ['c', 'bg', 'p', 'gap', 'w', 'bgv', 'bgi'] satisfies PropertyConfig[]
