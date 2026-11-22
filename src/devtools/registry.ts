import type { BreakpointConfig, ResolvedBreakpoints } from '../core/breakpoints'
import type { StyleValue } from '../core/getStyle'
import type { PropertyConfig, ResolvedProperties } from '../core/properties'
import type { VUnoStyleValue } from '../directive'
import type { ValueWarning } from './inspect'
import type { DirectiveBinding, ObjectDirective, VNode } from 'vue'
import { resolveBreakpoints } from '../core/breakpoints'
import { getStyle } from '../core/getStyle'
import { resolveProperties } from '../core/properties'
import { getDirectiveContext } from '../directive'
import { inspectValue } from './inspect'

export interface DevtoolsComponent {
  name?: string
  file?: string
}

export interface DevtoolsBinding {
  arg?: string
  value: unknown
  classes: string
  style: Record<string, StyleValue>
  /** The component whose template holds this binding. */
  component?: DevtoolsComponent
}

export interface DevtoolsElement {
  id: number
  tag: string
  label: string
  bindings: DevtoolsBinding[]
  /** The element's `class` attribute after the directive wrote it. */
  className: string
  /** The CSS variables on the element's inline style. */
  variables: Record<string, string>
  properties: string[]
  /** Variables more than one binding sets; the last binding wins. */
  overrides: string[]
  warnings: ValueWarning[]
  mountedAt: number
  updatedAt?: number
  updates: number
  connected: boolean
}

export type DevtoolsEventType = 'mount' | 'update' | 'unmount'

export interface DevtoolsEvent {
  id: number
  time: number
  type: DevtoolsEventType
  elementId: number
  label: string
  /** Variables added, changed or removed by this event. */
  changed: string[]
  /**
   * Milliseconds the directive's own hooks took for this event, summed over every binding on
   * the element. The DevTools bookkeeping is not included.
   */
  duration: number
}

export interface DevtoolsElementWarning extends ValueWarning {
  elementId: number
  label: string
}

export interface DevtoolsRegistry {
  readonly breakpoints: {
    values: Record<string, string>
    base: string
    prefixed: string[]
  }
  readonly properties: string[]
  elements: () => DevtoolsElement[]
  events: () => DevtoolsEvent[]
  warnings: () => DevtoolsElementWarning[]
  /** Properties some binding used during this session, in configured order. */
  seenProperties: () => string[]
  /** The breakpoint the app window is in now. */
  activeBreakpoint: () => string
  clearEvents: () => void
  /**
   * Outlines the element on the page; `null` removes the outline. The outline follows the
   * element until it is removed or the element leaves the page.
   */
  highlight: (id: number | null) => void
  scrollTo: (id: number) => void
  /** Shows the active breakpoint in a badge on the page. */
  setBadge: (visible: boolean) => void
  badgeVisible: () => boolean
  /** Calls `listener` after changes, at most once per frame. Returns the unsubscribe function. */
  subscribe: (listener: () => void) => () => void
}

export interface DevtoolsRegistryOptions {
  breakpoints: BreakpointConfig
  baseBreakpoint?: string
  properties?: readonly PropertyConfig[]
  /** The window the app runs in. Defaults to the global `window`. */
  window?: Window
}

type Binding = DirectiveBinding<VUnoStyleValue | null | undefined>
type Directive = ObjectDirective<HTMLElement, VUnoStyleValue>

interface ElementRecord extends Omit<DevtoolsElement, 'connected'> {
  el: HTMLElement
  /** JSON of every binding value, to tell a real update from an unrelated patch. */
  signature: string
}

const MAX_EVENTS = 200
const HIGHLIGHT_ID = 'vue-uno-style-devtools-highlight'
const BADGE_ID = 'vue-uno-style-devtools-badge'

const toCssSize = (value: number | string) => typeof value === 'number' ? `${value}px` : value

const toPixels = (value: string) => {
  const number = Number.parseFloat(value)
  return Number.isNaN(number) ? 0 : number
}

/**
 * Names the component a binding belongs to. `binding.instance` is the component whose template
 * holds the directive, so a usage-site binding and a component's own root binding differ here.
 */
