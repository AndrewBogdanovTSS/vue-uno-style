// @vitest-environment jsdom

import type { DirectiveBinding, VNode } from 'vue'
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
      expect(node.props!.class).toContain('vs:display-$display')
      expect(node.props!.class).toContain('vs:md:display-$display-md')
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

      expect(node.props!.class).toContain('vs:c-$c')
      expect(node.props!.style).toEqual({ '--c': 'green' })
    })

    it('is idempotent on a props object shared between renders', () => {
      const value: ResponsiveStyles = { c: { sm: 'red' } } as any
      const shared = { class: 'static', style: { color: 'red' } }

      // @ts-expect-error Testing directive lifecycle hooks
      vUnoStyle.created(element, { value } as never, { props: shared } as never, null)
      // @ts-expect-error Testing directive lifecycle hooks
      vUnoStyle.beforeUpdate(element, { value, oldValue: value } as never, { props: shared } as never, null)

      expect(shared.class).toBe('static vs:c-$c')
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

      expect(shared.class).toBe('static vs:c-$c')
      expect(shared.style).toEqual({ '--c': 'red' })
    })

    it('does not leak classes between elements sharing a hoisted props object', () => {
      const wide: ResponsiveStyles = { c: { sm: 'red', md: 'blue' } } as any
      const narrow: ResponsiveStyles = { c: { sm: 'red' } } as any
      // the compiler hoists a fully static props object and reuses it for every element
      const shared: any = { class: 'static' }

      // @ts-expect-error Testing directive lifecycle hooks
      vUnoStyle.created(element, { value: wide } as never, { props: shared } as never, null)
      expect(shared.class).toBe('static vs:c-$c vs:md:c-$c-md')

      // @ts-expect-error Testing directive lifecycle hooks
      vUnoStyle.created(element, { value: narrow } as never, { props: shared } as never, null)
      expect(shared.class).toBe('static vs:c-$c')
    })

    it('does not apply twice to the same vnode', () => {
      const value: ResponsiveStyles = { c: { sm: 'red' } } as any
      const node = createVNode({ class: 'existing' })

      // @ts-expect-error Testing directive lifecycle hooks
      vUnoStyle.created(element, { value } as never, node, null)
      // @ts-expect-error Testing directive lifecycle hooks
      vUnoStyle.beforeUpdate(element, { value } as never, node, null)

      expect(node.props!.class).toBe('existing vs:c-$c')
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

    // Mirrors a single-root icon component used from an accordion: the child defines its own
    // directive on its root element while the parent also applies one on the component usage. Vue
    // folds the parent's binding onto that same root vnode (`vnode.dirs`), so without the vnode-aware
    // combination the later-applied binding wiped the other's `style`.
    it('composes a child component own directive with one applied from its usage site', async () => {
      const active = ref(false)
      const ChildStub = defineComponent({
        props: { w: { type: String, default: '' }, h: { type: String, default: '' } },
        // The `active` class is unrelated to the directive - it mirrors vue-router's `RouterLink`
        // reacting to its own state, which makes Vue render a new root vnode and apply its `class`
        // fresh. A sibling binding's classes, lost from that vnode's props, never reach the DOM.
        setup: (props) => () => withDirectives(
          h('i', { class: ['block shrink-0', { active: active.value }] }),
          [[vUnoStyle, { w: { sm: props.w }, h: { sm: props.h } }]]
        )
      })

      const wrapper = mount({
        components: { ChildStub },
        template: '<child-stub v-style:c="{ sm: \'red\' }" h="2rem" w="2rem" />',
        directives: { style: vUnoStyle }
      })

      const icon = wrapper.get('i').element as HTMLElement
      expect(icon.style.cssText).toContain('--w: 2rem')
      expect(icon.style.cssText).toContain('--h: 2rem')
      expect(icon.style.cssText).toContain('--c: red')
      expect(icon.classList.toString()).toContain('w-$w')
      expect(icon.classList.toString()).toContain('h-$h')
      expect(icon.classList.toString()).toContain('c-$c')

      active.value = true
      await nextTick()

      // The child's own class rewrite must not drop the classes generated by either binding
      expect(icon.classList.toString()).toContain('active')
      expect(icon.classList.toString()).toContain('w-$w')
      expect(icon.classList.toString()).toContain('h-$h')
      expect(icon.classList.toString()).toContain('c-$c')
      wrapper.unmount()
    })

    // When the usage site and the child's own root both set the same key, the usage site's value
    // must keep winning on the DOM even after the child's own binding updates independently.
    it('keeps the usage site winning a conflicting key after the child updates its own binding', async () => {
      const childColor = ref('green')
      const ChildStub = defineComponent({
        setup: () => () => withDirectives(
          h('i', { class: 'block shrink-0' }),
          [[vUnoStyle, { c: { sm: childColor.value } }]]
        )
      })

      const wrapper = mount({
        components: { ChildStub },
        template: '<child-stub v-style:c="{ sm: \'blue\' }" />',
        directives: { style: vUnoStyle }
      })

      const icon = wrapper.get('i').element as HTMLElement
      expect(icon.style.cssText).toContain('--c: blue')
      expect(icon.classList.toString()).toContain('c-$c')

      childColor.value = 'orange'
      await nextTick()

      expect(icon.style.cssText).toContain('--c: blue')
      expect(icon.classList.toString()).toContain('c-$c')
      wrapper.unmount()
    })

    // When the usage site's binding turns falsy, the child's own value for the same key must take
    // over on the DOM instead of being removed along with the usage site's contribution.
    it('falls back to the child own value when the usage site binding becomes undefined', async () => {
      const parentColor = ref<{ sm: string } | undefined>({ sm: 'blue' })
      const ChildStub = defineComponent({
        setup: () => () => withDirectives(
          h('i', { class: 'block shrink-0' }),
          [[vUnoStyle, { c: { sm: 'green' } }]]
        )
      })

      const wrapper = mount({
        components: { ChildStub },
        template: '<child-stub v-style:c="parentColor" />',
        directives: { style: vUnoStyle },
        setup: () => ({ parentColor })
      })

      const icon = wrapper.get('i').element as HTMLElement
      expect(icon.style.cssText).toContain('--c: blue')
      expect(icon.classList.toString()).toContain('c-$c')

      parentColor.value = undefined
      await nextTick()

      expect(icon.style.cssText).toContain('--c: green')
      expect(icon.classList.toString()).toContain('c-$c')
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
      expect(element.className).toContain('vs:c-$c')
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

      expect(element.className.match(/vs:c-\$c/g)).toHaveLength(1)
      expect(String(element.__vnode.props.class).match(/vs:c-\$c/g)).toHaveLength(1)
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

    it('writes a numeric zero, as a scalar and at a breakpoint', () => {
      // @ts-expect-error Testing directive lifecycle hooks
      vUnoStyle.beforeMount(element, { arg: 'm', value: 0 } as never, null as never, null)

      expect(element.style.getPropertyValue('--m')).toBe('0')
      expect(element.classList.contains('vs:m-$m')).toBe(true)

      const other = document.createElement('div')
      const value: ResponsiveStyles = { p: { sm: '16px', md: 0 } }

      // @ts-expect-error Testing directive lifecycle hooks
      vUnoStyle.beforeMount(other, { value } as never, null as never, null)

      expect(other.style.getPropertyValue('--p')).toBe('16px')
      expect(other.style.getPropertyValue('--p-md')).toBe('0')
      expect(other.classList.contains('vs:md:p-$p-md')).toBe(true)
    })

    it('clears a numeric zero once the value is emptied', () => {
      // @ts-expect-error Testing directive lifecycle hooks
      vUnoStyle.beforeMount(element, { arg: 'm', value: 0 } as never, null as never, null)
      // @ts-expect-error Testing directive lifecycle hooks
      vUnoStyle.updated(element, { arg: 'm', value: '', oldValue: 0 } as never, null as never, null)

      expect(element.style.getPropertyValue('--m')).toBe('')
      expect(element.classList.contains('vs:m-$m')).toBe(false)
    })

    it('renders a numeric zero on the server', () => {
      expect(vUnoStyle.getSSRProps!({ arg: 'm', value: 0 } as never, null as never)).toEqual({
        class: 'vs:m-$m',
        style: { '--m': 0 }
      })
    })

    it('skips false, so `condition && value` leaves the property unset', () => {
      // @ts-expect-error Testing directive lifecycle hooks
      vUnoStyle.beforeMount(element, { arg: 'h', value: false } as never, null as never, null)

      expect(element.style.getPropertyValue('--h')).toBe('')
      expect(element.classList.contains('vs:h-$h')).toBe(false)

      const other = document.createElement('div')
      // @ts-expect-error Testing directive lifecycle hooks
      vUnoStyle.beforeMount(other, { value: { h: { sm: '10rem', md: false }, w: false } } as never, null as never, null)

      expect(other.style.getPropertyValue('--h')).toBe('10rem')
      expect(other.style.getPropertyValue('--h-md')).toBe('')
      expect(other.style.getPropertyValue('--w')).toBe('')
      expect(other.classList.contains('vs:md:h-$h-md')).toBe(false)
    })

    it('skips true, which is never a CSS value', () => {
      // @ts-expect-error Testing directive lifecycle hooks
      vUnoStyle.beforeMount(element, { arg: 'h', value: true } as never, null as never, null)

      expect(element.style.getPropertyValue('--h')).toBe('')
      expect(element.classList.contains('vs:h-$h')).toBe(false)
    })

    it('clears a value once it turns false', () => {
      // @ts-expect-error Testing directive lifecycle hooks
      vUnoStyle.beforeMount(element, { arg: 'h', value: '10rem' } as never, null as never, null)
      // @ts-expect-error Testing directive lifecycle hooks
      vUnoStyle.updated(element, { arg: 'h', value: false, oldValue: '10rem' } as never, null as never, null)

      expect(element.style.getPropertyValue('--h')).toBe('')
      expect(element.classList.contains('vs:h-$h')).toBe(false)
    })

    it('renders nothing for false on the server', () => {
      expect(vUnoStyle.getSSRProps!({ arg: 'h', value: false } as never, null as never)).toBeUndefined()
      expect(vUnoStyle.getSSRProps!({ arg: 'h', value: { sm: '10rem', md: false } } as never, null as never)).toEqual({
        class: 'vs:h-$h',
        style: { '--h': '10rem' }
      })
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

    it('two directives on the same element keep composing correctly when one of them updates', () => {
      // Real usage shares one `vnode.dirs` array across both bindings (Vue merges them for a
      // single-root component's own directive plus one applied from its usage site) - simulate
      // that instead of two unrelated calls, so updating one binding cannot wipe the other.
      const binding1 = { dir: vUnoStyle, value: { c: { sm: 'red' } } as any } as DirectiveBinding<ResponsiveStyles>
      const binding2 = { dir: vUnoStyle, value: { bg: { sm: 'blue' } } as any } as DirectiveBinding<ResponsiveStyles>
      const vnode = {
        props: { class: 'original-class', style: { color: 'red' } },
        dirs: [binding1, binding2]
      } as unknown as VNode<any, HTMLElement>

      // @ts-expect-error Testing directive lifecycle hooks
      vUnoStyle.beforeMount(element, binding1, vnode, null)
      // @ts-expect-error Testing directive lifecycle hooks
      vUnoStyle.beforeMount(element, binding2, vnode, null)

      expect(element.style.cssText).toContain('--c: red')
      expect(element.style.cssText).toContain('--bg: blue')

      // Updating the first binding should not affect the second
      binding1.oldValue = binding1.value
      binding1.value = { c: { sm: 'green' } } as any

      // @ts-expect-error Testing directive lifecycle hooks
      vUnoStyle.updated(element, binding1, vnode, vnode, null)

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

      expect(element.classList.toString()).toContain('vs:md:c-$c-md')

      // @ts-expect-error Testing directive lifecycle hooks
      vUnoStyle.updated(element, { value, oldValue } as never, null as never, null)

      // md now equals sm, so the md breakpoint class and variable must be gone
      expect(element.classList.toString()).toContain('vs:c-$c')
      expect(element.classList.toString()).not.toContain('vs:md:c-$c-md')
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

      expect(link.classes()).toContain('vs:display-$display')
      expect(link.classes()).toContain('vs:md:display-$display-md')

      active.value = true
      await nextTick()

      expect(link.classes()).toContain('router-link-active')
      expect(link.classes()).toContain('vs:display-$display')
      expect(link.classes()).toContain('vs:md:display-$display-md')
    })

    // The actual defect: the generated classes lived only on the DOM node, so the next
    // `el.className = <vnode class>` patch dropped them for good. Vue must own them instead.
    it('writes the generated classes into the anchor own vnode', () => {
      const wrapper = mountLink({ display: { sm: 'inline', md: 'none' } } as any)
      const { __vnode: vnode } = wrapper.get('a').element as any

      expect(vnode.props.class).toContain('vs:display-$display')
      expect(vnode.props.class).toContain('vs:md:display-$display-md')
    })

    it('keeps generated classes through a class rewrite driven from the vnode', async () => {
      const wrapper = mountLink({ display: { sm: 'inline', md: 'none' } } as any)
      const element = wrapper.get('a').element as any

      active.value = true
      await nextTick()

      // exactly what Vue's `patchClass` does on every class change
      element.className = element.__vnode.props.class

      expect(element.className).toContain('router-link-active')
      expect(element.className).toContain('vs:display-$display')
      expect(element.className).toContain('vs:md:display-$display-md')
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
