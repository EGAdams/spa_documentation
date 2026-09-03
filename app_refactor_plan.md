# app.js refactor — shift handoff

Executable instructions for splitting `app.js` (1,301 lines, one file) into
modules. The reasoning and the diagrams live in `app_refactor_plan.html`
(open it at `http://localhost:8931/app_refactor_plan.html`); **this file is
the work order.** Read the HTML page once for the "why", then work from here.

Baseline: `app.js` at commit `bb021bf`, 1,301 lines, 62 top-level
declarations, 5 module-level mutables, 8 raw `fetch()` call sites, 0 tests.

---

## Before you touch anything

```bash
cd /home/adamsl/agent_blocks/spa_documentation
git status --short          # must be empty; if not, STOP and read the diff
git diff --stat
python3 check_construction_status_consistency.py   # baseline, see below
./start.sh                  # http://localhost:8931/index.html
```

`check_construction_status_consistency.py` currently reports
**"No inconsistencies found across 66 plan file(s)", exit 0.** That is your
green baseline. If it is not green before you start, fix that first — do not
begin a refactor on top of an existing failure.

### Ground rules

- **Commit at every step boundary.** Six steps, six commits, minimum. This
  repo has no CI and no reviewer; `CLAUDE.md` documents work silently piling
  up to 13 files / 346 lines across sessions because nobody committed. A
  half-finished step in the working tree is indistinguishable from finished
  work to the next shift.
- **One step per commit, never two.** If you finish step 1 and start step 2,
  commit step 1 first.
- **Match the house bracket style** in every line you write: a space inside
  every non-empty bracket pair, adjacent brackets stacked tight —
  `document.getElementById( "content" )`, `[ currentTop, ...itemPath ]`,
  `applyEnhancers( container ))` not `applyEnhancers( container ) )`.
- **Bump the cache-busting query string** on `app.js?v=...` in `index.html`
  in any commit that changes `app.js`. See the cache note below for what
  this does and does not cover.
- Steps 1–3 are behavior-preserving. Step 4 changes behavior *on purpose*.
  Steps 5–6 are behavior-preserving again. Know which kind you are in.

---

## Two things discovered while writing this plan

Both change what the steps say. Read them before step 0.

### 1. `type="module"` breaks the project's own verification recipe

`skills/building-the-spa/SKILL.md` line 415 documents the way this SPA is
verified: a headless-Chrome harness page that "calls `selectSection()` /
`selectItem()` / `selectDetail()` from `app.js` directly". Those work today
only because `app.js` is a classic script and its top-level functions land on
`window`.

The moment `index.html` says `<script type="module">`, every one of those
names becomes module-scoped and the harness silently gets
`TypeError: selectSection is not a function`. **The verification workflow
stops working at exactly the moment the refactor most needs it.**

Fix it in step 0, not later: the composition root explicitly publishes a test
seam. This is deliberate API, not a leak — write the comment.

```js
// Test seam. skills/building-the-spa/SKILL.md's headless-Chrome recipe
// drives the SPA by calling these directly; module scope would otherwise
// hide them. Keep this in sync with the recipe -- it is the only way this
// SPA is verified.
window.__spa = { selectSection, selectNode, selectDetail, goHome, goUp, navState };
```

Update the SKILL.md recipe to say `__spa.selectSection()` in the same commit.

### 2. The cache-busting worry in the HTML page is smaller than it looks

`app_refactor_plan.html` lists a `Cache-Control` change to `server.py` as the
recommended fix for submodule caching. Checking `server.py:281-288` after
writing it: **it already sends `Cache-Control: no-cache` on every response**,
which forces revalidation, which is exactly what ES submodules need. No
server change is required for local development.

What remains true: the `?v=` strings in `index.html` exist for the
reverse-proxied dashboard deployment (`/agent-block/`), where an intermediary
may cache regardless of origin headers, and they only ever version the two
files `index.html` names. After the split, a bumped `app.js?v=` will not
version `catalog/sections.js`. Treat this as **an open question for the
dashboard deploy only** (see "Decisions needed from a human"), not as a
blocker for steps 1–6 locally.

### Not a problem: the 53 pages that call `ensureMermaidLoaded`

`grep` turns up 53 doc pages referencing `ensureMermaidLoaded`, which looks
like a fleet of pages depending on an `app.js` global. They are not — each
one defines its own copy inside an `( function () { ... } )()` IIFE. Nothing
outside `app.js` depends on any `app.js` global. Verified; don't re-panic
when you see the grep.

---

## Step 0 — Convert to modules, move nothing

