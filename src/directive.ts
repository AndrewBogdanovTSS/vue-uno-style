import type { ResolveBreakpointsOptions, ResolvedBreakpoints } from './core/breakpoints'
import type { Responsive, ResponsiveStyles, StyleResult, StyleValue } from './core/getStyle'
import type { PropertyConfig, ResolvedProperties } from './core/properties'
import type { DirectiveBinding, ObjectDirective, VNode } from 'vue'
import { normalizeClass, normalizeStyle } from 'vue'
import { resolveBreakpoints } from './core/breakpoints'
import { getStyle } from './core/getStyle'
import { resolveProperties } from './core/properties'

export type VUnoStyleValue = Responsive | ResponsiveStyles

export interface VUnoStyleOptions extends ResolveBreakpointsOptions {
  /**
   * The properties configured for the preset. Optional here: without them the directive still
   * writes classes for any property, but applies no value formats and cannot warn about a
   * property the preset does not safelist.
   */
  properties?: readonly PropertyConfig[]
}

const DEFAULT_OPTIONS = {
  breakpoints: {
    sm: 0,
    md: 768,
    lg: 1024,
  },
} as const satisfies VUnoStyleOptions

/**
 * Tags every directive built by `createVUnoStyle` with its resolved configuration. `activeBindings`
 * uses it to recognise sibling v-uno-style bindings on a vnode by marker rather than by object
 * identity, so bindings from different factory instances still compose, each with its own
 * breakpoints and properties.
 */
const MARKER = Symbol('vUnoStyle')

/** Keeps the pristine `class`/`style` of a vnode's props aside before the first injection. */
const BASE = Symbol('vUnoStyleBase')

interface DirectiveContext {
  breakpoints: ResolvedBreakpoints
  properties?: ResolvedProperties
}

type MarkedDirective = { [MARKER]?: DirectiveContext }
type Binding = DirectiveBinding<VUnoStyleValue | null | undefined>
type InjectedProps = Record<string | symbol, unknown> & {
  [BASE]?: { class: unknown, style: unknown }
}

const EMPTY: StyleResult = { classes: '', style: {} }

/**
 * The resolved configuration of a directive built by `createVUnoStyle`, or `undefined` for any
 * other directive. Lets tooling find a vnode's v-uno-style bindings the way the directive does.
 */
export const getDirectiveContext = (directive: unknown): {
  breakpoints: ResolvedBreakpoints
  properties?: ResolvedProperties
} | undefined => (directive as MarkedDirective | null | undefined)?.[MARKER]

/**
 * A single-root component can receive a v-uno-style from its usage site as well as define its own
 * on its root element - Vue then merges both bindings onto that one rendered vnode (`vnode.dirs`).
 * Each binding's hook still fires independently, so every hook has to work from the *combined* set
 * of v-uno-style bindings on the vnode rather than only the one that triggered it, or whichever
 * binding runs last overwrites the `class`/`style` the other had already written.
 *
 * Falls back to the triggering binding alone when `vnode.dirs` is not populated (e.g. a directive
 * hook invoked directly), where there is only ever one binding to begin with.
 */
const activeBindings = (vnode: VNode | null | undefined, binding: Binding): Binding[] => {
  const siblings = (vnode?.dirs as Binding[] | null | undefined)
    ?.filter((dir) => (dir.dir as MarkedDirective | undefined)?.[MARKER])

  return siblings?.length ? siblings : [binding]
}

/**
 * Combines every binding's generated classes and variables into one set. Later bindings win on
 * conflicting variables - Vue lists the usage site's binding after the child's own root binding.
 */
const combine = (bindings: Binding[], fallback: DirectiveContext): StyleResult =>
  bindings.reduce<StyleResult>((acc, { arg, value, dir }) => {
    if (!value) return acc

    const { breakpoints, properties } = (dir as MarkedDirective | undefined)?.[MARKER] ?? fallback
    const { classes, style } = getStyle(value, breakpoints, arg, properties)

    return {
      classes: [acc.classes, classes].filter(Boolean).join(' '),
      style: { ...acc.style, ...style },
    }
  }, EMPTY)

const splitClasses = (classes: string) => classes ? classes.split(' ') : []

/**
 * Creates a v-uno-style directive for a known breakpoint configuration.
 */
