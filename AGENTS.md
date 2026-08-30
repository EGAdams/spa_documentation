# Repository Guidelines

## Project Structure & Module Organization

This nested repository is a framework-free documentation SPA for the parent `agent_blocks` workspace. `index.html`, `app.js`, and `styles.css` provide the shell, navigation, and presentation. `server.py` serves static content plus update/status APIs; `doc_source_map.py` maps navigation leaves to source files in the parent repository; `update_documentation_agent.py` regenerates source-derived pages. Top-level trees such as `lancedb_memory/`, `voice_communication/`, and `claude_agent_adapter/` are documentation mirrors, not application source.

Each leaf directory uses six fixed files: `basic_agent.html`, `basic_agent.py.html`, `mermaid_class.html`, `mermaid_sequence.html`, `basic_agent_construction_status.html`, and `basic_agent_update_documentation.html`. Keep a leaf synchronized across its folder, `app.js`'s `sections`, and `doc_source_map.py`.

## Build, Test, and Development Commands

- `./start.sh` — serve the SPA at `http://localhost:8931/index.html`.
- `./start.sh 9000` — serve on an alternate port.
- `node --check app.js` — validate JavaScript syntax.
- `python3 -m py_compile server.py doc_source_map.py update_documentation_agent.py` — validate Python syntax.
- `.venv/bin/python update_documentation_agent.py lancedb_memory/models/turn` — regenerate one mapped leaf; this invokes the Claude Agent SDK.
- `git diff --check` — detect whitespace errors before submitting changes.

There is no build step, package manifest, linter, or automated unit-test suite.

## Coding Style & Naming Conventions

Match existing four-space indentation and the repository's spaced-bracket style in Python and JavaScript, for example `document.getElementById( "content" )`. Use `snake_case` for Python names and documentation directories, and `camelCase` for JavaScript functions and variables. Keep API and Mermaid asset URLs relative so reverse-proxy hosting under `/agent-block/` continues to work. When changing `app.js` or `styles.css`, bump its cache-busting query string in `index.html`.

## Testing Guidelines

Run the SPA and exercise the real navigation in a JavaScript-capable browser. For diagram changes, confirm Mermaid produces an SVG and pan/zoom controls work; `curl` cannot validate injected scripts. Check Update Documentation status for any changed mapping and confirm all six leaf files exist.

## Commit & Pull Request Guidelines

The short history uses informal, descriptive subjects without Conventional Commit prefixes. Prefer concise imperative subjects such as `Add Toyota voice documentation`. Pull requests should explain scope, identify affected navigation paths and source mappings, list checks run, and include screenshots for visible UI or diagram changes. Do not fold unrelated dirty-worktree changes into the commit.
