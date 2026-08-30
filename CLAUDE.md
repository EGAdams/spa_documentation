# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## spa_documentation

This nested Git repository is a plain HTML/CSS/JavaScript documentation SPA for
the parent `agent_blocks` workspace. It has no framework, no build step, no
package manifest, and no test suite.

Before doing any work here, load the `building-the-spa` skill from
`skills/building-the-spa/SKILL.md`. It defines the navigation drill-down,
directory layout, generated-page conventions, Construction Status task trees,
the Mermaid pan/zoom pattern, and the verification workflow this SPA depends
on. Load it every time, not only when the task appears visual.

## Commands

```bash
./start.sh                 # serve on http://localhost:8931/index.html
./start.sh 9000            # alternate port

# Regenerate one leaf's source-derived docs (real Claude Agent SDK call).
# Needs .venv; ANTHROPIC_API_KEY / ANTHROPIC_BASE_URL must stay UNSET so the
# SDK uses local Claude Code subscription auth instead of direct-API billing.
.venv/bin/python update_documentation_agent.py lancedb_memory/models/turn

# Regenerate the Home page after editing the parent repo's root CLAUDE.md
# (exact snippet in skills/building-the-spa/SKILL.md).
python3 -c "import markdown; ..."   # -> home_claude_md.html
```

`start.sh` runs `server.py` (stdlib-only) rather than a bare static server,
because the Update Documentation tab depends on `server.py`'s
`/api/git-status`, `/api/run-update`, and `/api/run-update-status` routes.
`.venv` (`claude_agent_sdk`, `pygments`) is needed only by the updater
subprocess `server.py` launches, not by `server.py` itself.

There is nothing to lint or unit-test. Verification means running the SPA and
executing its JS — `loadFile()`'s script execution and Mermaid rendering are
invisible to `curl`/`Read`. Use headless Chrome through `index.html`'s real
nav flow, per the skill's "Verifying a diagram page actually works".

## Folders here are documentation mirrors, not source

Top-level folders that share a name with a real `agent_blocks` project
(`lancedb_memory/`, `catherine_agent_sdk/`, `voice_communication/`,
`claude_agent_adapter/`, `solid_agent_systems/`, `mazda/`) are *documentation
trees* inside this SPA, not the real code — each leaf holds only the six fixed
generated doc files described in the skill (overview, source, class/sequence
diagrams, construction status, update report). The actual source they document
lives one level up, in the parent `agent_blocks` checkout.

## One item is defined in three places at once

There is no single registry. Adding, renaming, or moving a leaf means editing
all three, or it half-works in a way nothing warns about:

1. `app.js`'s `sections` object — the *only* thing that drives navigation.
   Nested `items` maps mirror nested folders.
2. The folder on disk under `spa_documentation/`, holding the six fixed
   basenames (all literally `basic_agent*`; `app.js` hardcodes them as
   `overviewFile` / `detailTabs` rather than deriving them from the item key).
   Empty files are expected — `loadFile()` renders a "still blank" placeholder.
3. `doc_source_map.py`'s `resolve_source_path()` — the authoritative item-path
   -> real-source-file mapping (`REPO_ROOT` resolves to `agent_blocks`, the
   parent of this repo), used by both `server.py` and
   `update_documentation_agent.py`.

A leaf missing from (3) still renders and navigates fine; only git status and
Update Documentation silently stop working for it. `mazda/` is currently in
that state — it is in `sections` with no mapping branch. `resolve_source_path`
is not mechanical (per-section shapes, plus an explicit
`VOICE_COMMUNICATION_SOURCE_FILES` table) and validates every path segment
against `_SAFE_PART`, because item paths arrive from an untrusted query string.

## Staleness is source-dirty OR docs-missing

`/api/git-status` calls a leaf dirty if its mapped source is Git-dirty *or* any
of `SOURCE_DERIVED_DOCS` (Source, Class Diagram, Sequence Diagram) is missing
or zero-byte. A clean git diff alone does not mean docs were ever generated, so
a never-touched source with never-generated docs must still count as needing an
update. Overview / Construction Status / report are excluded — they are
hand-authored status text, not derived from source. `git-status` asks git for
each file's own toplevel rather than assuming `REPO_ROOT`, since
`catherine_agent_sdk/` is a separate repo.

`update_documentation_agent.py` has no template file to import; its prompt
points the agent at `catherine_agent_sdk/basic_agent/` pages as the structural
reference. The updater began as a Python-source workflow — the fixed
`.py.html` filename does not make a source Python, and TypeScript-backed
objects need a TypeScript lexer and language-appropriate diagrams.

## Two invariants that break only in production

- **Keep in-page URLs relative.** `api/git-status?item=...` in `app.js` and
  `vendor/mermaid.min.js` in the diagram pages must never gain a leading
  slash. The SPA is reverse-proxied under `/agent-block/` in the main Letta
  dashboard, where a root-relative path resolves against the proxy's domain
  and 404s. The document always loads at the server root regardless of nav
  depth, so a plain relative path is always correct.
- **Bump the cache-busting query strings** on `styles.css?v=...` and
  `app.js?v=...` in `index.html` whenever either file changes; they are the
  only cache control this SPA has.

`?embedded=1` adds `body.embedded`, which hides the in-page nav for the
dashboard iframe (the parent mirrors the nav in its own sidebar). Nav state
lives in module-level variables (`currentTop`, `itemPath`, `currentDetail`),
not the URL — there is no routing or history integration.

## Style

Python here follows the parent workspace's bracket-spacing convention (see the
root `CLAUDE.md`): a space inside every non-empty bracket pair, adjacent
brackets stacked tight. `app.js` follows the same convention in JavaScript —
`document.getElementById( "content" )`, `[ currentTop, ...itemPath ]`. Match
it when adding code.
