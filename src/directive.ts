import type { ResolveBreakpointsOptions, ResolvedBreakpoints } from './core/breakpoints'
import type { Responsive, ResponsiveStyles } from './core/getStyle'
import type { DirectiveBinding, ObjectDirective, VNode } from 'vue'
import { normalizeClass, normalizeStyle } from 'vue'
import { resolveBreakpoints } from './core/breakpoints'
import { getStyle } from './core/getStyle'

export type VUnoStyleValue = Responsive | ResponsiveStyles
export type VUnoStyleOptions = ResolveBreakpointsOptions

const DEFAULT_OPTIONS = {
  breakpoints: {
    sm: 0,
    md: 768,
    lg: 1024,
  },
} as const satisfies VUnoStyleOptions

/**
 * Creates a v-uno-style directive for a known breakpoint configuration.
 */
export const createVUnoStyle = (options: VUnoStyleOptions): ObjectDirective<HTMLElement, VUnoStyleValue> => {
  const breakpoints: ResolvedBreakpoints = resolveBreakpoints(options)
  const BASE = Symbol('vUnoStyleBase')

  type InjectedProps = Record<string | symbol, unknown> & {
    [BASE]?: { class: unknown, style: unknown }
  }

  const inject = (vnode: VNode, { arg, value }: DirectiveBinding<VUnoStyleValue>) => {
    const props = vnode?.props as InjectedProps | null
    if (!props) return

    const { classes, style } = value
      ? getStyle(value, breakpoints, arg)
      : { classes: '', style: {} }
    const base = props[BASE] ??= { class: props.class, style: props.style }

    props.class = normalizeClass([base.class, classes])
    props.style = { ...normalizeStyle([base.style]) as object, ...style }
  }

  const render = (el: HTMLElement, { arg, value, oldValue }: DirectiveBinding<VUnoStyleValue>) => {
    if (oldValue) {
      const { classes, style } = getStyle(oldValue, breakpoints, arg)

      if (classes) el.classList.remove(...classes.split(' '))
      Object.keys(style).forEach((key) => el.style.removeProperty(key))
    }

    if (!value) return

    const { classes, style } = getStyle(value, breakpoints, arg)

    if (classes) el.classList.add(...classes.split(' '))
    Object.entries(style).forEach(([key, value]) => el.style.setProperty(key, String(value)))
  }

  const updated = (el: HTMLElement, binding: DirectiveBinding<VUnoStyleValue>) => {
    if (JSON.stringify(binding.value) === JSON.stringify(binding.oldValue)) return

    render(el, binding)
  }

  return {
    created: (el, binding, vnode) => inject(vnode, binding),
    beforeMount: render,
    beforeUpdate: (el, binding, vnode) => inject(vnode, binding),
    updated,
    getSSRProps({ arg, value }: DirectiveBinding<VUnoStyleValue>) {
      if (!value) return
      const { classes, style } = getStyle(value, breakpoints, arg)

      return {
        class: classes,
        style,
      }
    },
  }
}

/**
 * Ready-to-register directive using the Canvas-compatible sm/md/lg breakpoints.
 */
export const vUnoStyle = createVUnoStyle(DEFAULT_OPTIONS)