**Risk: low. This is the enabling step and it must be its own commit.**

The point is to prove the module plumbing works while the code is still one
file, so that if something breaks you know it was the plumbing.

1. Rename nothing. Change `index.html` only:
   ```html
   <script type="module" src="app.js?v=<new-stamp>"></script>
   ```
2. Add the `window.__spa` test seam from finding 1 at the bottom of `app.js`.
3. Update the recipe in `skills/building-the-spa/SKILL.md` (~line 415) to
   call through `__spa`.

**Watch for:** `type="module"` implies `defer`. The current tag is already at
the end of `<body>`, so ordering should be unchanged — but the module now
runs after `DOMContentLoaded` rather than at parse position. The bootstrap at
`app.js:1289-1301` reads `window.location.hash` and calls `goHome()`; confirm
a deep link like
`index.html#item=voice_communication/conversation_agent&tab=status` still
lands correctly.

**Verify:** load the SPA, click into a section, open each of the five detail
tabs on a leaf that has real content
(`voice_communication/conversation_agent`), confirm diagrams render and no
console errors. Then the deep link above.

**Done when:** the SPA behaves identically and `__spa.selectSection` is
callable from the console.

---

## Step 1 — Extract the pure data

**Risk: low — no logic moves. Behavior-preserving.**

Create `catalog/sections.js` and `catalog/tabs.js`, and `mermaid/theme.js`.

| Move | From `app.js` | To |
|---|---|---|
| `sections` | 12–123 (~110 lines) | `catalog/sections.js` |
| `overviewFile` | 127 | `catalog/tabs.js` |
| `DOC_ROOT` | 131 | `catalog/tabs.js` |
| `detailTabs` | 132–143 | `catalog/tabs.js` |
| `MERMAID_THEME` | 208–226 | `mermaid/theme.js` |

All five are literals with no references to anything else — this is a cut,
paste, and `export const`. No signature changes, no call-site changes beyond
adding imports at the top of `app.js`.

**Why this is first even though it moves no logic:** `sections` is one of the
three registries `CLAUDE.md` requires you to edit in lockstep when adding a
leaf. Today, adding a leaf produces a diff against the same file as every
behavior change. After this step it is a one-line diff in a data file.

**Verify:** SPA loads, nav renders every section, a diagram still picks up the
navy/gold theme (`mermaid_class.html` on any leaf).

---

## Step 2 — Extract the pure functions

**Risk: low — but five functions are not as pure as they look.**

This step creates the first code in this repository that can be tested
without a browser. Create `catalog/doc-tree.js`, `construction/task-model.js`,
and `routing/hash-route.js`.

### Genuinely pure — move verbatim

`hasChildren` (550–553), `directConstructionTasks` (554–563),
`constructionTaskRow` (576–581), `constructionTaskTitle` (582–587),
`constructionTaskDescription` (588–592), `constructionTaskLesson` (593–598),
`constructionTaskAncestors` (599–608), `constructionStatusWord` (615–622),
`constructionTrailSentence` (623–635), `constructionStatusCounts` (636–644).

### Reads one import — move and import

`resolveNode` (538–545) reads `sections`. Import it from `catalog/sections.js`.

### Reads ambient globals — signature must change

These five silently depend on module state. Moving them without changing
their signature will "work" only until the module boundary makes the global
unreachable, and the failure mode is a confusing `ReferenceError` far from
the cause. Change the signature as part of the move:

| Function | Line | Hidden dependency | New signature |
|---|---|---|---|
| `filePath` | 546–549 | `currentTop`, `itemPath` | `filePath( itemKey, file )` |
| `itemKey` | 1087–1093 | `currentTop`, `itemPath` | `itemKeyOf( top, path )` |
| `resolveConstructionTask` | 564–575 | `content` | `resolveConstructionTask( root, path )` |
| `constructionTaskSiblings` | 609–614 | `content` | `constructionTaskSiblings( task, root )` |
| `parseHashRoute` | 1246–1258 | `window.location` | `parseHashRoute( hash )` |

At the call sites in `app.js`, pass the value that used to be read
implicitly: `filePath( itemKey(), tab.file )`,
`parseHashRoute( window.location.hash )`, and so on. The globals still exist
at this point — step 6 removes them. This step only stops *these* functions
from reaching for them.

### Write the first test

Once the above lands, `construction/task-model.js` and `routing/hash-route.js`
are assertable from plain Node with no DOM (hash-route entirely; task-model
needs a DOM stub or a small fixture). Write `tests/test_hash_route.mjs` with
a handful of `assert` calls in this step, run it with
`node tests/test_hash_route.mjs`. Do not skip this — it is most of why the
split is worth doing, and it will never get cheaper to add than right now.

