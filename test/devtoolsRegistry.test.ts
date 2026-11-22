// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref, resolveDirective, withDirectives } from 'vue'
import { createDevtoolsRegistry } from '../src/devtools/registry'
import { createVUnoStyle } from '../src/directive'

const options = {
  breakpoints: { sm: 0, md: '768px', lg: '1024px' },
  properties: ['c', 'bg', 'p']
}

const setup = () => {
  const directive = createVUnoStyle(options)
  const { registry, instrument } = createDevtoolsRegistry(options)
  return { directive, registry, instrumented: instrument(directive) }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 20))

afterEach(() => {
  document.body.innerHTML = ''
})

describe('instrument', () => {
  it('writes the same classes and variables as the plain directive', () => {
    const { directive, instrumented } = setup()
    const render = (dir: typeof directive) => mount(defineComponent({
      render: () => withDirectives(h('p', { class: 'static' }), [[dir, { sm: 'red', md: 'blue' }, 'c']])
    })).element as HTMLElement

    const plain = render(directive)
    const recorded = render(instrumented)

    expect(recorded.className).toBe(plain.className)
    expect(recorded.style.cssText).toBe(plain.style.cssText)
  })

  it('passes server rendering through', () => {
    const { directive, instrumented } = setup()

    expect(instrumented.getSSRProps).toBe(directive.getSSRProps)
  })
})

