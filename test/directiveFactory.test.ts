// @vitest-environment jsdom

import type { VNode } from 'vue'
import { describe, expect, it } from 'vitest'
import { createVUnoStyle } from '../src/directive'

const createVNode = (props: any = {}): VNode<any, HTMLElement> => (
  { props } as unknown as VNode<any, HTMLElement>
)

describe('createVUnoStyle', () => {
  it('creates a directive using consumer-provided breakpoints', () => {
    const directive = createVUnoStyle({
      breakpoints: { mobile: 0, desktop: '64rem' }
    })
    const element = document.createElement('div')

    directive.beforeMount!(
      element,
      {
        arg: 'c',
        value: { mobile: 'red', desktop: 'blue' }
      } as never,
      null as never,
      null
    )

    expect(element.className).toBe('o:c-$c o:desktop:c-$c-desktop')
    expect(element.style.getPropertyValue('--c')).toBe('red')
    expect(element.style.getPropertyValue('--c-desktop')).toBe('blue')
  })

  it.each(['created', 'beforeUpdate'] as const)(
    '%s injects consumer breakpoints into the vnode props',
    (hook) => {
      const directive = createVUnoStyle({
        breakpoints: { mobile: 0, desktop: '64rem' }
      })
      const element = document.createElement('div')
      const node = createVNode({ class: 'existing' })

      directive[hook]!(element, { arg: 'c', value: { mobile: 'red', desktop: 'blue' } } as never, node, null as never)

      expect(node.props!.class).toContain('existing')
      expect(node.props!.class).toContain('o:c-$c')
      expect(node.props!.class).toContain('o:desktop:c-$c-desktop')
      expect(node.props!.style).toEqual({ '--c': 'red', '--c-desktop': 'blue' })
    }
  )

  it('renders SSR props from consumer breakpoints', () => {
    const directive = createVUnoStyle({
      breakpoints: { mobile: 0, desktop: '64rem' }
    })

    const props = directive.getSSRProps!(
      { arg: 'c', value: { mobile: 'red', desktop: 'blue' } } as never,
      null as never
    )

    expect(props!.class).toBe('o:c-$c o:desktop:c-$c-desktop')
    expect(props!.style).toEqual({ '--c': 'red', '--c-desktop': 'blue' })
  })

  /**
   * A stock UnoCSS theme has no zero-valued breakpoint - its `sm` is a real
   * media query at 640px. Treating it as the base would emit ungated CSS for a
   * breakpoint that should be gated, so the base has to be named explicitly.
   */
  describe('stock UnoCSS theme', () => {
    const stock = { sm: '640px', md: '768px', lg: '1024px' }

    it('refuses to guess a base breakpoint at construction time', () => {
      expect(() => createVUnoStyle({ breakpoints: stock }))
        .toThrow(/Unable to resolve a base breakpoint/)
    })

    it('rejects a base breakpoint that is not configured', () => {
      expect(() => createVUnoStyle({ breakpoints: stock, baseBreakpoint: 'xs' }))
        .toThrow(/does not exist in the configured breakpoints/)
    })

    it('leaves the named base unprefixed and gates every other breakpoint', () => {
      const directive = createVUnoStyle({ breakpoints: stock, baseBreakpoint: 'sm' })
      const element = document.createElement('div')

      directive.beforeMount!(
        element,
        { arg: 'c', value: { sm: 'red', md: 'green', lg: 'blue' } } as never,
        null as never,
        null
      )

      expect(element.className).toBe('o:c-$c o:md:c-$c-md o:lg:c-$c-lg')
      expect(element.style.getPropertyValue('--c')).toBe('red')
      expect(element.style.getPropertyValue('--c-md')).toBe('green')
      expect(element.style.getPropertyValue('--c-lg')).toBe('blue')
    })
  })

  /**
   * A single-root component's own directive and the one applied at its usage site
   * share one vnode (`vnode.dirs`). Bindings from different factories are
   * recognised as siblings too, and each is resolved with its own factory's
   * breakpoints, so every hook writes the same combined result.
   */
  it('composes bindings from separate factories on one vnode, each with its own breakpoints', () => {
    const canvasLike = createVUnoStyle({ breakpoints: { sm: 0, md: 768 } })
    const custom = createVUnoStyle({ breakpoints: { mobile: 0, desktop: '64rem' } })
    const first = { dir: canvasLike, arg: 'c', value: { sm: 'red', md: 'green' } }
    const second = { dir: custom, arg: 'bg', value: { mobile: 'blue', desktop: 'navy' } }
    const node = { props: { class: 'existing' }, dirs: [first, second] } as unknown as VNode<any, HTMLElement>
    const element = document.createElement('div')

    canvasLike.created!(element, first as never, node, null as never)
    custom.created!(element, second as never, node, null as never)

    expect(node.props!.class).toBe('existing o:c-$c o:md:c-$c-md o:bg-$bg o:desktop:bg-$bg-desktop')
    expect(node.props!.style).toEqual({
      '--c': 'red',
      '--c-md': 'green',
      '--bg': 'blue',
      '--bg-desktop': 'navy'
    })

    canvasLike.beforeMount!(element, first as never, node, null)
    custom.beforeMount!(element, second as never, node, null)

    expect(element.className).toBe('o:c-$c o:md:c-$c-md o:bg-$bg o:desktop:bg-$bg-desktop')
  })

  it('ignores directives that were not built by the factory when combining siblings', () => {
    const directive = createVUnoStyle({ breakpoints: { sm: 0, md: 768 } })
    const binding = { dir: directive, arg: 'c', value: { sm: 'red' } }
    const foreign = { dir: { mounted: () => {} }, arg: 'bg', value: { sm: 'blue' } }
    const node = { props: {}, dirs: [foreign, binding] } as unknown as VNode<any, HTMLElement>
    const element = document.createElement('div')

    directive.created!(element, binding as never, node, null as never)

    expect(node.props!.class).toBe('o:c-$c')
    expect(node.props!.style).toEqual({ '--c': 'red' })
  })

  it('stays idempotent when one factory injects into the same vnode twice', () => {
    const directive = createVUnoStyle({ breakpoints: { mobile: 0, desktop: '64rem' } })
    const node = createVNode({ class: 'existing' })
    const element = document.createElement('div')
    const binding = { arg: 'c', value: { mobile: 'red' } } as never

    directive.created!(element, binding, node, null as never)
    directive.beforeUpdate!(element, binding, node, null as never)

    expect(node.props!.class).toBe('existing o:c-$c')
  })
})
