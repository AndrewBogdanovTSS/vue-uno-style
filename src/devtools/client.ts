/**
 * The vue-uno-style tab inside Nuxt DevTools. Built on its own to `dist/devtools-client.mjs`
 * and served by the module at `/__vue-uno-style/client.mjs`, so it imports nothing at runtime.
 *
 * Build data comes from the module's JSON API. Live data comes from the registry the dev
 * plugin provides on the app, reached through the client object Nuxt DevTools sets on every
 * custom-tab iframe as `window.__NUXT_DEVTOOLS__`.
 */
import type { DevtoolsElement, DevtoolsRegistry } from './registry'
import type { DevtoolsData, SampleResult } from './server'
import {
  effectiveValue,
  elementFlags,
  escapeHtml as esc,
  formatBytes,
  formatTime,
  formatValue,
  matchesFilter,
  parseReplValue,
  valuesByBreakpoint,
} from './clientUtils'

interface DevtoolsClient {
  host?: {
    nuxt?: { $vUnoStyleDevtools?: DevtoolsRegistry }
    app?: { colorMode?: { value?: string } }
    devtools?: { navigate?: (path: string) => void }
  }
  devtools?: { colorMode?: string }
}

type Tab = 'overview' | 'elements' | 'warnings' | 'timeline' | 'repl'

const TABS: Array<[Tab, string]> = [
  ['overview', 'Overview'],
  ['elements', 'Elements'],
  ['warnings', 'Warnings'],
  ['timeline', 'Timeline'],
  ['repl', 'REPL'],
]

const state: {
  tab: Tab
  data?: DevtoolsData
  dataError?: string
  registry?: DevtoolsRegistry
  selected?: number
  filter: string
  replProperty: string
  replValue: string
  replResult?: SampleResult
} = {
  tab: 'overview',
  filter: '',
  replProperty: '',
  replValue: '',
}

/** Starts the REPL on the app's first property and its own breakpoint names. */
const seedRepl = (data: DevtoolsData) => {
  if (state.replProperty || state.replValue) return
  const [first] = data.properties
  const [second] = data.breakpoints.prefixed
  state.replProperty = first?.name ?? ''
  state.replValue = JSON.stringify({
    [data.breakpoints.base]: first?.format === 'url' ? '/image.png' : '1rem',
    ...(second ? { [second]: first?.format === 'url' ? '/image-wide.png' : '2rem' } : {}),
  })
}

const root = document.getElementById('app')!

const client = (): DevtoolsClient | undefined =>
  (window as unknown as { __NUXT_DEVTOOLS__?: DevtoolsClient }).__NUXT_DEVTOOLS__

const applyColorMode = () => {
  const devtools = client()
  const mode = devtools?.devtools?.colorMode
    ?? devtools?.host?.app?.colorMode?.value
    ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  document.documentElement.classList.toggle('dark', mode === 'dark')
}

const pill = (text: string, kind = '') => `<span class="pill ${kind}">${esc(text)}</span>`

const liveOnly = () => `<div class="empty">Live data needs the app open in Nuxt DevTools.
  Open this tab from the DevTools panel of a page running <code>nuxt dev</code>.</div>`

/* Overview */

const renderWebTypes = (data: DevtoolsData) => {
  const { webTypes } = data
  if (webTypes.status === 'disabled') return `<span class="muted">disabled (<code>webTypes: false</code>)</span>`
  if (webTypes.status === 'failed') {
    return `<span class="error">failed</span>: ${esc(webTypes.error)}<br><code class="muted">${esc(webTypes.file)}</code>`
  }
  return `<span class="ok">${esc(webTypes.status)}</span><br><code class="muted">${esc(webTypes.file)}</code>`
}