const componentOf = (binding: Binding): DevtoolsComponent | undefined => {
  const type = (binding.instance as { $?: { type?: { __name?: string, name?: string, __file?: string } } } | null)
    ?.$?.type
  if (!type) return undefined

  const name = type.__name ?? type.name ?? type.__file?.split(/[/\\]/).pop()?.replace(/\.vue$/, '')
  return {
    ...(name ? { name } : {}),
    ...(type.__file ? { file: type.__file } : {})
  }
}

const readVariables = (el: HTMLElement): Record<string, string> => {
  const variables: Record<string, string> = {}
  for (let index = 0; index < el.style.length; index++) {
    const name = el.style.item(index)
    if (name.startsWith('--')) variables[name] = el.style.getPropertyValue(name).trim()
  }
  return variables
}

const diffKeys = (before: Record<string, string>, after: Record<string, string>) => {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)])
  return [...keys].filter((key) => before[key] !== after[key])
}

const safeJson = (value: unknown) => {
  try {
    return JSON.stringify(value) ?? ''
  }
  catch {
    return ''
  }
}

/**
 * Records every element carrying the directive, for the Nuxt DevTools tab. Development only:
 * the Nuxt module wires it in `nuxt dev`, never in a production build.
 */
export const createDevtoolsRegistry = (options: DevtoolsRegistryOptions) => {
  const resolved: ResolvedBreakpoints = resolveBreakpoints(options)
  const properties: ResolvedProperties | undefined = options.properties
    ? resolveProperties(options.properties)
    : undefined
  const fallback = { breakpoints: resolved, properties }
  const view = options.window ?? (typeof window === 'undefined' ? undefined : window)

  const values = Object.fromEntries(Object.entries(options.breakpoints)
    .map(([name, value]) => [name, toCssSize(value)]))

  const records = new Map<number, ElementRecord>()
  const byElement = new WeakMap<HTMLElement, ElementRecord>()
  const seen = new Set<string>()
  const listeners = new Set<() => void>()
  let events: DevtoolsEvent[] = []
  let nextId = 1
  let nextEventId = 1
  let scheduled = false
  let badge = false

  const notify = () => {
    if (scheduled) return
    scheduled = true
    const flush = () => {
      scheduled = false
      ;[...listeners].forEach((listener) => {
        try {
          listener()
        }
        catch {
          // A listener from a DevTools iframe that has since reloaded can no longer run
          listeners.delete(listener)
        }
      })
    }
    if (view?.requestAnimationFrame) view.requestAnimationFrame(flush)
    else setTimeout(flush, 0)
  }

  const clock = view?.performance ?? (typeof performance === 'undefined' ? undefined : performance)

  /** Runs a directive hook and returns how long it took, in milliseconds. */
  const measure = (run: () => void) => {
    const start = clock?.now() ?? 0
    run()
    return clock ? clock.now() - start : 0
  }

  /**
   * The event the last hook call recorded. Vue calls the hooks of every binding on a vnode one
   * after another, so the next call on the same element before a microtask passes belongs to
   * that event and adds its duration to it.
   */
  let lastCall: { el: HTMLElement, event: DevtoolsEvent } | undefined

  const addDuration = (el: HTMLElement, duration: number) => {
    if (lastCall?.el !== el) return false
    lastCall.event.duration += duration
    return true
  }

  const record = (type: DevtoolsEventType, entry: ElementRecord, changed: string[], duration: number) => {
    const event: DevtoolsEvent = {
      id: nextEventId++,
      time: Date.now(),
      type,
      elementId: entry.id,
      label: entry.label,
      changed,
      duration
    }
    events = [...events, event].slice(-MAX_EVENTS)
    const call = { el: entry.el, event }
    lastCall = call
    queueMicrotask(() => {
      if (lastCall === call) lastCall = undefined
    })
  }

  const describe = (el: HTMLElement, vnode: VNode | null | undefined, binding: Binding) => {
    const siblings = (vnode?.dirs as Binding[] | null | undefined)
      ?.filter((dir) => getDirectiveContext(dir.dir))
    const bindings = siblings?.length ? siblings : [binding]

    const described = bindings.map((item): DevtoolsBinding => {
      const context = getDirectiveContext(item.dir) ?? fallback
      const { classes, style } = item.value
        ? getStyle(item.value, context.breakpoints, item.arg, context.properties)
        : { classes: '', style: {} }
      const component = componentOf(item)

      return {
        ...(item.arg ? { arg: item.arg } : {}),
        value: item.value,
        classes,
        style,
        ...(component ? { component } : {})
      }
    })

    const usedBy = new Map<string, number>()
    described.forEach(({ style }) => Object.keys(style)
      .forEach((key) => usedBy.set(key, (usedBy.get(key) ?? 0) + 1)))

    const used = new Set<string>()
    const warnings: ValueWarning[] = []
    bindings.forEach((item) => {
      if (!item.value) return
      const context = getDirectiveContext(item.dir) ?? fallback
      const config = item.arg ? { [item.arg]: item.value } : item.value
      if (config && typeof config === 'object') Object.keys(config).forEach((key) => used.add(key))
      warnings.push(...inspectValue(item.value, item.arg, context.breakpoints, context.properties))
    })

    const tag = el.tagName.toLowerCase()
    // Vue lists a component's own root binding first, so the first binding names the element's
    // component even when its usage site adds another
    const owner = described[0]?.component?.name

    return {
      tag,
      label: owner ? `${owner} › ${tag}` : tag,
      bindings: described,
      className: el.getAttribute('class') ?? '',
      variables: readVariables(el),
      properties: [...used],
      overrides: [...usedBy].filter(([, count]) => count > 1).map(([key]) => key),
      warnings,
      signature: safeJson(bindings.map((item) => [item.arg, item.value]))
    }
  }

  const mounted = (el: HTMLElement, binding: Binding, vnode: VNode | null | undefined, duration = 0) => {
    const description = describe(el, vnode, binding)
    description.properties.forEach((property) => seen.add(property))

    const existing = byElement.get(el)
    if (existing) {
      // A second binding on the same element mounts after the first
      Object.assign(existing, description)
      addDuration(el, duration)
      notify()
      return
    }

    const entry: ElementRecord = {
      id: nextId++,
      el,
      ...description,
      mountedAt: Date.now(),
      updates: 0
    }
    records.set(entry.id, entry)
    byElement.set(el, entry)
    record('mount', entry, Object.keys(entry.variables), duration)
    notify()
  }

  const updated = (el: HTMLElement, binding: Binding, vnode: VNode | null | undefined, duration = 0) => {
    const entry = byElement.get(el)
    if (!entry) return mounted(el, binding, vnode, duration)

    const description = describe(el, vnode, binding)
    if (description.signature === entry.signature) {
      // Another binding on the element, after the one that recorded this update
      if (addDuration(el, duration)) notify()
      return
    }

    description.properties.forEach((property) => seen.add(property))
    const changed = diffKeys(entry.variables, description.variables)
    Object.assign(entry, description, { updates: entry.updates + 1, updatedAt: Date.now() })
    record('update', entry, changed, duration)
    notify()
  }

  const unmounted = (el: HTMLElement, duration = 0) => {
    const entry = byElement.get(el)
    if (!entry) {
      // Another binding on the element, after the one that recorded the unmount
      if (addDuration(el, duration)) notify()
      return
    }

    records.delete(entry.id)
    byElement.delete(el)
    record('unmount', entry, Object.keys(entry.variables), duration)
    notify()
  }

  const activeBreakpoint = () => {
    if (!view?.matchMedia) return resolved.base
    const active = [...resolved.prefixed]
      .reverse()
      .find((name) => view.matchMedia(`(min-width: ${values[name]})`).matches)
    return active ?? resolved.base
  }

  const renderBadge = () => {
    const document = view?.document
    if (!document) return
    let element = document.getElementById(BADGE_ID)
    if (!badge) {
      element?.remove()
      return
    }
    if (!element) {
      element = document.createElement('div')
      element.id = BADGE_ID
      Object.assign(element.style, {
        position: 'fixed',
        left: '8px',
        bottom: '8px',
        zIndex: '2147483646',
        padding: '2px 8px',
        borderRadius: '4px',
        font: '600 12px/18px ui-monospace, SFMono-Regular, Menlo, monospace',
        color: '#052e1c',
        background: 'rgba(0, 220, 130, 0.9)',
        pointerEvents: 'none'
      })
      document.body.append(element)
    }
    const name = activeBreakpoint()
    element.textContent = `${name} ${toPixels(values[name] ?? '0') ? `≥ ${values[name]}` : '(base)'}`
  }

  let highlighted: number | null = null
  let tracking = false

  /** Puts the outline over the highlighted element. Returns `false` when there is nothing to outline. */
  const placeHighlight = () => {
    const document = view?.document
    if (!document) return false
    const existing = document.getElementById(HIGHLIGHT_ID)
    const target = highlighted === null ? undefined : records.get(highlighted)?.el
    if (!target?.isConnected) {
      existing?.remove()
      return false
    }
    const box = target.getBoundingClientRect()
    const overlay = existing ?? document.createElement('div')
    overlay.id = HIGHLIGHT_ID
    Object.assign(overlay.style, {
      position: 'fixed',
      top: `${box.top}px`,
      left: `${box.left}px`,
      width: `${box.width}px`,
      height: `${box.height}px`,
      zIndex: '2147483647',
      pointerEvents: 'none',
      outline: '2px solid #00dc82',
      background: 'rgba(0, 220, 130, 0.15)',
      borderRadius: '2px'
    })
    if (!existing) document.body.append(overlay)
    return true
  }

  /**
   * Moves the outline with its element once per frame, so it stays in place while the page
   * scrolls, resizes or lays out again. Stops when the outline goes away.
   */
  const trackHighlight = () => {
    if (tracking || !view?.requestAnimationFrame) return
    tracking = true
    const step = () => {
      if (!placeHighlight()) {
        tracking = false
        return
      }
      view.requestAnimationFrame(step)
    }
    view.requestAnimationFrame(step)
  }

  const onResize = () => {
    renderBadge()
    notify()
  }
  view?.addEventListener?.('resize', onResize)

  const registry: DevtoolsRegistry = {
    breakpoints: { values, base: resolved.base, prefixed: resolved.prefixed },
    properties: properties?.names ?? [],
    elements: () => [...records.values()].map(({ el, signature: _signature, ...rest }) => ({
      ...rest,
      connected: el.isConnected
    })),
    events: () => [...events],
    warnings: () => [...records.values()].flatMap((entry) =>
      entry.warnings.map((warning) => ({ ...warning, elementId: entry.id, label: entry.label }))),
    seenProperties: () => {
      const configured = properties?.names ?? []
      return [
        ...configured.filter((name) => seen.has(name)),
        ...[...seen].filter((name) => !configured.includes(name))
      ]
    },
    activeBreakpoint,
    clearEvents: () => {
      events = []
      notify()
    },
    highlight: (id) => {
      highlighted = id
      if (placeHighlight()) trackHighlight()
    },
    scrollTo: (id) => {
      records.get(id)?.el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    },
    setBadge: (visible) => {
      badge = visible
      renderBadge()
      notify()
    },
    badgeVisible: () => badge,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    }
  }

  /**
   * Returns a copy of `directive` that records each element after the directive has written it.
   * The copy keeps the directive's marker, so bindings still compose as before.
   */
  const instrument = (directive: Directive): Directive => ({
    ...directive,
    mounted: (el, binding, vnode, previous) => {
      const duration = measure(() => directive.mounted?.(el, binding, vnode, previous))
      mounted(el, binding, vnode, duration)
    },
    updated: (el, binding, vnode, previous) => {
      const duration = measure(() => directive.updated?.(el, binding, vnode, previous))
      updated(el, binding, vnode, duration)
    },
    unmounted: (el, binding, vnode, previous) => {
      const duration = measure(() => directive.unmounted?.(el, binding, vnode, previous))
      unmounted(el, duration)
    }
  })

  return { registry, instrument }
}
