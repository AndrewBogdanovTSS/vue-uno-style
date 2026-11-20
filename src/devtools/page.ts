/**
 * The HTML shell of the DevTools tab. `client.mjs` renders everything inside `#app`; the
 * styles follow Nuxt DevTools' look, light and dark, so the tab blends in.
 */
export const renderDevtoolsPage = (): string => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>vue-uno-style</title>
<style>
:root {
  color-scheme: light;
  --bg: #ffffff;
  --bg-soft: #f6f6f7;
  --border: #e5e7eb;
  --text: #1f2937;
  --muted: #6b7280;
  --accent: #4f46e5;
  --accent-soft: rgba(79, 70, 229, 0.12);
  --ok: #059669;
  --warn: #b45309;
  --error: #dc2626;
  --mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
:root.dark {
  color-scheme: dark;
  --bg: #151515;
  --bg-soft: #1e1e20;
  --border: #2e2e32;
  --text: #e5e7eb;
  --muted: #9ca3af;
  --accent: #818cf8;
  --accent-soft: rgba(129, 140, 248, 0.16);
  --ok: #34d399;
  --warn: #fbbf24;
  --error: #f87171;
}
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; }
body {
  background: var(--bg);
  color: var(--text);
  font: 13px/1.5 system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
}
#app { display: flex; flex-direction: column; height: 100%; }
header {
  display: flex; align-items: center; gap: 16px; flex-wrap: wrap;
  padding: 8px 16px; border-bottom: 1px solid var(--border); background: var(--bg-soft);
}
header h1 { margin: 0; font-size: 14px; font-weight: 600; }
header .meta { color: var(--muted); }
nav { display: flex; gap: 4px; flex-wrap: wrap; }
nav button {
  border: 0; background: none; color: var(--muted); padding: 4px 10px; border-radius: 4px;
  font: inherit; cursor: pointer;
}
nav button:hover { color: var(--text); }
nav button[aria-current="page"] { background: var(--accent-soft); color: var(--accent); font-weight: 600; }
nav .count { margin-left: 4px; font-size: 11px; color: var(--muted); }
nav .count.alert { color: var(--warn); }
main { flex: 1; overflow: auto; padding: 16px; }
section + section { margin-top: 24px; }
h2 { margin: 0 0 8px; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
table { border-collapse: collapse; width: 100%; }
th, td { text-align: left; padding: 4px 8px; border-bottom: 1px solid var(--border); vertical-align: top; }
th { font-weight: 600; color: var(--muted); font-size: 12px; }
code, pre, .mono { font-family: var(--mono); font-size: 12px; }
pre { margin: 0; padding: 8px; background: var(--bg-soft); border: 1px solid var(--border); border-radius: 4px; overflow: auto; white-space: pre-wrap; word-break: break-all; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; }
.card { border: 1px solid var(--border); border-radius: 6px; padding: 12px; background: var(--bg); }
.card dl { margin: 0; display: grid; grid-template-columns: max-content 1fr; gap: 4px 12px; }
.card dt { color: var(--muted); }
.card dd { margin: 0; }
.ok { color: var(--ok); }
.warn { color: var(--warn); }
.error { color: var(--error); }
.muted { color: var(--muted); }
.pill {
  display: inline-block; padding: 0 6px; border-radius: 999px; font-size: 11px; line-height: 18px;
  border: 1px solid var(--border); color: var(--muted); white-space: nowrap;
}
.pill.active { border-color: var(--accent); color: var(--accent); background: var(--accent-soft); }
.pill.ok { border-color: currentColor; color: var(--ok); }
.pill.warn { border-color: currentColor; color: var(--warn); }
.pill.error { border-color: currentColor; color: var(--error); }
.split { display: grid; grid-template-columns: minmax(240px, 2fr) 3fr; gap: 16px; align-items: start; }
@media (max-width: 720px) { .split { grid-template-columns: 1fr; } }
.list { border: 1px solid var(--border); border-radius: 6px; overflow: hidden; }
.list button {
  display: flex; width: 100%; justify-content: space-between; gap: 8px; align-items: center;
  padding: 6px 10px; border: 0; border-bottom: 1px solid var(--border); background: none;
  color: inherit; font: inherit; text-align: left; cursor: pointer;
}
.list button:last-child { border-bottom: 0; }
.list button:hover { background: var(--bg-soft); }
.list button[aria-selected="true"] { background: var(--accent-soft); }
.toolbar { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 12px; }
input[type="search"], input[type="text"], textarea {
  font: inherit; color: inherit; background: var(--bg); border: 1px solid var(--border);
  border-radius: 4px; padding: 4px 8px;
}
textarea { font-family: var(--mono); font-size: 12px; width: 100%; min-height: 120px; resize: vertical; }
button.action {
  font: inherit; border: 1px solid var(--border); background: var(--bg-soft); color: var(--text);
  border-radius: 4px; padding: 3px 10px; cursor: pointer;
}
button.action:hover { border-color: var(--accent); color: var(--accent); }
a { color: var(--accent); }
.empty { color: var(--muted); padding: 24px; text-align: center; border: 1px dashed var(--border); border-radius: 6px; }
.tokens { display: flex; flex-wrap: wrap; gap: 4px; }
</style>
</head>
<body>
<div id="app"><main><p class="muted">Loading vue-uno-style DevTools…</p></main></div>
<script type="module" src="./client.mjs"></script>
</body>
</html>
`