const renderOverview = () => {
  const { data, registry } = state
  if (state.dataError) return `<div class="empty error">${esc(state.dataError)}</div>`
  if (!data) return `<p class="muted">Loading…</p>`

  const active = registry?.activeBreakpoint()
  const seen = registry ? new Set(registry.seenProperties()) : undefined
  const unused = seen ? data.properties.filter(({ name }) => !seen.has(name)) : []
  const missing = data.coverage.filter((item) => item.suggestion)
  const order = [data.breakpoints.base, ...data.breakpoints.prefixed]

  return `
  <section class="grid">
    <div class="card"><dl>
      <dt>Package</dt><dd><code>vue-uno-style@${esc(data.version)}</code></dd>
      <dt>Directive</dt><dd><code>v-${esc(data.directiveName)}</code></dd>
      <dt>Preset</dt><dd>${data.preset === 'config' ? 'from the UnoCSS config' : 'added by the module'}</dd>
      <dt>UnoCSS config</dt><dd>${data.configSources.length
        ? data.configSources.map((source) => `<code>${esc(source)}</code>`).join('<br>')
        : '<span class="muted">inline options only</span>'}</dd>
      <dt>Web-types</dt><dd>${renderWebTypes(data)}</dd>
    </dl></div>
    <div class="card"><dl>
      <dt>Rule coverage</dt><dd>${missing.length
        ? `<span class="error">${missing.length} of ${data.coverage.length} properties have no rule</span>`
        : `<span class="ok">all ${data.coverage.length} properties generate CSS</span>`}</dd>
      <dt>Safelist</dt><dd>${data.safelist.classes} classes, ${formatBytes(data.safelist.bytes)}</dd>
      <dt>Used this session</dt><dd>${seen
        ? `${data.properties.length - unused.length} of ${data.properties.length} properties`
        : '<span class="muted">needs DevTools</span>'}</dd>
      <dt>Elements now</dt><dd>${registry ? registry.elements().length : '<span class="muted">needs DevTools</span>'}</dd>
      <dt>UnoCSS</dt><dd><a href="/__unocss/" data-action="unocss" target="_blank" rel="noopener">Open the UnoCSS inspector</a></dd>
    </dl></div>
  </section>

  <section>
    <h2>Breakpoints</h2>
    <p class="muted">From ${data.breakpoints.source === 'option'
      ? 'the <code>breakpoints</code> option'
      : 'the UnoCSS theme'}. Base: <code>${esc(data.breakpoints.base)}</code>.</p>
    <table><thead><tr><th>Name</th><th>Min width</th><th>Role</th><th>Class prefix</th><th></th></tr></thead><tbody>
    ${order.map((name) => `<tr>
      <td><code>${esc(name)}</code></td>
      <td><code>${esc(data.breakpoints.values[name])}</code></td>
      <td>${name === data.breakpoints.base ? 'base, no media query' : 'media query'}</td>
      <td><code>${name === data.breakpoints.base ? 'o:' : `o:${esc(name)}:`}</code></td>
      <td>${name === active ? pill('active now', 'active') : ''}</td>
    </tr>`).join('')}
    </tbody></table>
    ${registry ? `<p><label><input type="checkbox" data-action="badge" ${registry.badgeVisible() ? 'checked' : ''}>
      Show the active breakpoint on the page</label></p>` : ''}
  </section>

  <section>
    <h2>Properties</h2>
    <table><thead><tr><th>Property</th><th>Format</th><th>Rule</th><th>CSS</th><th>Used</th></tr></thead><tbody>
    ${data.coverage.map((item) => {
      const matched = item.tokens.filter((token) => token.matched).length
      const rule = matched === item.tokens.length
        ? pill('ok', 'ok')
        : matched === 0 ? pill('no rule', 'error') : pill(`${matched}/${item.tokens.length} tokens`, 'warn')
      const used = !seen ? '<span class="muted">–</span>' : seen.has(item.property) ? pill('yes', 'ok') : pill('not yet')
      return `<tr>
        <td><code>${esc(item.property)}</code></td>
        <td>${item.format ? `<code>${esc(item.format)}</code>` : '<span class="muted">–</span>'}</td>
        <td>${rule}${matched < item.tokens.length
          ? `<div class="tokens">${item.tokens.filter((token) => !token.matched)
            .map((token) => `<code class="error">${esc(token.token)}</code>`).join(' ')}</div>`
          : ''}</td>
        <td>${formatBytes(item.bytes)}</td>
        <td>${used}</td>
      </tr>`
    }).join('')}
    </tbody></table>
  </section>

  ${missing.length ? `<section>
    <h2>Missing rules</h2>
    <p>These properties are safelisted but no UnoCSS rule matches <code>&lt;prefix&gt;-$&lt;variable&gt;</code>,
    so every class the directive writes for them has no CSS. Add a rule to <code>uno.config.ts</code>, with the
    CSS property in place of <code>&lt;css-property&gt;</code>:</p>
    ${missing.map((item) => `<p><code>${esc(item.property)}</code></p><pre>rules: [\n  ${esc(item.suggestion)},\n]</pre>`).join('')}
  </section>` : ''}

  ${unused.length ? `<section>
    <h2>Not used this session</h2>
    <p class="muted">Configured and safelisted, but no directive on the pages visited so far set them.
    If no page ever does, removing them shrinks the safelist.</p>
    <div class="tokens">${unused.map(({ name }) => `<code>${esc(name)}</code>`).join(' ')}</div>
  </section>` : ''}`
}

