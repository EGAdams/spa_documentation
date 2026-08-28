---
name: building-the-spa
description: Conventions for extending the agent_blocks documentation SPA (spa_documentation/) — directory layout, nav drill-down behavior, and file-naming rules to follow when adding new sections/items or filling in blank pages. Use when adding a new agent/tab, filling in a skeleton HTML file, or touching index.html/app.js/styles.css in spa_documentation.
---

# Building the agent_blocks documentation SPA

## What this is
A single-page app at `/home/adamsl/agent_blocks/spa_documentation/` that documents
the `agent_blocks` repo. Plain HTML/CSS/JS, no build step, no framework — modeled
on `/home/adamsl/largo_spa` (fixed left sidebar nav, `#content` main area,
`fetch()` html partials into it).

Run it with `./start.sh` (optionally `./start.sh <port>`) from this directory,
then open `http://localhost:8931/index.html`.

## Files
- `index.html` — shell: `.brand` label + a single `<nav id="nav">`, and `<main id="content">`.
- `app.js` — all navigation logic and the `sections` config object.
- `styles.css` — fixed left sidebar (170px), single nav link style, `.back` variant (red).
- `home_claude_md.html` — generated from the repo's root `CLAUDE.md` via Python's
  `markdown` package. Regenerate after editing `CLAUDE.md`:
  ```bash
  python3 -c "
  import markdown
  with open('/home/adamsl/agent_blocks/CLAUDE.md') as f:
      text = f.read()
  html = markdown.markdown(text, extensions=['fenced_code', 'tables'])
  with open('home_claude_md.html', 'w') as f:
      f.write(html)
  "
  ```

## Nav is a single flat list, not stacked tiers
`#nav` is one `<nav>` element whose *contents are replaced* at each drill-down
level — it is not three nav bars stacked on top of each other. Exactly one of
these renders at a time:

1. **Home level**: `Home` (active) + one link per top-level key in `sections`.
2. **Section level** (a top-level tab was clicked): `Home` + one link per item
   in that section's `items`. Only that section's items show — sibling
   sections disappear until you click `Home` again.
3. **Item/detail level** (an item was clicked): `Back` (red) + the fixed detail
   tabs (`Source`, `Class Diagram`, `Sequence Diagram`, `Construction Status`).
   `Back` returns to the section level, not to Home.

When adding nav behavior, preserve this: never show two levels at once.

## Directory layout mirrors `sections` in app.js
Each section key in `app.js`'s `sections` object is expected to have a same-named
folder here (e.g. `catherine_agent_sdk/`), with one subfolder per item
(e.g. `basic_agent/`, `future_agent/`). Every item folder currently holds these
exact five files (see `catherine_agent_sdk/basic_agent/` for the reference set):

```
basic_agent.html                       # overview, loads when the item tab is clicked
basic_agent.py.html                    # "Source" detail tab
basic_agent_construction_status.html   # "Construction Status" detail tab
mermaid_class.html                     # "Class Diagram" detail tab
mermaid_sequence.html                  # "Sequence Diagram" detail tab
```

Yes — the basenames are literally `basic_agent*` even inside `future_agent/`.
That's intentional per the current skeleton; `app.js` hardcodes these filenames
as constants (`overviewFile`, `detailTabs`) rather than deriving them from the
item key. If a new item ever needs different basenames, that's a deliberate
decision to revisit `app.js`, not an oversight.

## Adding a new section or item
1. Add the key to `sections` in `app.js` (label + `items: {}` or item map).
2. Create the matching folder(s) under `spa_documentation/`, each with the five
   files above (can be empty — see below).
3. No other wiring needed; the nav renders from the `sections` object.

## Blank files are expected, not bugs
Skeleton files are created empty and filled in later. `loadFile()` in `app.js`
already handles this: an empty file renders a `.placeholder` "still blank"
message instead of a blank white page, and a 404 renders a "not built yet"
message. When filling in a page for real, just write real HTML into the file —
no wrapper markup required, `loadFile()` injects it as-is into `#content`.

## Style notes
- Match `largo_spa`'s visual language: dark sidebar (`#333`)/link pills
  (`#4c6ef5`), not new colors per nav tier — we deliberately moved away from a
  three-color tiered look back to one nav style plus the red `.back` link.
- Keep `main` centered with the `calc(170px + 40px)` left margin so it lines up
  with the fixed sidebar width; if the sidebar width changes, update both the
  `header` width and this margin together.

## Source tab: syntax highlighting and header line
`*.py.html` detail pages hold the Python source pre-rendered as VS Code
Dark+-colored HTML, not raw `<pre>` text — there's no highlighter wired into
the SPA at runtime, so generate it ahead of time with Pygments and a custom
style class mapping VS Code Dark+ token colors, then paste the output in.
See `catherine_agent_sdk/basic_agent/basic_agent.py.html` for the reference:
a `<style>` block scoped to `.vscode-pre` + Pygments' `.get_style_defs()`
output, then `<pre class="vscode-pre"><code>...</code></pre>` with the
highlighted body. Bare `http*` URLs that show up inside a `# comment` in the
source should become real `<a target="_blank" rel="noopener noreferrer">`
links, colored `inherit` from the comment span (`.vscode-pre .c1 a { color:
inherit; text-decoration: underline; }`) so the link doesn't stick out from
the surrounding comment color — only the underline marks it clickable.

