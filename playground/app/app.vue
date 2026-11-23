<script setup lang="ts">
import { breakpoints } from '~~/config/vue-uno-style.ts'

const THEME_KEY = 'vue-uno-style-theme'
const REPOSITORY = 'https://github.com/AndrewBogdanovTSS/vue-uno-style'

useHead({
  title: 'vue-uno-style playground',
  link: [
    { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
    { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
    { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Outfit:wght@500&display=swap' }
  ],
  // Applies a saved theme before the first paint, so the page doesn't flash the system theme.
  script: [{ innerHTML: `try{var t=localStorage.getItem('${THEME_KEY}');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}` }]
})

// The theme follows the system until the toggle picks one, saved per browser.
const theme = ref<'light' | 'dark'>()
const toggleTheme = () => {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
  document.documentElement.dataset.theme = theme.value
  try {
    localStorage.setItem(THEME_KEY, theme.value)
  }
  catch {
    // Storage can be blocked; the theme still applies to this visit.
  }
}

const installCommand = 'pnpm add vue-uno-style'
const copied = ref(false)
const copyInstall = async () => {
  await navigator.clipboard.writeText(installCommand)
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}

// The breakpoint the window is in now, so the responsive demos can be read against it.
const breakpoint = ref<string>()
const queries = Object.entries(breakpoints)
  .filter(([, value]) => Number.parseFloat(value) > 0)
  .map(([name, value]) => [name, `(min-width: ${value})`] as const)
  .reverse()
const updateBreakpoint = () => {
  breakpoint.value = queries.find(([, query]) => matchMedia(query).matches)?.[0] ?? 'sm'
}
onMounted(() => {
  const picked = document.documentElement.dataset.theme
  theme.value = picked === 'light' || picked === 'dark' ? picked : matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  updateBreakpoint()
  window.addEventListener('resize', updateBreakpoint)
})
onBeforeUnmount(() => window.removeEventListener('resize', updateBreakpoint))

// Public files live under the app's base URL, which is `/<repository>/` on GitHub Pages.
const base = useRuntimeConfig().app.baseURL

/* 1. Responsive values: an editable value per breakpoint. */
const editor = reactive({
  c: { sm: '#1e1b4b', md: '#ffffff', lg: '#052e16' },
  bg: { sm: '#c7d2fe', md: '#4f46e5', lg: '#86efac' },
  p: { sm: '1rem', md: '2rem', lg: '3rem' }
})
// A fresh object per edit: the directive compares each new value with the previous one.
const editorStyles = computed(() => JSON.parse(JSON.stringify(editor)) as typeof editor)
const paddings = ['0.5rem', '1rem', '2rem', '3rem']

/* 2. Argument and object forms. */
const accent = { sm: '#7c3aed', md: '#0891b2' }
const toolbar = { c: { sm: '#7c3aed', md: '#0891b2' }, gap: { sm: '0.5rem', md: '1.5rem' } }

/* 3. Scalars and repeated values. */
const width = { sm: '100%', md: '100%', lg: '50%' }

/* 4. Value formats. */
const pattern = computed(() => ({
  bg: { sm: '#4f46e5', md: '#0f766e' },
  bgi: { sm: `${base}dots.svg`, md: `${base}grid.svg` }
}))

/* 5. Updates: a second palette drives the directive's update path. */
const palettes = {
  indigo: {
    label: 'Indigo',
    c: { sm: '#0f172a', md: '#ffffff' },
    bgv: { sm: 'linear-gradient(135deg, #e0e7ff, #f5f3ff)', md: 'linear-gradient(135deg, #4338ca, #7c3aed)' },
    p: { sm: '1.5rem', md: '3rem' }
  },
  amber: {
    label: 'Amber',
    c: { sm: '#451a03', md: '#fffbeb' },
    bgv: { sm: 'linear-gradient(135deg, #fef3c7, #fffbeb)', md: 'linear-gradient(135deg, #b45309, #f59e0b)' },
    // No `md` padding: switching here has to remove `--p-md` and its class.
    p: { sm: '2.25rem' }
  }
}
const active = ref<keyof typeof palettes>('indigo')
const palette = computed(() => {
  const { c, bgv, p } = palettes[active.value]
  return { c, bgv, p }
})

const card = ref<HTMLElement>()
const written = ref<string[]>([])
const removed = ref<string[]>([])
// Reads what is on the element, so the list shows the DOM rather than what should be there.
const readCard = () => {
  const el = card.value
  if (!el) return []
  const classes = [...el.classList].filter((name) => name.startsWith('vs:'))
  const variables = Array.from({ length: el.style.length }, (_, i) => el.style.item(i))
    .filter((name) => name.startsWith('--'))
  return [...classes, ...variables]
}
onMounted(() => (written.value = readCard()))
const switchPalette = async () => {
  const before = readCard()
  active.value = active.value === 'indigo' ? 'amber' : 'indigo'
  await nextTick()
  written.value = readCard()
  removed.value = before.filter((name) => !written.value.includes(name))
}

/* 6. Components compose. */
const highlighted = ref(true)
const highlight = computed(() => highlighted.value
  ? { c: { sm: '#ffffff' }, bg: { sm: '#16a34a', md: '#2563eb' } }
  : undefined)

/* 7. Runtime values win over utilities. */
const override = { sm: '#16a34a', md: '#2563eb' }
</script>

<template>
  <header class="topbar">
    <!-- `mt` is left out of the configured properties on purpose, so the DevTools Warnings tab has an entry to show -->
    <div class="container topbar-inner" v-uno-style:mt="'1rem'">
      <span class="brand"><span class="brand-mark" aria-hidden="true" /> vue-uno-style</span>
      <span class="breakpoint" :class="{ hidden: !breakpoint }" aria-live="polite">
        Breakpoint <strong>{{ breakpoint ?? 'sm' }}</strong>
      </span>
      <nav class="links">
        <a :href="`${REPOSITORY}#readme`">Docs</a>
        <a :href="REPOSITORY">GitHub</a>
      </nav>
      <button
        type="button"
        class="theme-toggle"
        :aria-label="theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'"
        @click="toggleTheme"
      >
        <!-- Shown once mounted: the server can't know the saved or system theme. -->
        <span v-if="theme" aria-hidden="true">{{ theme === 'dark' ? '☀' : '☾' }}</span>
      </button>
    </div>
  </header>

  <div class="container">
    <section class="hero">
      <span class="pill">Vue · Nuxt · UnoCSS</span>
      <h1>Responsive styles from <br><span class="accent">runtime data</span></h1>
      <p>A directive that turns API or CMS values into CSS variables and UnoCSS classes, one value per breakpoint, with the CSS generated at build time.</p>
      <div class="actions">
        <a class="button primary" :href="`${REPOSITORY}#install`">Get started →</a>
        <button type="button" class="button subtle mono" :aria-label="`Copy ${installCommand}`" @click="copyInstall">
          {{ installCommand }}
          <span v-if="copied" class="accent" aria-hidden="true">✓</span>
        </button>
      </div>
    </section>

    <main class="sections">
      <section>
        <h2>One value per breakpoint</h2>
        <p>Each breakpoint gets its own value. The directive writes a CSS variable and a class per breakpoint, and the class applies the variable inside that breakpoint's media query. Edit the values, then resize the window across 768px and 1024px.</p>
        <div class="editor">
          <div
            data-playground-responsive
            class="preview"
            v-uno-style="editorStyles"
          >
            <strong>Responsive card</strong>
            <span>Text, background and padding follow the breakpoint.</span>
          </div>
          <table class="controls">
            <thead>
              <tr><th /><th v-for="name in Object.keys(breakpoints)" :key="name">{{ name }}</th></tr>
            </thead>
            <tbody>
              <tr>
                <th>c</th>
                <td v-for="name in Object.keys(editor.c)" :key="name">
                  <input v-model="editor.c[name as keyof typeof editor.c]" type="color" :aria-label="`Text color at ${name}`">
                </td>
              </tr>
              <tr>
                <th>bg</th>
                <td v-for="name in Object.keys(editor.bg)" :key="name">
                  <input v-model="editor.bg[name as keyof typeof editor.bg]" type="color" :aria-label="`Background at ${name}`">
                </td>
              </tr>
              <tr>
                <th>p</th>
                <td v-for="name in Object.keys(editor.p)" :key="name">
                  <select v-model="editor.p[name as keyof typeof editor.p]" :aria-label="`Padding at ${name}`">
                    <option v-for="size in paddings" :key="size">{{ size }}</option>
                  </select>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <GeneratedOutput :value="editorStyles" />
        <pre><code>&lt;div v-uno-style="{ c: { sm: '#1e1b4b', md: '#ffffff' }, bg: ..., p: ... }" /&gt;</code></pre>
      </section>

      <section>
        <h2>Argument or object</h2>
        <p>Name one property in the argument, or pass an object for several. Both write the same kind of output.</p>
        <div class="split">
          <div>
            <p data-playground-argument class="sample" v-uno-style:c="accent">Argument form</p>
            <GeneratedOutput :value="accent" arg="c" />
            <pre><code>&lt;p v-uno-style:c="{ sm: '#7c3aed', md: '#0891b2' }" /&gt;</code></pre>
          </div>
          <div>
            <div data-playground-object class="sample chips" v-uno-style="toolbar">
              <span>Object</span><span>form</span><span>here</span>
            </div>
            <GeneratedOutput :value="toolbar" />
            <pre><code>&lt;div v-uno-style="{ c: {...}, gap: { sm: '0.5rem', md: '1.5rem' } }" /&gt;</code></pre>
          </div>
        </div>
      </section>

      <section>
        <h2>Scalars and repeated values</h2>
        <p>A plain value applies to the base breakpoint. Adjacent breakpoints with the same value collapse into one class, so <code>md: '100%'</code> below writes nothing.</p>
        <div class="split">
          <div>
            <p data-playground-scalar class="sample outlined" v-uno-style:p="'1.5rem'">Padded with a scalar</p>
            <GeneratedOutput value="1.5rem" arg="p" />
          </div>
          <div>
            <p data-playground-collapsed class="sample outlined" v-uno-style:w="width">Full width, half from lg</p>
            <GeneratedOutput :value="width" arg="w" />
          </div>
        </div>
        <pre><code>&lt;p v-uno-style:w="{ sm: '100%', md: '100%', lg: '50%' }" /&gt;</code></pre>
      </section>

      <section>
        <h2>Value formats</h2>
        <p><code>bgi</code> is configured as <code>{ name: 'bgi', format: 'url' }</code>, so plain image URLs are wrapped in <code>url()</code>. Its rule lives in the playground's <code>uno.config.ts</code>, because the package predefines no properties.</p>
        <div data-playground-format class="pattern" v-uno-style="pattern" />
        <GeneratedOutput :value="pattern" />
        <pre><code>// config/vue-uno-style.ts
export const properties = ['c', 'bg', 'p', 'gap', 'w', 'bgv', { name: 'bgi', format: 'url' }]</code></pre>
      </section>

      <section>
        <h2>Updates remove what's gone</h2>
        <p>Switching the palette replaces the classes and variables on the element. Amber has no <code>md</code> padding, so <code>--p-md</code> and its class have to disappear. The lists below are read from the element itself.</p>
        <div ref="card" data-playground-update class="update-card" v-uno-style="palette">
          <strong>{{ palettes[active].label }} palette</strong>
          <button data-playground-toggle type="button" class="button" @click="switchPalette">Switch palette</button>
        </div>
        <div class="split">
          <div>
            <h3>On the element</h3>
            <p class="codes"><code v-for="name in written" :key="name">{{ name }}</code></p>
          </div>
          <div>
            <h3>Removed by the last switch</h3>
            <p class="codes">
              <code v-for="name in removed" :key="name" class="removed">{{ name }}</code>
              <span v-if="!removed.length" class="muted">Switch the palette to see.</span>
            </p>
          </div>
        </div>
      </section>

      <section>
        <h2>Components compose</h2>
        <p>A component can style its own root with the directive while its usage site adds another. Both apply, and the usage site wins a property both set. Turn the highlight off and the badge falls back to its own colors.</p>
        <div class="row">
          <StatusBadge label="Default" />
          <StatusBadge data-playground-composed label="Highlighted" v-uno-style="highlight" />
          <button type="button" class="button" :aria-pressed="highlighted" @click="highlighted = !highlighted">
            Highlight {{ highlighted ? 'on' : 'off' }}
          </button>
        </div>
        <pre><code>&lt;StatusBadge label="Highlighted" v-uno-style="{ c: {...}, bg: {...} }" /&gt;</code></pre>
      </section>

      <section>
        <h2>Runtime values win</h2>
        <p>The directive's classes carry the <code>vs:</code> variant, which puts them in their own <code>v-uno-style</code> layer after the default one, so they beat ordinary utilities on the same element. This text has <code>c-slate-400</code> and still takes the runtime color.</p>
        <p data-playground-override class="c-slate-400 sample" v-uno-style:c="override">Green, then blue from md</p>
        <pre><code>&lt;p class="c-slate-400" v-uno-style:c="{ sm: '#16a34a', md: '#2563eb' }" /&gt;</code></pre>
      </section>
    </main>

    <footer>
      This page is pre-rendered with the Nuxt module: view its source to see the classes and variables in the HTML.
      The <a :href="`${REPOSITORY}/tree/main/playground`">playground</a> runs the same way locally.
    </footer>
  </div>
</template>

<style>
/* Tokens follow the Nuxt design system (nuxt.com/design.md): neutral surfaces,
   green primary (-500 in light mode, -400 in dark), Outfit headings, Inter body. */
:root {
  color-scheme: light;
  --bg: #ffffff;
  --bg-muted: #fafafa;
  --bg-elevated: #f5f5f5;
  --bg-accented: #e5e5e5;
  --border: #e5e5e5;
  --text: #404040;
  --text-highlighted: #171717;
  --text-muted: #737373;
  --primary: #00c16a;
  --on-primary: #ffffff;
  --danger: #dc2626;
  --font-heading: 'Outfit', system-ui, sans-serif;
  --font-sans: 'Inter', system-ui, sans-serif;
  --font-mono: ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace;
}

/* Dark follows the system unless the toggle picked a theme (`data-theme` on <html>). */
:root[data-theme="dark"] {
  color-scheme: dark;
  --bg: #0a0a0a;
  --bg-muted: #171717;
  --bg-elevated: #171717;
  --bg-accented: #262626;
  --border: #262626;
  --text: #d4d4d4;
  --text-highlighted: #ffffff;
  --text-muted: #a3a3a3;
  --primary: #00dc82;
  --on-primary: #0a0a0a;
  --danger: #f87171;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    color-scheme: dark;
    --bg: #0a0a0a;
    --bg-muted: #171717;
    --bg-elevated: #171717;
    --bg-accented: #262626;
    --border: #262626;
    --text: #d4d4d4;
    --text-highlighted: #ffffff;
    --text-muted: #a3a3a3;
    --primary: #00dc82;
    --on-primary: #0a0a0a;
    --danger: #f87171;
  }
}

* { box-sizing: border-box; }

body {
  margin: 0;
  font: 16px/1.6 var(--font-sans);
  color: var(--text);
  background: var(--bg);
  -webkit-font-smoothing: antialiased;
}

h1, h2, h3 { margin: 0; font-family: var(--font-heading); font-weight: 500; color: var(--text-highlighted); }
a { color: var(--primary); text-decoration: none; }
a:hover { text-decoration: underline; }
.accent { color: var(--primary); }
.muted { font-size: 13px; color: var(--text-muted); }

.container { max-width: 1024px; margin: 0 auto; padding: 0 16px; }

/* Sticky chrome is the one place the design blurs. */
.topbar { position: sticky; top: 0; z-index: 10; background: color-mix(in srgb, var(--bg) 75%, transparent); border-bottom: 1px solid var(--border); backdrop-filter: blur(8px); }
.topbar-inner { display: flex; gap: 16px; align-items: center; height: 64px; }
.brand { display: inline-flex; gap: 8px; align-items: center; font-family: var(--font-heading); font-size: 18px; font-weight: 500; color: var(--text-highlighted); }
.brand-mark { width: 20px; height: 20px; background: linear-gradient(135deg, var(--primary) 50%, #4f46e5 50%); border-radius: 6px; }
.breakpoint { padding: 2px 10px; font-size: 13px; color: var(--text-muted); border: 1px solid var(--border); border-radius: 999px; }
.breakpoint strong { color: var(--primary); font-weight: 600; }
.breakpoint.hidden { visibility: hidden; }
.links { display: flex; gap: 20px; margin-left: auto; font-size: 14px; font-weight: 500; }
.links a { color: var(--text-muted); }
.links a:hover { color: var(--text-highlighted); text-decoration: none; }
.theme-toggle { display: grid; place-items: center; width: 36px; height: 36px; margin-left: 4px; font-size: 18px; color: var(--text-muted); background: transparent; border: 0; border-radius: 6px; cursor: pointer; }
.theme-toggle:hover { color: var(--text-highlighted); background: var(--bg-accented); }

.hero { display: flex; flex-direction: column; gap: 20px; align-items: center; padding: 56px 0 40px; text-align: center; }
.hero h1 { max-width: 760px; font-size: clamp(36px, 6vw, 60px); line-height: 1.1; letter-spacing: -0.02em; }
.hero p { max-width: 620px; margin: 0; font-size: 18px; color: var(--text-muted); }
.pill { padding: 2px 12px; font-size: 13px; font-weight: 500; color: var(--text-muted); border: 1px solid var(--border); border-radius: 999px; }
.actions { display: flex; flex-wrap: wrap; gap: 12px; justify-content: center; }

.button { display: inline-flex; gap: 8px; align-items: center; padding: 8px 14px; font: 500 14px/1.5 var(--font-sans); color: var(--text-highlighted); background: var(--bg-elevated); border: 1px solid var(--border); border-radius: 6px; cursor: pointer; transition: background .15s, border-color .15s; }
.button:hover { text-decoration: none; background: var(--bg-accented); }
.button.primary { color: var(--on-primary); background: var(--primary); border-color: var(--primary); }
.button.primary:hover { background: color-mix(in srgb, var(--primary) 85%, var(--text-highlighted)); }
.button.mono { font-family: var(--font-mono); font-weight: 400; }
.button[aria-pressed="true"] { color: var(--primary); border-color: var(--primary); }

.sections { display: grid; gap: 16px; padding-bottom: 48px; }
/* `min-width: 0` lets long code lines scroll inside their `pre` instead of widening the page. */
.sections section { min-width: 0; padding: 24px; background: var(--bg); border: 1px solid var(--border); border-radius: 8px; }
.sections h2 { margin-bottom: 4px; font-size: 20px; }
.sections h3 { margin: 16px 0 8px; font-size: 15px; }
/* Section intros only: a demo paragraph must not get a color that outranks the directive's class. */
.sections section > p:not(.sample) { max-width: 65ch; margin: 0 0 20px; color: var(--text-muted); }
.sections section > .sample { margin-bottom: 0; }

code { padding: 1px 5px; font: 13px/1.4 var(--font-mono); color: var(--text-highlighted); background: var(--bg-elevated); border-radius: 4px; }
pre { margin: 20px 0 0; padding: 12px 16px; overflow-x: auto; background: var(--bg-muted); border: 1px solid var(--border); border-radius: 6px; }
pre code { padding: 0; background: none; }

.row { display: flex; flex-wrap: wrap; gap: 16px; align-items: center; }
.split { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px; }

.output { display: grid; grid-template-columns: auto 1fr; gap: 6px 12px; margin: 16px 0 0; font-size: 13px; }
.output dt { font: 13px/1.9 var(--font-mono); color: var(--text-muted); }
.output dd { display: flex; flex-wrap: wrap; gap: 6px; margin: 0; }
.codes { display: flex; flex-wrap: wrap; gap: 6px; margin: 0; }
.removed { color: var(--danger); text-decoration: line-through; }

.editor { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 24px; align-items: start; }
.preview { display: grid; gap: 4px; min-height: 140px; border-radius: 8px; transition: padding .2s; }
.controls { border-collapse: collapse; font-size: 13px; }
.controls th { padding: 4px 8px; font: 500 13px var(--font-mono); color: var(--text-muted); text-align: left; }
.controls td { padding: 4px 8px; }
.controls input[type="color"] { width: 40px; height: 28px; padding: 0; background: none; border: 1px solid var(--border); border-radius: 4px; cursor: pointer; }
.controls select { padding: 4px; font: 13px var(--font-mono); color: var(--text-highlighted); background: var(--bg); border: 1px solid var(--border); border-radius: 4px; }

.sample { margin: 0; font-size: 20px; font-weight: 600; }
.chips { display: flex; flex-wrap: wrap; }
.outlined { color: var(--text-highlighted); background: var(--bg-muted); border: 1px dashed var(--border); border-radius: 6px; }

.pattern { height: 140px; border-radius: 8px; }

.update-card { display: flex; flex-wrap: wrap; gap: 16px; align-items: center; justify-content: space-between; border-radius: 12px; }
.update-card strong { font-size: 20px; }

.status-badge { display: inline-block; font-size: 14px; font-weight: 600; border-radius: 999px; }

footer { padding: 24px 0 48px; font-size: 14px; text-align: center; color: var(--text-muted); border-top: 1px solid var(--border); }

@media (max-width: 767px) {
  .hero { padding: 40px 0; }
  .links { gap: 12px; }
  .split, .editor { grid-template-columns: minmax(0, 1fr); }
}
</style>