/* Elements */

const renderElementRow = (element: DevtoolsElement) => {
  const flags = elementFlags(element)
  const badges = [
    element.warnings.length ? pill(`${element.warnings.length} warning${element.warnings.length > 1 ? 's' : ''}`, 'warn') : '',
    element.bindings.length > 1 ? pill(`${element.bindings.length} bindings`) : '',
    flags.churn ? pill(`${element.updates} updates`, 'error') : flags.unchanged ? pill('never updated') : pill(`${element.updates} updates`),
    element.connected ? '' : pill('detached'),
  ].join(' ')

  return `<button type="button" data-action="select" data-id="${element.id}" aria-selected="${state.selected === element.id}">
    <span><code>${esc(element.label)}</code><br><span class="muted mono">${esc(element.properties.join(', '))}</span></span>
    <span>${badges}</span>
  </button>`
}

const renderElementDetail = (element: DevtoolsElement, registry: DevtoolsRegistry) => {
  const { base, prefixed } = registry.breakpoints
  const order = [base, ...prefixed]
  const active = registry.activeBreakpoint()
  const table = valuesByBreakpoint(element.properties, element.variables, base, prefixed)
  const flags = elementFlags(element)

  return `
  <div class="toolbar">
    <strong><code>${esc(element.label)}</code></strong>
    <button type="button" class="action" data-action="scroll" data-id="${element.id}">Scroll to</button>
  </div>

  ${flags.unchanged ? `<p class="muted">Never updated since it mounted. If the value never changes at runtime, plain
    UnoCSS classes would do the same without the directive.</p>` : ''}
  ${flags.churn ? `<p class="error">Updated ${element.updates} times. Check whether the binding value is rebuilt on every render.</p>` : ''}

  <section>
    <h2>Values per breakpoint</h2>
    <p class="muted">The CSS variables on the element. A dash means the breakpoint inherits the value to its left.</p>
    <table><thead><tr><th>Property</th>${order.map((name) =>
      `<th>${name === active ? pill(name, 'active') : esc(name)}</th>`).join('')}<th>Now</th></tr></thead><tbody>
    ${Object.entries(table).map(([property, values]) => `<tr>
      <td><code>${esc(property)}</code></td>
      ${order.map((name) => `<td>${values[name] === undefined ? '<span class="muted">–</span>' : `<code>${esc(formatValue(values[name]))}</code>`}</td>`).join('')}
      <td><code>${esc(formatValue(effectiveValue(values, order, active) ?? '–'))}</code></td>
    </tr>`).join('')}
    </tbody></table>
  </section>

  ${element.warnings.length ? `<section>
    <h2>Warnings</h2>
    ${element.warnings.map((warning) => `<p>${pill(warning.kind, 'warn')} ${esc(warning.message)}</p>`).join('')}
  </section>` : ''}

  <section>
    <h2>Bindings</h2>
    ${element.overrides.length ? `<p>The later binding overrides ${element.overrides.map((key) => `<code>${esc(key)}</code>`).join(', ')}.</p>` : ''}
    ${element.bindings.map((binding, index) => `<div class="card" style="margin-bottom:8px"><dl>
      <dt>#${index + 1}</dt><dd><code>v-${esc(state.data?.directiveName ?? 'uno-style')}${binding.arg ? `:${esc(binding.arg)}` : ''}</code></dd>
      <dt>Component</dt><dd>${binding.component
        ? `<code>${esc(binding.component.name ?? 'anonymous')}</code>${binding.component.file
          ? ` <button type="button" class="action" data-action="copy" data-text="${esc(binding.component.file)}">Copy path</button><br><span class="muted mono">${esc(binding.component.file)}</span>`
          : ''}`
        : '<span class="muted">unknown</span>'}</dd>
      <dt>Value</dt><dd><pre>${esc(JSON.stringify(binding.value, null, 2))}</pre></dd>
      <dt>Classes</dt><dd><div class="tokens">${binding.classes.split(' ').filter(Boolean)
        .map((name) => `<code>${esc(name)}</code>`).join(' ') || '<span class="muted">none</span>'}</div></dd>
      <dt>Variables</dt><dd>${Object.entries(binding.style)
        .map(([key, value]) => `<code>${esc(key)}: ${esc(value)}</code>`).join('<br>') || '<span class="muted">none</span>'}</dd>
    </dl></div>`).join('')}
  </section>

  <section>
    <h2>On the element</h2>
    <p class="muted">Read from the DOM after the directive wrote it.</p>
    <pre>class="${esc(element.className)}"</pre>
    <pre style="margin-top:8px">${Object.entries(element.variables)
      .map(([key, value]) => `${esc(key)}: ${esc(value)};`).join('\n') || 'no CSS variables'}</pre>
  </section>`
}