export const createVUnoStyle = (options: VUnoStyleOptions): ObjectDirective<HTMLElement, VUnoStyleValue> => {
  const context: DirectiveContext = {
    breakpoints: resolveBreakpoints(options),
    properties: options.properties ? resolveProperties(options.properties) : undefined,
  }

  /**
   * Writes the combined classes and variables into the vnode props, so Vue owns them and its own
   * `class`/`style` patching carries them along instead of overwriting them.
   *
   * Vue reads `vnode.props` before invoking the hook, so the object is edited in place - and the
   * compiler hoists a fully static one and reuses it for every render and every element. The
   * pristine `class`/`style` is kept aside on first use and every write starts from it, so repeated
   * injections stay idempotent and one element cannot inherit another's classes.
   */
  const inject = (vnode: VNode | null | undefined, binding: Binding) => {
    const props = vnode?.props as InjectedProps | null | undefined
    if (!props) return

    const { classes, style } = combine(activeBindings(vnode, binding), context)
    const base = props[BASE] ??= { class: props.class, style: props.style }

    props.class = normalizeClass([base.class, classes])
    props.style = { ...normalizeStyle([base.style]) as object, ...style }
  }

  /**
   * Applies the combined classes and variables straight to the DOM node. Still needed next to
   * `inject` because Vue only patches `class`/`style` from props when the compiler marked them
   * dynamic - for `<div class="static" v-uno-style:c="x" />` it never does, so a changed value would
   * otherwise leave stale classes and variables behind.
   *
   * The previous combined set is derived by swapping the triggering binding's current value for its
   * `oldValue`. Only what the previous set had and the current one lacks is removed, so a key that a
   * sibling binding still provides survives, and no bookkeeping state lives on the element.
   */
  const render = (el: HTMLElement, vnode: VNode | null | undefined, binding: Binding) => {
    const bindings = activeBindings(vnode, binding)
    const current = combine(bindings, context)
    const classes = splitClasses(current.classes)

    if (binding.oldValue) {
      const oldBindings = bindings.map((sibling) =>
        sibling === binding ? { ...binding, value: binding.oldValue } : sibling)
      const previous = combine(oldBindings, context)

      splitClasses(previous.classes)
        .filter((name) => !classes.includes(name))
        .forEach((name) => el.classList.remove(name))
      Object.keys(previous.style)
        .filter((key) => !(key in current.style))
        .forEach((key) => el.style.removeProperty(key))
    }

    if (classes.length) el.classList.add(...classes)
    Object.entries(current.style).forEach(([key, value]: [string, StyleValue]) =>
      el.style.setProperty(key, String(value)))
  }

  const updated = (el: HTMLElement, binding: Binding, vnode: VNode | null | undefined) => {
    // Only a changed value requires recomputing; an unrelated vnode patch does not.
    if (JSON.stringify(binding.value) === JSON.stringify(binding.oldValue)) return

    render(el, vnode, binding)
  }

  const directive: ObjectDirective<HTMLElement, VUnoStyleValue> & MarkedDirective = {
    // `_el` is positional only - these two hooks write into the vnode props
    // rather than the element, so Vue owns the class/style patching.
    created: (_el, binding, vnode) => inject(vnode, binding),
    beforeMount: (el, binding, vnode) => render(el, vnode, binding),
    beforeUpdate: (_el, binding, vnode) => inject(vnode, binding),
    updated: (el, binding, vnode) => updated(el, binding, vnode),
    getSSRProps({ arg, value }: DirectiveBinding<VUnoStyleValue>) {
      if (!value) return
      const { classes, style } = getStyle(value, context.breakpoints, arg, context.properties)

      return {
        class: classes,
        style,
      }
    },
    [MARKER]: context,
  }

  return directive
}

/**
 * Ready-to-register directive using sm/md/lg breakpoints (`sm: 0`, `md: 768`, `lg: 1024`) and no
 * configured properties. Use `createVUnoStyle` to match other breakpoints or apply value formats.
 *
 * A single-root component may define its own v-uno-style on its root element while its usage site
 * also applies one. Vue merges both onto the same rendered vnode, and the directive composes their
 * classes and variables instead of the later one overwriting the former; the usage site wins on a
 * conflicting property.
 */
export const vUnoStyle = createVUnoStyle(DEFAULT_OPTIONS)