describe('createDevtoolsRegistry', () => {
  it('records a mounted element with its binding and the DOM result', () => {
    const { registry, instrumented } = setup()
    mount(defineComponent({
      name: 'Card',
      render: () => withDirectives(h('section', { class: 'card' }), [[instrumented, { c: { sm: 'red', md: 'blue' }, p: '1rem' }]])
    }), { attachTo: document.body })

    const [element] = registry.elements()
    expect(registry.elements()).toHaveLength(1)
    expect(element).toEqual(expect.objectContaining({
      tag: 'section',
      label: 'Card › section',
      properties: ['c', 'p'],
      overrides: [],
      warnings: [],
      updates: 0,
      connected: true,
      variables: { '--c': 'red', '--c-md': 'blue', '--p': '1rem' }
    }))
    expect(element!.className).toBe('card o:c-$c o:md:c-$c-md o:p-$p')
    expect(element!.bindings).toEqual([{
      value: { c: { sm: 'red', md: 'blue' }, p: '1rem' },
      classes: 'o:c-$c o:md:c-$c-md o:p-$p',
      style: { '--c': 'red', '--c-md': 'blue', '--p': '1rem' },
      component: { name: 'Card' }
    }])
    expect(registry.events()).toEqual([expect.objectContaining({
      type: 'mount',
      label: 'Card › section',
      changed: ['--c', '--c-md', '--p']
    })])
  })

  it('records real updates and ignores unrelated renders', async () => {
    const { registry, instrumented } = setup()
    const color = ref('red')
    const other = ref(0)
    mount(defineComponent({
      render: () => withDirectives(h('p', { 'data-other': other.value }), [[instrumented, { sm: color.value }, 'c']])
    }))

    other.value++
    await nextTick()
    expect(registry.elements()[0]!.updates).toBe(0)

    color.value = 'blue'
    await nextTick()
    const [element] = registry.elements()
    expect(element!.updates).toBe(1)
    expect(element!.variables).toEqual({ '--c': 'blue' })
    expect(registry.events().at(-1)).toEqual(expect.objectContaining({ type: 'update', changed: ['--c'] }))
  })

  it('times the directive hooks of every binding on an element into one event', () => {
    let clock = 0
    const now = vi.spyOn(performance, 'now').mockImplementation(() => clock)
    const { registry, instrument } = createDevtoolsRegistry(options)
    const slow = (ms: number) => ({ mounted: () => { clock += ms } })
    try {
      const Badge = defineComponent({
        render: () => withDirectives(h('span'), [[instrument(slow(2)), 'white', 'c']])
      })
      mount(defineComponent({
        render: () => withDirectives(h(Badge), [[instrument(slow(3)), 'red', 'bg']])
      }))
    }
    finally {
      now.mockRestore()
    }

    expect(registry.events()).toEqual([expect.objectContaining({ type: 'mount', duration: 5 })])
  })

  it('forgets an unmounted element', async () => {
    const { registry, instrumented } = setup()
    const shown = ref(true)
    mount(defineComponent({
      render: () => h('div', shown.value ? [withDirectives(h('p'), [[instrumented, 'red', 'c']])] : [])
    }))

    shown.value = false
    await nextTick()

    expect(registry.elements()).toEqual([])
    expect(registry.events().map((event) => event.type)).toEqual(['mount', 'unmount'])
  })

  it('shows both bindings of a composed component and what the usage site overrides', () => {
    const { registry, instrumented } = setup()
    const Badge = defineComponent({
      name: 'Badge',
      render: () => withDirectives(h('span'), [[instrumented, { c: 'white', bg: 'black' }]])
    })
    mount(defineComponent({
      name: 'Page',
      render: () => withDirectives(h(Badge), [[instrumented, 'red', 'c']])
    }))

    const [element] = registry.elements()
    expect(element!.bindings.map((binding) => binding.component?.name)).toEqual(['Badge', 'Page'])
    expect(element!.overrides).toEqual(['--c'])
    expect(element!.variables).toEqual({ '--c': 'red', '--bg': 'black' })
    expect(element!.label).toBe('Badge › span')
  })

  it('collects warnings per element', () => {
    const { registry, instrumented } = setup()
    mount(defineComponent({
      render: () => withDirectives(h('p'), [[instrumented, { c: { sm: 'red', xl: 'blue' }, gap: '1rem' }]])
    }))

    expect(registry.warnings().map(({ kind, elementId }) => [kind, elementId])).toEqual([
      ['unknown-breakpoint', 1],
      ['unknown-property', 1]
    ])
  })

  it('tracks the properties used during the session, after unmount too', async () => {
    const { registry, instrumented } = setup()
    const shown = ref(true)
    mount(defineComponent({
      render: () => h('div', shown.value
        ? [withDirectives(h('p'), [[instrumented, { p: '1rem', c: 'red' }]])]
        : [])
    }))
    shown.value = false
    await nextTick()

    expect(registry.seenProperties()).toEqual(['c', 'p'])
  })

  it('notifies subscribers once per batch and drops a listener that throws', async () => {
    const { registry, instrumented } = setup()
    const listener = vi.fn()
    const broken = vi.fn(() => {
      throw new Error('dead iframe')
    })
    registry.subscribe(listener)
    registry.subscribe(broken)

    mount(defineComponent({
      render: () => [
        withDirectives(h('p'), [[instrumented, 'red', 'c']]),
        withDirectives(h('p'), [[instrumented, 'blue', 'c']])
      ]
    }))
    await flush()
    registry.clearEvents()
    await flush()

    expect(listener).toHaveBeenCalledTimes(2)
    expect(broken).toHaveBeenCalledTimes(1)
    expect(registry.events()).toEqual([])
  })

  it('keeps the last 200 events', async () => {
    const { registry, instrumented } = setup()
    const color = ref(0)
    mount(defineComponent({
      render: () => withDirectives(h('p'), [[instrumented, `#${color.value}`, 'c']])
    }))
    for (let index = 1; index <= 250; index++) {
      color.value = index
      await nextTick()
    }

    const events = registry.events()
    expect(events).toHaveLength(200)
    expect(events.at(-1)!.changed).toEqual(['--c'])
    expect(registry.elements()[0]!.updates).toBe(250)
  })

  it('reads the active breakpoint from the window', () => {
    const matching = new Set(['(min-width: 768px)'])
    const view = {
      matchMedia: (query: string) => ({ matches: matching.has(query) }),
      addEventListener: () => {},
      document
    } as unknown as Window
    const { registry } = createDevtoolsRegistry({ ...options, window: view })

    expect(registry.activeBreakpoint()).toBe('md')
    matching.add('(min-width: 1024px)')
    expect(registry.activeBreakpoint()).toBe('lg')
    matching.clear()
    expect(registry.activeBreakpoint()).toBe('sm')

    registry.setBadge(true)
    expect(document.getElementById('vue-uno-style-devtools-badge')?.textContent).toBe('sm (base)')
    expect(registry.badgeVisible()).toBe(true)
    registry.setBadge(false)
    expect(document.getElementById('vue-uno-style-devtools-badge')).toBeNull()
  })

  it('outlines an element on the page and removes the outline', () => {
    const { registry, instrumented } = setup()
    mount(defineComponent({
      render: () => withDirectives(h('p'), [[instrumented, 'red', 'c']])
    }), { attachTo: document.body })

    registry.highlight(1)
    expect(document.getElementById('vue-uno-style-devtools-highlight')).not.toBeNull()
    registry.highlight(null)
    expect(document.getElementById('vue-uno-style-devtools-highlight')).toBeNull()
  })

  it('keeps the outline on its element and drops it when the element leaves the page', async () => {
    const { registry, instrumented } = setup()
    const wrapper = mount(defineComponent({
      render: () => withDirectives(h('p'), [[instrumented, 'red', 'c']])
    }), { attachTo: document.body })
    const el = wrapper.element as HTMLElement
    let top = 10
    el.getBoundingClientRect = () => ({ top, left: 0, width: 100, height: 20 }) as DOMRect

    registry.highlight(1)
    const overlay = () => document.getElementById('vue-uno-style-devtools-highlight')
    expect(overlay()?.style.top).toBe('10px')

    top = 50
    await flush()
    expect(overlay()?.style.top).toBe('50px')

    wrapper.unmount()
    await flush()
    expect(overlay()).toBeNull()
  })

  it('works when registered on an app like the Nuxt plugin does', () => {
    const { registry, instrumented } = setup()
    const wrapper = mount(defineComponent({
      setup: () => () => withDirectives(h('p'), [[resolveDirective('uno-style')!, 'red', 'c']])
    }), { global: { directives: { 'uno-style': instrumented } } })

    expect(wrapper.element.className).toBe('o:c-$c')
    expect(registry.elements()).toHaveLength(1)
  })
})