const renderElements = () => {
  const { registry } = state
  if (!registry) return liveOnly()

  const elements = registry.elements()
  const visible = elements.filter((element) => matchesFilter(element, state.filter))
  const selected = elements.find((element) => element.id === state.selected)

  return `
  <div class="toolbar">
    <input type="search" placeholder="Filter by component, tag, property or class" value="${esc(state.filter)}" data-input="filter" size="40">
    <span class="muted">${visible.length} of ${elements.length} elements · active breakpoint ${pill(registry.activeBreakpoint(), 'active')}</span>
  </div>
  ${elements.length ? `<div class="split">
    <div class="list" data-list="elements">${visible.map(renderElementRow).join('') || '<p class="muted" style="padding:8px">No match.</p>'}</div>
    <div>${selected ? renderElementDetail(selected, registry) : '<div class="empty">Select an element. Hover one to outline it on the page.</div>'}</div>
  </div>` : '<div class="empty">No element on this page carries the directive.</div>'}`
}

/* Warnings */

const renderWarnings = () => {
  const { registry } = state
  if (!registry) return liveOnly()
  const warnings = registry.warnings()
  if (!warnings.length) return '<div class="empty">No warnings on this page.</div>'

  return `<table><thead><tr><th>Element</th><th>Kind</th><th>Message</th></tr></thead><tbody>
    ${warnings.map((warning) => `<tr>
      <td><button type="button" class="action" data-action="open-element" data-id="${warning.elementId}">${esc(warning.label)}</button></td>
      <td>${pill(warning.kind, 'warn')}</td>
      <td>${esc(warning.message)}</td>
    </tr>`).join('')}
  </tbody></table>`
}

/* Timeline */

const renderTimeline = () => {
  const { registry } = state
  if (!registry) return liveOnly()
  const events = registry.events().reverse()

  return `
  <div class="toolbar">
    <button type="button" class="action" data-action="clear-events">Clear</button>
    <span class="muted">Last ${events.length} directive events, newest first. Kept for the last 200.</span>
  </div>
  ${events.length ? `<table><thead><tr><th>Time</th><th>Event</th><th>Element</th><th>Variables</th></tr></thead><tbody>
    ${events.map((event) => `<tr>
      <td class="mono">${formatTime(event.time)}</td>
      <td>${pill(event.type, event.type === 'update' ? 'active' : event.type === 'unmount' ? '' : 'ok')}</td>
      <td>${event.type === 'unmount'
        ? `<code>${esc(event.label)}</code>`
        : `<button type="button" class="action" data-action="open-element" data-id="${event.elementId}">${esc(event.label)}</button>`}</td>
      <td class="mono">${event.changed.map(esc).join(', ') || '<span class="muted">–</span>'}</td>
    </tr>`).join('')}
  </tbody></table>` : '<div class="empty">No events yet.</div>'}`
}