**Verify:** SPA loads; open a Construction Status tab with a task tree
(`voice_communication/conversation_agent`), drill into a stage, click Back;
the trail sentence and progress counts still read correctly. Plus the deep
link from step 0. Plus `node tests/test_hash_route.mjs`.

---

## Step 3 — Introduce `DocsApi`

**Risk: low — mechanical. Behavior-preserving except where it fixes an
inconsistency.**

Create `core/docs-api.js` as the **only** file in the codebase permitted to
call `fetch`. Move all eight call sites behind named methods:

| `app.js` line | Becomes |
|---|---|
| 379 | `DocsApi.runTestSuite( apiPath )` |
| 418 | `DocsApi.openProjectTerminal( apiPath )` |
| 456 | `DocsApi.fetchLesson( sourceUrl )` |
| 508 | `DocsApi.fetchFragment( path )` |
| 1033 | `DocsApi.fetchOverview( path )` |
| 1101 | `DocsApi.gitStatus( itemKey )` |
| 1175 | `DocsApi.startUpdate( itemKey )` |
| 1199 | `DocsApi.updateStatus( itemKey )` |

Two rules to encode here, each currently enforced only by a repeated comment:

- **Never a leading slash.** `api/git-status`, not `/api/git-status`. The SPA
  is reverse-proxied under `/agent-block/` in the Letta dashboard, where a
  root-relative path resolves against the proxy's domain and 404s. Put this
  comment in `docs-api.js` once and delete the copies at the call sites.
- **`cache: "no-store"` on document fetches.** Currently decided
  independently at each site.

Also add the Null Object the code already has by accident:

```js
// Returned whenever git status cannot be determined. Named, because two
// call sites previously duplicated this literal and drifted apart.
export const UNKNOWN_STATUS = Object.freeze( { exists: false, dirty: false } );
```

**Verify:** open the Update Documentation tab on a leaf with a mapped source
(`lancedb_memory/models/turn`); the button must reflect real git state, not
"Checking git status…" forever. Kill `server.py` and reload to confirm the
failure path still degrades to a disabled button rather than throwing.

---

## Step 4 — Build the enhancer pipeline

**Risk: medium. THIS STEP CHANGES BEHAVIOR ON PURPOSE.**

Today, four enhancers exist and three call sites each run a different subset:

| Call site | Line | `executeScripts` | `renderLessonDiagrams` | `wireRunTestsButtons` | `wireProjectTerminalButtons` |
|---|---|:-:|:-:|:-:|:-:|
| `renderCanonicalConstructionLesson` | 452 | yes | yes | yes | yes |
| `renderConstructionTextbookTask` | 757 | yes | yes | yes | **no** |
| `loadFile` | 504 | yes | no | no | no |

The consequence, live today: an inline lesson containing an "open a terminal
here" button renders the button and leaves it dead, while the identical
markup in a canonical leaf file works. Same class of divergence as the stale
inline lesson `CLAUDE.md` already documents, one layer down.

Create `content/enhancers/` with one module per enhancer and an ordered
pipeline:

```js
const ENHANCERS = [ executeScripts, renderLessonDiagrams, wireRunTestsButtons, wireProjectTerminalButtons ];

export function applyEnhancers( container ) {
  ENHANCERS.forEach( ( enhance ) => enhance( container ));
}
```

Replace all three call sites with `applyEnhancers( container )`. Subsets stop
being expressible, so they stop drifting.

**Order matters:** `executeScripts` must run first — a page's own script may
insert the markup the later enhancers look for. Keep the existing "only after
the article is in the document" constraint from `app.js:860`.

**Both wire functions are already idempotent** (`dataset.runTestsWired`,
`dataset.projectTerminalWired`), so running them on containers that
previously did not get them is safe. `renderLessonDiagrams` is guarded by
`source.dataset.rendered === "1"`. Confirm this rather than assuming it.

**Verify — this one needs the headless-Chrome flow, not a glance.** Per
`skills/building-the-spa/SKILL.md`, `loadFile()`'s script execution and
Mermaid rendering are invisible to `curl`. Now that `loadFile` runs the full
pipeline, check that ordinary fragment pages did not regress:

```bash
python3 server.py 8944 &
google-chrome --headless --disable-gpu --no-sandbox --enable-logging=stderr --v=1 \
  --virtual-time-budget=9000 --dump-dom "http://localhost:8944/index.html" 2>&1 | grep CONSOLE
```