Below the `<h1>Source</h1>` heading, add a one-line subtitle using the
existing `.placeholder` class (already defined in `styles.css` — gray,
italic, no new CSS needed):
```html
<p class="placeholder">Lines: 80&nbsp;&nbsp;Last modified: August, 28 08:19:55</p>
```
`Lines` is the source file's line count (`wc -l`), `Last modified` is its
mtime (`stat -c '%y'`), formatted as `Month, day HH:MM:SS`. This is
generated once and pasted in as static text, same as the highlighted body —
regenerate both by hand if the underlying `.py` file changes.

## Mermaid diagrams (Class/Sequence tabs) need JS execution + vendoring
`mermaid_class.html` and `mermaid_sequence.html` are not static markup —
they embed a `<script>` that renders a mermaid diagram into an interactive,
pannable/zoomable SVG. Three things have to be true for this to work in this
SPA, all already wired up as of this skill's last update:

1. **`app.js`'s `loadFile()` executes `<script>` tags.** Setting
   `content.innerHTML` does *not* run embedded scripts — the browser ignores
   them. `loadFile()` calls `executeScripts( content )` after every
   `innerHTML` assignment, which clones each `<script>` node so it actually
   runs. Don't remove this; every interactive detail page depends on it.
2. **Mermaid is vendored locally, not pulled from a CDN**, at
   `spa_documentation/vendor/mermaid.min.js` (currently v10.9.8, copied from
   an npm cache — there is no package manifest in this repo, so re-vendoring
   means finding another local copy or downloading one by hand). Diagram
   pages lazy-load it with a small `ensureMermaidLoaded()` helper that checks
   `window.mermaid` first (so navigating between diagram tabs doesn't
   re-fetch it) and otherwise appends `<script src="/vendor/mermaid.min.js">`
   to `<head>`.
3. **The host document must declare `<meta charset="utf-8">`.** `index.html`
   already does. This matters because mermaid's minified bundle contains
   multibyte UTF-8 characters; without an explicit charset on the *document*
   that's loading the `<script src>`, the browser can guess the wrong
   encoding for the external script and throw `Uncaught SyntaxError: Invalid
   or unexpected token` on load. This only bites pages loaded directly
   (e.g. testing a diagram `.html` file standalone) — going through
   `index.html`'s nav is always safe. If you ever test a diagram fragment in
   isolation, wrap it in a full HTML doc with `<meta charset="utf-8">` first.

### The pan/zoom pattern (mermaid.live-style)
Each diagram page is self-contained (own `<style>` and `<script>`, no shared
JS file) and follows this structure — copy
`catherine_agent_sdk/basic_agent/mermaid_sequence.html` as the reference
rather than re-deriving it:

- `.mmd-wrap` > `.mmd-toolbar` (zoom in/out/reset buttons + a hint label) and
  `#mmd-viewport` (`.mmd-viewport`, fixed height, `overflow: hidden`, dotted
  grid background) > `#mmd-stage` (`.mmd-stage`, `position: absolute`,
  `transform-origin: 0 0`) > `<pre class="mermaid" id="mmd-source">` holding
  the raw diagram definition text.
- `ensureMermaidLoaded()` → `mermaid.initialize({ startOnLoad: false })` →
  `mermaid.render()` the source text → `stage.innerHTML = svg` → then wire up
  pan/zoom on the rendered stage.
- Zoom is mouse-wheel, zooming toward the cursor position (not the center) —
  `wheel` listener with `preventDefault()`, scale clamped `[0.2, 4]`. Pan is
  pointer-drag using `pointerdown`/`pointermove`/`pointerup` with
  `setPointerCapture`, scoped to `#mmd-viewport` only (not `window`) so
  listeners never leak across nav re-renders — each nav change replaces
  `#content`, which garbage-collects the old viewport and its listeners.
  Toolbar buttons zoom toward the viewport center.
- Give each `mermaid.render()` call a unique id (e.g. `"mmd-svg-" +
  Date.now()`) — reusing one across nav visits/re-renders can collide.

### Verifying a diagram page actually works
`loadFile()`'s script execution and mermaid's rendering are both invisible
to a plain `curl`/`Read` check — you have to actually run JS. Headless
Chrome is available (`google-chrome --headless --disable-gpu`) and works
well for this: serve the SPA (`./start.sh`), then either
`--dump-dom` a test harness page that calls `selectSection()` /
`selectItem()` / `selectDetail()` from `app.js` directly and logs
`document.querySelectorAll("#content svg").length`, or check
`google-chrome`'s stderr (`--enable-logging=stderr --v=1`) for `CONSOLE`
lines to catch JS errors. Don't `--virtual-time-budget` a *standalone*
diagram fragment and conclude it's broken from a `SyntaxError` there — see
the charset note above; test through `index.html`'s real nav flow instead.