/* REPL */

const renderReplResult = () => {
  const result = state.replResult
  if (!result) return ''
  if ('error' in result) return `<p class="error">${esc(result.error)}</p>`

  return `
  ${result.warnings.length ? `<section>${result.warnings.map((warning) =>
    `<p>${pill(warning.kind, 'warn')} ${esc(warning.message)}</p>`).join('')}</section>` : ''}
  <section>
    <h2>Classes</h2>
    <div class="tokens">${result.classes.split(' ').filter(Boolean).map((name) => `<code>${esc(name)}</code>`).join(' ') || '<span class="muted">none</span>'}</div>
  </section>
  <section>
    <h2>Variables</h2>
    <pre>${Object.entries(result.style).map(([key, value]) => `${esc(key)}: ${esc(value)};`).join('\n') || 'none'}</pre>
  </section>
  <section>
    <h2>CSS</h2>
    <pre>${esc(result.css) || '<span class="error">No CSS. Check the property has a UnoCSS rule.</span>'}</pre>
  </section>`
}

const renderRepl = () => `
  <p class="muted">Runs a value through the directive's <code>getStyle()</code> and the app's UnoCSS generator.
  Leave the property empty to pass an object of properties.</p>
  <div class="toolbar">
    <label>Property <input type="text" list="repl-properties" data-input="repl-property" value="${esc(state.replProperty)}" placeholder="e.g. c" size="10"></label>
    <datalist id="repl-properties">${(state.data?.properties ?? []).map(({ name }) => `<option value="${esc(name)}">`).join('')}</datalist>
    <button type="button" class="action" data-action="repl-run">Generate</button>
    <span class="muted">Ctrl+Enter in the value runs it too.</span>
  </div>
  <textarea data-input="repl-value" spellcheck="false">${esc(state.replValue)}</textarea>
  <div data-region="repl-result">${renderReplResult()}</div>`

/* Shell */

const renderBody = () => {
  switch (state.tab) {
    case 'elements': return renderElements()
    case 'warnings': return renderWarnings()
    case 'timeline': return renderTimeline()
    case 'repl': return renderRepl()
    default: return renderOverview()
  }
}

const renderNav = () => {
  const warnings = state.registry?.warnings().length ?? 0
  const elements = state.registry?.elements().length
  return TABS.map(([tab, title]) => {
    const count = tab === 'warnings' && warnings
      ? `<span class="count alert">${warnings}</span>`
      : tab === 'elements' && elements !== undefined ? `<span class="count">${elements}</span>` : ''
    return `<button type="button" data-action="tab" data-tab="${tab}" aria-current="${state.tab === tab ? 'page' : 'false'}">${title}${count}</button>`
  }).join('')
}

const render = () => {
  applyColorMode()
  const main = root.querySelector('main')
  const scroll = main?.scrollTop ?? 0
  const listScroll = root.querySelector('[data-list="elements"]')?.scrollTop ?? 0
  const focused = document.activeElement as HTMLInputElement | null
  const focusKey = focused?.dataset?.input
  const selection = focusKey ? [focused!.selectionStart, focused!.selectionEnd] as const : undefined

  root.innerHTML = `
  <header>
    <h1>vue-uno-style</h1>
    <nav>${renderNav()}</nav>
    <span class="meta">${state.registry ? `breakpoint ${pill(state.registry.activeBreakpoint(), 'active')}` : 'build data only'}</span>
  </header>
  <main>${renderBody()}</main>`

  const nextMain = root.querySelector('main')
  if (nextMain) nextMain.scrollTop = scroll
  const list = root.querySelector('[data-list="elements"]')
  if (list) list.scrollTop = listScroll
  if (focusKey) {
    const input = root.querySelector<HTMLInputElement>(`[data-input="${focusKey}"]`)
    input?.focus()
    if (input && selection) input.setSelectionRange(selection[0], selection[1])
  }
}

