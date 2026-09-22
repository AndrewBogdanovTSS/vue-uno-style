// @vitest-environment jsdom

import type { VNode } from 'vue'
import type { ResponsiveStyles } from '../src/core/getStyle'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref, withDirectives } from 'vue'
import { vUnoStyle } from '../src/directive'

describe('vUnoStyle directive', () => {
  let element: HTMLElement

  beforeEach(() => {
    element = document.createElement('div')
  })

  describe('beforeMount hook', () => {
    it('applies classes and styles from responsive config', () => {
      const value: ResponsiveStyles = { c: { sm: 'red', md: 'blue' } } as any

      // @ts-expect-error Testing directive lifecycle hooks
      vUnoStyle.beforeMount(element, { value } as never, null as never, null)

      expect(element.style.cssText).toContain('--c: red')
      expect(element.style.cssText).toContain('--c-md: blue')
      expect(element.classList.length).toBeGreaterThan(0)
      expect(element.classList.toString()).toContain('c-$c')
    })

    it('handles multiple style properties', () => {
      const value: ResponsiveStyles = {
        c: { sm: 'red' },
        bg: { sm: 'blue' }
      } as any

      // @ts-expect-error Testing directive lifecycle hooks
      vUnoStyle.beforeMount(element, { value } as never, null as never, null)

      expect(element.style.cssText).toContain('--c: red')
      expect(element.style.cssText).toContain('--bg: blue')
      expect(element.classList.toString()).toContain('c-$c')
      expect(element.classList.toString()).toContain('bg-$bg')
    })

    it('handles directive with arg modifier (single property)', () => {
      const value: ResponsiveStyles = { sm: 'green' } as any

      // @ts-expect-error Testing directive lifecycle hooks
      vUnoStyle.beforeMount(element, { value, arg: 'c' } as never, null as never, null)

      expect(element.style.cssText).toContain('--c: green')
      expect(element.classList.toString()).toContain('c-$c')
    })

    it('does nothing when value is undefined', () => {
      // @ts-expect-error Testing directive lifecycle hooks
      vUnoStyle.beforeMount(element, { value: undefined } as never, null as never, null)

      expect(element.style.cssText).toBe('')
      expect(element.classList.length).toBe(0)
    })

    it('does nothing when value is null', () => {
      // @ts-expect-error Testing directive lifecycle hooks
      vUnoStyle.beforeMount(element, { value: null } as never, null as never, null)

      expect(element.style.cssText).toBe('')
      expect(element.classList.length).toBe(0)
    })

    it('skips properties with empty value', () => {
      const value: ResponsiveStyles = {
        c: { sm: 'red' },
        bg: {} as any
      } as any

      // @ts-expect-error Testing directive lifecycle hooks
      vUnoStyle.beforeMount(element, { value } as never, null as never, null)

      expect(element.style.cssText).toContain('--c: red')
      expect(element.classList.toString()).toContain('c-$c')
      // bg should not be applied because it has empty object
      expect(element.style.cssText).not.toContain('--bg')
    })

    it('applies styles when value is provided', () => {
      const value: ResponsiveStyles = { c: { sm: 'red' } } as any

      // @ts-expect-error Testing directive lifecycle hooks
      vUnoStyle.beforeMount(element, { value } as never, null as never, null)

      expect(element.style.cssText).toContain('--c: red')
      expect(element.classList.length).toBeGreaterThan(0)
    })

    it('returns early when all properties have empty values', () => {
      const value: ResponsiveStyles = {
        c: {} as any,
        bg: {} as any,
        w: {} as any
      } as any

      // @ts-expect-error Testing directive lifecycle hooks
      vUnoStyle.beforeMount(element, { value } as never, null as never, null)

      // When all properties are empty, no classes or styles should be applied
      expect(element.style.cssText).toBe('')
      expect(element.classList.length).toBe(0)
    })
  })

  describe('updated hook', () => {
    const createVNode = (propsOverride = {}): VNode<any, HTMLElement> => ({
      props: { class: 'original-class', style: { color: 'red' }, ...propsOverride }
    } as unknown as VNode<any, HTMLElement>)

    it('re-applies styles when value changes', () => {
      const oldValue: ResponsiveStyles = { c: { sm: 'red' } } as any
      const newValue: ResponsiveStyles = { c: { sm: 'blue' } } as any

      // @ts-expect-error Testing directive lifecycle hooks
      vUnoStyle.updated(
        element,
        { value: newValue, oldValue } as never,
        createVNode(),
        createVNode()
      )

      expect(element.style.cssText).toContain('--c: blue')
      expect(element.classList.toString()).toContain('c-$c')
    })

    it('does not re-apply when only the class or style props change', () => {
      const value: ResponsiveStyles = { c: { sm: 'blue' } } as any

      // `inject` puts the generated classes into the vnode, so Vue's own class/style patching
      // already carries them - the directive only has to react to a changed value
      // @ts-expect-error Testing directive lifecycle hooks
      vUnoStyle.updated(
        element,
        { value, oldValue: value } as never,
        createVNode({ class: 'new-class', style: { color: 'green' } }),
        createVNode({ class: 'old-class', style: { color: 'red' } })
      )

      expect(element.style.cssText).toBe('')
      expect(element.classList.length).toBe(0)
    })

    it('does not re-apply when nothing changes', () => {
      const value: ResponsiveStyles = { c: { sm: 'blue' } } as any
      const vnode = createVNode()

      // @ts-expect-error Testing directive lifecycle hooks
      vUnoStyle.updated(
        element,
        { value, oldValue: value } as never,
        vnode,
        vnode
      )

      // Element should remain unchanged
      expect(element.style.cssText).toBe('')
      expect(element.classList.length).toBe(0)
    })

    it('re-applies when multiple things change', () => {
      const oldValue: ResponsiveStyles = { c: { sm: 'red' } } as any
      const newValue: ResponsiveStyles = { c: { sm: 'blue' } } as any

      // @ts-expect-error Testing directive lifecycle hooks
      vUnoStyle.updated(
        element,
        { value: newValue, oldValue } as never,
        createVNode({ class: 'new-class', style: { color: 'green' } }),
        createVNode({ class: 'old-class', style: { color: 'red' } })
      )

      expect(element.style.cssText).toContain('--c: blue')
      expect(element.classList.toString()).toContain('c-$c')
    })

    it('removes CSS vars when a property is dropped from value', () => {
      const initialValue: ResponsiveStyles = { c: { sm: 'red' }, bg: { sm: 'blue' } } as any

      // @ts-expect-error Testing directive lifecycle hooks
      vUnoStyle.beforeMount(element, { value: initialValue } as never, null as never, null)

      expect(element.style.cssText).toContain('--c: red')
      expect(element.style.cssText).toContain('--bg: blue')

      const updatedValue: ResponsiveStyles = { c: { sm: 'red' } } as any // bg dropped

      // @ts-expect-error Testing directive lifecycle hooks
      vUnoStyle.updated(
        element,
        { value: updatedValue, oldValue: initialValue } as never,
        createVNode({ class: 'changed' }),
        createVNode()
      )

      expect(element.style.cssText).toContain('--c: red')
      expect(element.style.cssText).not.toContain('--bg')
    })

    it('removes old classes when value changes', () => {
      const oldValue: ResponsiveStyles = { c: { sm: 'red' }, bg: { sm: 'blue' } } as any
      const newValue: ResponsiveStyles = { c: { sm: 'green' } } as any

      // @ts-expect-error Testing directive lifecycle hooks
      vUnoStyle.beforeMount(element, { value: oldValue } as never, null as never, null)

      expect(element.classList.toString()).toContain('c-$c')
      expect(element.classList.toString()).toContain('bg-$bg')

      // @ts-expect-error Testing directive lifecycle hooks
      vUnoStyle.updated(
        element,
        { value: newValue, oldValue } as never,
        createVNode({ class: 'changed' }),
        createVNode()
      )

      expect(element.classList.toString()).toContain('c-$c')
      expect(element.classList.toString()).not.toContain('bg-$bg')
    })
  })

  describe('getSSRProps', () => {
    it('returns class and style props for SSR', () => {
      const value: ResponsiveStyles = { c: { sm: 'red', md: 'blue' } } as any

      // @ts-expect-error Testing directive SSR props
      const props = vUnoStyle.getSSRProps({ value } as never, null as never)

      expect(props).toHaveProperty('class')
      expect(props).toHaveProperty('style')
      expect(props!.style).toEqual({ '--c': 'red', '--c-md': 'blue' })
      expect(props!.class).toContain('c-$c')
    })

    it('handles arg modifier in SSR', () => {
      const value: ResponsiveStyles = { sm: 'white' } as any

      // @ts-expect-error Testing directive SSR props
      const props = vUnoStyle.getSSRProps({ value, arg: 'bg' } as never, null as never)

      expect(props).toHaveProperty('class')
      expect(props).toHaveProperty('style')
      expect(props!.style).toEqual({ '--bg': 'white' })
      expect(props!.class).toContain('bg-$bg')
    })

    it('returns undefined when value is not provided', () => {
      // @ts-expect-error Testing directive SSR props
      const props = vUnoStyle.getSSRProps({ value: undefined } as never, null as never)

      expect(props).toBeUndefined()
    })

    it('handles multiple properties in SSR', () => {
      const value: ResponsiveStyles = {
        c: { sm: 'red' },
        bg: { sm: 'blue' }
      } as any

      // @ts-expect-error Testing directive SSR props
      const props = vUnoStyle.getSSRProps({ value } as never, null as never)

      expect(props).toHaveProperty('class')
      expect(props).toHaveProperty('style')
      expect(props!.style).toEqual({ '--c': 'red', '--bg': 'blue' })
      expect(props!.class).toContain('c-$c')
      expect(props!.class).toContain('bg-$bg')
    })
  })

  describe('created and beforeUpdate hooks', () => {
    const createVNode = (props: any = {}): VNode<any, HTMLElement> => (
      { props } as unknown as VNode<any, HTMLElement>
    )

    it.each(['created', 'beforeUpdate'] as const)('%s writes generated classes into the vnode props', (hook) => {
      const value: ResponsiveStyles = { display: { sm: 'inline', md: 'none' } } as any
      const node = createVNode({ class: 'existing' })

      vUnoStyle[hook]!(element, { value } as never, node, null as never)

      expect(node.props!.class).toContain('existing')
      expect(node.props!.class).toContain('o:display-$display')
      expect(node.props!.class).toContain('o:md:display-$display-md')
    })

    it('writes generated CSS variables into the vnode props', () => {
      const value: ResponsiveStyles = { c: { sm: 'red' } } as any
      const node = createVNode({ style: { color: 'green' } })

      // @ts-expect-error Testing directive lifecycle hooks
      vUnoStyle.created(element, { value } as never, node, null)

      expect(node.props!.style).toEqual({ 'color': 'green', '--c': 'red' })
    })

    it('parses a string style into an object so Vue patches it per property', () => {
      const value: ResponsiveStyles = { c: { sm: 'red' } } as any
      const node = createVNode({ style: '--theme: dark' })

      // @ts-expect-error Testing directive lifecycle hooks
      vUnoStyle.created(element, { value } as never, node, null)

      expect(node.props!.style).toEqual({ '--theme': 'dark', '--c': 'red' })
    })

    it('supports the arg modifier', () => {
      const value: ResponsiveStyles = { sm: 'green' } as any
      const node = createVNode({ class: 'existing' })

      // @ts-expect-error Testing directive lifecycle hooks
      vUnoStyle.created(element, { value, arg: 'c' } as never, node, null)

      expect(node.props!.class).toContain('o:c-$c')
      expect(node.props!.style).toEqual({ '--c': 'green' })
    })

    it('is idempotent on a props object shared between renders', () => {
      const value: ResponsiveStyles = { c: { sm: 'red' } } as any
      const shared = { class: 'static', style: { color: 'red' } }

      // @ts-expect-error Testing directive lifecycle hooks
      vUnoStyle.created(element, { value } as never, { props: shared } as never, null)
      // @ts-expect-error Testing directive lifecycle hooks
      vUnoStyle.beforeUpdate(element, { value, oldValue: value } as never, { props: shared } as never, null)

      expect(shared.class).toBe('static o:c-$c')
      expect(shared.style).toEqual({ 'color': 'red', '--c': 'red' })
    })

    it('drops the previous value classes and vars from the props', () => {
      const oldValue: ResponsiveStyles = { c: { sm: 'red', md: 'blue' } } as any
      const value: ResponsiveStyles = { c: { sm: 'red', md: 'red' } } as any
      const shared: any = { class: 'static' }

      // @ts-expect-error Testing directive lifecycle hooks
      vUnoStyle.created(element, { value: oldValue } as never, { props: shared } as never, null)
      // @ts-expect-error Testing directive lifecycle hooks
      vUnoStyle.beforeUpdate(element, { value, oldValue } as never, { props: shared } as never, null)

      expect(shared.class).toBe('static o:c-$c')
      expect(shared.style).toEqual({ '--c': 'red' })
    })

    it('does not leak classes between elements sharing a hoisted props object', () => {
      const wide: ResponsiveStyles = { c: { sm: 'red', md: 'blue' } } as any
      const narrow: ResponsiveStyles = { c: { sm: 'red' } } as any
      // the compiler hoists a fully static props object and reuses it for every element
      const shared: any = { class: 'static' }

      // @ts-expect-error Testing directive lifecycle hooks
      vUnoStyle.created(element, { value: wide } as never, { props: shared } as never, null)
      expect(shared.class).toBe('static o:c-$c o:md:c-$c-md')

      // @ts-expect-error Testing directive lifecycle hooks
      vUnoStyle.created(element, { value: narrow } as never, { props: shared } as never, null)
      expect(shared.class).toBe('static o:c-$c')
    })

    it('does not apply twice to the same vnode', () => {
      const value: ResponsiveStyles = { c: { sm: 'red' } } as any
      const node = createVNode({ class: 'existing' })

      // @ts-expect-error Testing directive lifecycle hooks
      vUnoStyle.created(element, { value } as never, node, null)
      // @ts-expect-error Testing directive lifecycle hooks
      vUnoStyle.beforeUpdate(element, { value } as never, node, null)

      expect(node.props!.class).toBe('existing o:c-$c')
    })

    it('does nothing when the vnode, its props or the value are missing', () => {
      const value: ResponsiveStyles = { c: { sm: 'red' } } as any
      const propless = createVNode(null)
      const node = createVNode({ class: 'existing' })

      expect(() => {
        // @ts-expect-error Testing directive lifecycle hooks
        vUnoStyle.created(element, { value } as never, null, null)
        // @ts-expect-error Testing directive lifecycle hooks
        vUnoStyle.created(element, { value } as never, propless, null)
        // @ts-expect-error Testing directive lifecycle hooks
        vUnoStyle.created(element, { value: undefined } as never, node, null)
      }).not.toThrow()

      expect(node.props!.class).toBe('existing')
    })
  })

  describe('Vue component integration', () => {
    it('works with single property using arg modifier', () => {
      const wrapper = mount({
        template: '<div v-style:c="color"></div>',
        directives: { style: vUnoStyle },
        setup: () => ({ color: { sm: 'red' } })
      })

      const div = wrapper.find('div').element as HTMLElement
      expect(div.classList.toString()).toContain('c-$c')
      wrapper.unmount()
    })

    it('works with multiple properties', () => {
      const wrapper = mount({
        template: '<div v-style="styles"></div>',
        directives: { style: vUnoStyle },
        setup: () => ({
          styles: {
            c: { sm: 'red' },
            bg: { sm: 'blue' }
          }
        })
      })

      const div = wrapper.find('div').element as HTMLElement
      expect(div.classList.toString()).toContain('c-$c')
      expect(div.classList.toString()).toContain('bg-$bg')
      wrapper.unmount()
    })

    it('updates when reactive value changes', async () => {
      const wrapper = mount({
        template: '<div v-style:c="color"></div>',
        directives: { style: vUnoStyle },
        data: () => ({ color: { sm: 'red' } })
      })

      let div = wrapper.find('div').element as HTMLElement
      expect(div.classList.toString()).toContain('c-$c')

      await wrapper.setData({ color: { sm: 'blue' } })

      div = wrapper.find('div').element as HTMLElement
      expect(div.style.cssText).toContain('--c: blue')
      wrapper.unmount()
    })
  })

  describe('elements with nothing to inject into', () => {
    it('still applies when the vnode carries no props', () => {
      const wrapper = mount({
        template: '<div v-style:c="color"></div>',
        directives: { style: vUnoStyle },
        setup: () => ({ color: { sm: 'red' } })
      })
      const element = wrapper.get('div').element as any

      // no props object exists to inject into, so `beforeMount` is what applies it - and Vue never
      // patches `class` on such an element either, so nothing can overwrite it
      expect(element.__vnode.props).toBeNull()
      expect(element.className).toContain('o:c-$c')
      expect(element.style.cssText).toContain('--c: red')
    })
  })

  describe('vnode props hygiene', () => {
    it('does not accumulate generated classes across re-renders', async () => {
      const bump = ref(0)
      const wrapper = mount({
        template: '<div class="static" v-style:c="color">{{ bump }}</div>',
        directives: { style: vUnoStyle },
        setup: () => ({ color: { sm: 'red' }, bump })
      })
      const element = wrapper.get('div').element as any

      bump.value++
      await nextTick()
      bump.value++
      await nextTick()

      expect(element.className.match(/o:c-\$c/g)).toHaveLength(1)
      expect(String(element.__vnode.props.class).match(/o:c-\$c/g)).toHaveLength(1)
    })
  })

  describe('edge cases', () => {
    it('handles numeric values', () => {
      const value: ResponsiveStyles = { w: { sm: 100 } } as any

      // @ts-expect-error Testing directive lifecycle hooks
      vUnoStyle.beforeMount(element, { value } as never, null as never, null)

      expect(element.style.cssText).toContain('--w: 100')
      expect(element.classList.toString()).toContain('w-$w')
    })

    it('handles string values', () => {
      const value: ResponsiveStyles = { p: { sm: '1rem' } } as any

      // @ts-expect-error Testing directive lifecycle hooks
      vUnoStyle.beforeMount(element, { value } as never, null as never, null)

      expect(element.style.cssText).toContain('--p: 1rem')
      expect(element.classList.toString()).toContain('p-$p')
    })

    it('appends styles without removing existing cssText', () => {
      element.style.cssText = 'color: green;'

      const value: ResponsiveStyles = { c: { sm: 'red' } } as any

      // @ts-expect-error Testing directive lifecycle hooks
      vUnoStyle.beforeMount(element, { value } as never, null as never, null)

      expect(element.style.cssText).toContain('color: green')
      expect(element.style.cssText).toContain('--c: red')
    })

    it('handles properties with falsy values', () => {
      const value: ResponsiveStyles = {
        c: { sm: 'red' },
        bg: null as any,
        w: undefined as any
      } as any

      // @ts-expect-error Testing directive lifecycle hooks
      vUnoStyle.beforeMount(element, { value } as never, null as never, null)

      // Only 'c' should be applied, bg and w are falsy
      expect(element.style.cssText).toContain('--c: red')
      expect(element.classList.toString()).toContain('c-$c')
      expect(element.style.cssText).not.toContain('--bg')
      expect(element.style.cssText).not.toContain('--w')
    })

    it('two directives on the same element use separate state when values differ', () => {
      const createVNode = (propsOverride = {}): VNode<any, HTMLElement> => ({
        props: { class: 'original-class', style: { color: 'red' }, ...propsOverride }
      } as unknown as VNode<any, HTMLElement>)

      const value1: ResponsiveStyles = { c: { sm: 'red' } } as any
      const value2: ResponsiveStyles = { bg: { sm: 'blue' } } as any

      // Two separate directive bindings applied to the same element
      // @ts-expect-error Testing directive lifecycle hooks
      vUnoStyle.beforeMount(element, { value: value1 } as never, null as never, null)
      // @ts-expect-error Testing directive lifecycle hooks
      vUnoStyle.beforeMount(element, { value: value2 } as never, null as never, null)

      expect(element.style.cssText).toContain('--c: red')
      expect(element.style.cssText).toContain('--bg: blue')

      // Updating the first binding should not affect the second
      // @ts-expect-error Testing directive lifecycle hooks
      vUnoStyle.updated(
        element,
        { value: { c: { sm: 'green' } } as any, oldValue: value1 } as never,
        createVNode({ class: 'changed' }),
        createVNode()
      )

      expect(element.style.cssText).toContain('--c: green')
      expect(element.style.cssText).toContain('--bg: blue')
    })
  })

  describe('element state', () => {
    it('keeps no bookkeeping state on the element', () => {
      const value: ResponsiveStyles = { c: { sm: 'red' }, bg: { sm: 'blue' } } as any

      // @ts-expect-error Testing directive lifecycle hooks
      vUnoStyle.beforeMount(element, { value } as never, null as never, null)

      expect(element.style.cssText).toContain('--c: red')
      expect(Object.keys(element)).toHaveLength(0)
    })

    it('removes the previous value classes and vars using oldValue', () => {
      const oldValue: ResponsiveStyles = { c: { sm: 'red', md: 'blue' } } as any
      const value: ResponsiveStyles = { c: { sm: 'red', md: 'red' } } as any

      // @ts-expect-error Testing directive lifecycle hooks
      vUnoStyle.beforeMount(element, { value: oldValue } as never, null as never, null)

      expect(element.classList.toString()).toContain('o:md:c-$c-md')

      // @ts-expect-error Testing directive lifecycle hooks
      vUnoStyle.updated(element, { value, oldValue } as never, null as never, null)

      // md now equals sm, so the md breakpoint class and variable must be gone
      expect(element.classList.toString()).toContain('o:c-$c')
      expect(element.classList.toString()).not.toContain('o:md:c-$c-md')
      expect(element.style.cssText).not.toContain('--c-md')
    })
  })

  describe('class rewrites driven by a child component', () => {
    const active = ref(false)

    // Mirrors vue-router's `RouterLink`: the root element's class comes from the child's own
    // reactive state, so flipping it re-renders only the child, not the owner of the directive
    const RouterLinkStub = defineComponent({
      name: 'RouterLinkStub',
      setup: (_, { slots }) => () => h('a', { class: { 'router-link-active': active.value } }, slots.default?.())
    })

    // Mirrors `base-link`: a pass-through wrapper, so the anchor receives fallthrough attrs and
    // its class prop ends up as a merged string instead of the child's own object
    const BaseLinkStub = defineComponent({
      name: 'BaseLinkStub',
      setup: (_, { slots }) => () => h(RouterLinkStub, { 'class': 'underscored', 'data-test-id': 'base-link' }, { default: () => slots.default?.() })
    })

    // Mirrors `vf-link`: the component the directive is actually applied to
    const VfLinkStub = defineComponent({
      name: 'VfLinkStub',
      setup: (_, { slots }) => () => h(BaseLinkStub, { 'class': ['body-1', { 'fw-bold': true }], 'data-test-id': 'vf-link' }, { default: () => slots.default?.() })
    })

    const mountLink = (value: ResponsiveStyles) => mount(defineComponent({
      setup: () => () => withDirectives(
        h(VfLinkStub, { class: 'c-$c space-x-1' }, { default: () => 'text' }),
        [[vUnoStyle, value]]
      )
    }))

    beforeEach(() => {
      active.value = false
    })

    it('keeps generated classes when the child re-renders with a different class', async () => {
      const wrapper = mountLink({ display: { sm: 'inline', md: 'none' } } as any)
      const link = wrapper.get('a')

      expect(link.classes()).toContain('o:display-$display')
      expect(link.classes()).toContain('o:md:display-$display-md')

      active.value = true
      await nextTick()

      expect(link.classes()).toContain('router-link-active')
      expect(link.classes()).toContain('o:display-$display')
      expect(link.classes()).toContain('o:md:display-$display-md')
    })

    // The actual defect: the generated classes lived only on the DOM node, so the next
    // `el.className = <vnode class>` patch dropped them for good. Vue must own them instead.
    it('writes the generated classes into the anchor own vnode', () => {
      const wrapper = mountLink({ display: { sm: 'inline', md: 'none' } } as any)
      const { __vnode: vnode } = wrapper.get('a').element as any

      expect(vnode.props.class).toContain('o:display-$display')
      expect(vnode.props.class).toContain('o:md:display-$display-md')
    })

    it('keeps generated classes through a class rewrite driven from the vnode', async () => {
      const wrapper = mountLink({ display: { sm: 'inline', md: 'none' } } as any)
      const element = wrapper.get('a').element as any

      active.value = true
      await nextTick()

      // exactly what Vue's `patchClass` does on every class change
      element.className = element.__vnode.props.class

      expect(element.className).toContain('router-link-active')
      expect(element.className).toContain('o:display-$display')
      expect(element.className).toContain('o:md:display-$display-md')
    })

    it('keeps generated CSS variables when the child re-renders with a different class', async () => {
      const wrapper = mountLink({ display: { sm: 'inline', md: 'none' } } as any)
      const link = wrapper.get('a')

      active.value = true
      await nextTick()

      expect(link.attributes('style')).toContain('--display: inline')
      expect(link.attributes('style')).toContain('--display-md: none')
    })
  })
})