Then drive it through the real nav flow via `__spa`, and confirm on a
Construction Status inline lesson that a project-terminal button is now live.

---

## Step 5 — Split the Construction Status subsystem

**Risk: medium — largest single diff (405 lines). Behavior-preserving.**

Lines 554–958. Split into:

- `construction/task-model.js` — already created in step 2; the remaining
  query helpers land here.
- `construction/lesson-builder.js` — the Builder replacing
  `renderConstructionTextbookTask` (757–869, ~110 lines). Decompose the
  linear body into named steps in the existing order: `masthead()`,
  `keyIdea()`, `authoredSections()`, `roster()`, `counts()`,
  `continuation()`, `footer()`. The pipeline stays the one place that knows
  the order. Keep the `hasAuthoredContinuation` DOM query intact — it is why
  authored lessons don't get a duplicate closing section.
- `construction/canonical-lesson.js` — `rebaseCanonicalLessonUrls` (439–451)
  and `renderCanonicalConstructionLesson` (452–477).
- `construction/summary.js` — `renderConstructionSummary` (645–667).
- `construction/task-nav.js` — `selectConstructionTask` (908),
  `goUpConstructionTasks` (917), `renderConstructionTaskNav` (934),
  `resetConstructionTaskNav` (954), and for now the two mutables
  `constructionTaskPath` / `focusedConstructionTask`.

**Do not change the rendered output.** Construction Status pages carry the
most authored content in this repo and their exact structure is what
`check_construction_status_consistency.py` reads.

**Verify:** `python3 check_construction_status_consistency.py` must still
report **66 plan files, no inconsistencies, exit 0**. Then walk the
`voice_communication/conversation_agent` plan by hand: drill to `stage-1a`
(Interface File) and `stage-1b` (Event Contracts), both of which render via
`data-lesson-src` from the leaf `index.html` rather than from the plan file.
Those two are the canonical-lesson path and the most fragile thing in this
step.

---

## Step 6 — Replace the globals with `NavState`

**Risk: high — touches everything. Do it alone, in its own commit, at the
start of a shift, not at the end of one.**

It is last because every earlier step reduces the number of call sites that
read the globals directly.

Replace `currentTop` / `itemPath` / `currentDetail` (`app.js:147-159`) with a
`NavState` object that owns them and publishes on change. The nav view and
the content host subscribe. This deletes the hand-repeated ritual:
**12 `renderNav()` call sites and 6 `resetConstructionTaskNav()` call sites**
(1053, 1062, 1070, 1082, 1222, 1271) collapse into subscriptions.

Land the tab **Strategy** objects in the same commit — they need somewhere to
subscribe, and they remove the last of the key-string branching at
`app.js:995, 1117, 1212, 1227`. One object per tab, each knowing its
filename, its after-load hook, and its nav contribution:

```js
const ConstructionStatusTab = {
  key: "status", label: "Construction Status", file: "basic_agent_construction_status.html",
  afterLoad( host, navState ) { /* what app.js:1227 does today */ },
};
```

**Verify:** everything. Every section, every leaf, all five tabs, the
construction drill-down, Back at each level, the Update Documentation run,
the deep link, and `?embedded=1` (which must still hide the nav — the
dashboard iframe depends on it).

---

## Decisions needed from a human

Do not decide these alone at 2am; leave them for the next standup.

1. **Do we version submodules for the dashboard deploy?** Local dev is fine
   (`server.py` sends `no-cache`). The reverse-proxied deployment is the open
   case. Options: `?v=` on every import specifier (noisy, easy to half-do), a
   concatenation step (rejected — the no-build-step constraint is deliberate),
   or confirming the proxy honors origin cache headers. **Someone should
   check what the proxy actually does before we write code for it.**
2. **Does the item catalog stay in JavaScript?** Once `sections` is its own
   file (step 1), publishing it as JSON that both `app.js` and
   `doc_source_map.py` read is a small further step, and would let a checker
   catch the three-registry drift that currently leaves `mazda/` navigable
   but with git status and Update Documentation silently dead. Out of scope
   here; worth knowing whether we are heading there.
3. **How far do we take tests?** Step 2 adds one test file. Whether this
   grows into a real suite — and what runs it, given there is no CI — is a
   team call.

---

## If you have to stop mid-step

Commit what you have on a branch with `WIP:` in the subject and write down
which step you were in and what you had already moved. An uncommitted working
tree is the one failure mode this repo has actually experienced, more than
once. `git log` is only the source of truth for "what's here" if commits
happen.