/** Re-renders after live changes, except in the REPL, whose inputs must keep their state. */
const refresh = () => {
  if (state.tab === 'repl') return
  render()
}

const runRepl = async () => {
  try {
    const response = await fetch('./api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ property: state.replProperty, value: parseReplValue(state.replValue) }),
    })
    state.replResult = await response.json() as SampleResult
  }
  catch (error) {
    state.replResult = { error: error instanceof Error ? error.message : String(error) }
  }
  const region = root.querySelector('[data-region="repl-result"]')
  if (region) region.innerHTML = renderReplResult()
}

let replTimer: ReturnType<typeof setTimeout> | undefined
const scheduleRepl = () => {
  clearTimeout(replTimer)
  replTimer = setTimeout(() => void runRepl(), 300)
}

const openUnoCss = () => {
  const navigate = client()?.host?.devtools?.navigate
  if (!navigate) return false
  navigate('/modules/custom-unocss')
  return true
}

root.addEventListener('click', (event) => {
  const target = (event.target as HTMLElement).closest<HTMLElement>('[data-action]')
  if (!target) return
  const id = Number(target.dataset.id)

  switch (target.dataset.action) {
    case 'tab':
      state.tab = target.dataset.tab as Tab
      render()
      if (state.tab === 'repl' && !state.replResult) void runRepl()
      break
    case 'select':
      state.selected = id
      render()
      break
    case 'open-element':
      state.tab = 'elements'
      state.selected = id
      state.filter = ''
      render()
      break
    case 'scroll':
      state.registry?.scrollTo(id)
      break
    case 'clear-events':
      state.registry?.clearEvents()
      break
    case 'copy':
      void navigator.clipboard?.writeText(target.dataset.text ?? '')
      break
    case 'repl-run':
      void runRepl()
      break
    case 'unocss':
      if (openUnoCss()) event.preventDefault()
      break
  }
})

root.addEventListener('change', (event) => {
  const target = event.target as HTMLInputElement
  if (target.dataset.action === 'badge') state.registry?.setBadge(target.checked)
})

root.addEventListener('input', (event) => {
  const target = event.target as HTMLInputElement | HTMLTextAreaElement
  switch (target.dataset.input) {
    case 'filter':
      state.filter = target.value
      render()
      break
    case 'repl-property':
      state.replProperty = target.value
      scheduleRepl()
      break
    case 'repl-value':
      state.replValue = target.value
      scheduleRepl()
      break
  }
})

root.addEventListener('keydown', (event) => {
  const target = event.target as HTMLElement
  if (target.dataset.input === 'repl-value' && event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault()
    void runRepl()
  }
})

root.addEventListener('mouseover', (event) => {
  const row = (event.target as HTMLElement).closest<HTMLElement>('[data-action="select"]')
  if (row) state.registry?.highlight(Number(row.dataset.id))
})

root.addEventListener('mouseout', (event) => {
  const row = (event.target as HTMLElement).closest<HTMLElement>('[data-action="select"]')
  const next = (event as MouseEvent).relatedTarget as HTMLElement | null
  if (row && !row.contains(next)) state.registry?.highlight(null)
})

/** DevTools sets the client after the iframe loads, so look for the registry until it appears. */
const connect = () => {
  const registry = client()?.host?.nuxt?.$vUnoStyleDevtools
  if (!registry) return false
  state.registry = registry
  const unsubscribe = registry.subscribe(refresh)
  window.addEventListener('pagehide', () => {
    unsubscribe()
    registry.highlight(null)
  })
  render()
  return true
}

const loadData = async () => {
  try {
    const response = await fetch('./api/data')
    if (!response.ok) throw new Error(`The module's API answered ${response.status}.`)
    state.data = await response.json() as DevtoolsData
    seedRepl(state.data)
  }
  catch (error) {
    state.dataError = `Could not load the build data: ${error instanceof Error ? error.message : String(error)}`
  }
  render()
}

render()
void loadData()
if (!connect()) {
  let attempts = 0
  const timer = setInterval(() => {
    if (connect() || ++attempts > 50) clearInterval(timer)
  }, 200)
}
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', render)
