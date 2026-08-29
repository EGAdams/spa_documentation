const content = document.getElementById( "content" );
const nav = document.getElementById( "nav" );

// When hosted inside the main dashboard, the parent mirrors this live nav in
// its own sidebar. Keep only the documentation content inside the iframe.
if ( new URLSearchParams( window.location.search ).get( "embedded" ) === "1" ) {
  document.body.classList.add( "embedded" );
}

// Mirrors the directory layout under spa_documentation/. Add new sections
// and items here as their skeleton folders get built out.
const sections = {
  catherine_agent_sdk: {
    label: "Catherine Agent",
    items: {
      basic_agent: { label: "Basic Agent" },
      future_agent: { label: "Future Agent" },
    },
  },
  lancedb_memory: {
    label: "Lancedb Memory",
    items: {
      agent: { label: "Agent (Orchestrator)" },
      config: { label: "Config" },
      models: {
        label: "Models",
        items: {
          turn: { label: "Turn" },
          embedded_turn: { label: "EmbeddedTurn" },
          recalled_turn: { label: "RecalledTurn" },
          memory_query: { label: "MemoryQuery" },
          agent_reply: { label: "AgentReply" },
        },
      },
      ports: { label: "Ports" },
      clock: { label: "Clock" },
      observers: {
        label: "Observers",
        items: {
          null_observer: { label: "Null Observer" },
          composite_observer: { label: "Composite Observer" },
          console_observer: { label: "Console Observer" },
          cost_observer: { label: "Cost Observer" },
          nexus_archive_observer: { label: "Nexus Archive Observer" },
        },
      },
      prompts: { label: "Prompts" },
      recall: { label: "Recall" },
      adapters: {
        label: "Adapters",
        items: {
          claude_model: { label: "Claude Model Adapter" },
          decorators: { label: "Decorators Adapter" },
          embedding_profiles: { label: "Embedding Profiles Adapter" },
          hashing_embedder: { label: "Hashing Embedder Adapter" },
          in_memory_store: { label: "In-Memory Store Adapter" },
          lancedb_store: { label: "LanceDB Store Adapter" },
          openai_embedder: { label: "OpenAI Embedder Adapter" },
          sentence_embedder: { label: "Sentence Embedder Adapter" },
        },
      },
    },
  },
  voice_communication: {
    label: "Voice Communication",
    items: {
      interfaces: { label: "Main Interface" },
      typescript_contracts: { label: "TypeScript Contracts" },
      pydantic_models: { label: "Pydantic Models" },
      voice_session: { label: "Voice Session" },
      conversation_agent: { label: "IConversationAgent" },
      spoken_output_policy: { label: "Spoken Output Policy" },
      conversation_coordinator: { label: "Conversation Coordinator" },
      letta_agent_adapter: { label: "Letta Agent Adapter" },
      audio_capture: { label: "Audio Capture" },
      transcription_strategy: { label: "Transcription Strategy" },
      route_strategy: { label: "Route Strategy" },
      speech_synthesizer: { label: "Speech Synthesizer" },
      note_command_channel: { label: "Note Command Channel" },
      detection_interface: { label: "Detection Interface" },
      language_processor: { label: "Language Processor" },
      design_protocol: { label: "Design Protocol" },
      pipecat_service_client: { label: "Pipecat Service Client" },
      pipecat_local_service: { label: "Pipecat Local Service" },
      pipeline_factory: { label: "Pipeline Factory" },
      toyota_voice_application: { label: "Toyota Voice Application" },
      voice_health_observer: { label: "Voice Health Observer" },
    },
  },
  mazda: {
    label: "Mazda",
    items: {
      agent: { label: "Mazda Agent" },
      finance_orchestrator: { label: "Finance Orchestrator" },
      intake_dispatch: { label: "Intake Dispatch" },
      intake_evidence: { label: "Intake Evidence" },
      trainer_escalation: { label: "Trainer Escalation" },
      runtime_family: { label: "Runtime Family" },
      runtime_kernel: { label: "Runtime Kernel" },
      persistence_factory: { label: "Persistence Factory" },
      llm_factory: { label: "LLM Factory" },
      prompt_factory: { label: "Prompt Factory" },
      tool_factory: { label: "Tool Factory" },
      context_factory: { label: "Context Factory" },
      workflow_factory: { label: "Workflow Factory" },
      evaluation_factory: { label: "Evaluation Factory" },
      improvement_factory: { label: "Improvement Factory" },
      reporting_factory: { label: "Reporting Factory" },
      agent_package_factory: { label: "Agent Package Factory" },
    },
  },
  solid_agent_systems: {
    label: "Solid Agent Systems",
    items: {},
  },
};

// Every item folder currently uses these same file basenames (see
// catherine_agent_sdk/basic_agent and .../future_agent).
const overviewFile = "basic_agent.html";
const detailTabs = [
  { key: "source", label: "Source", file: "basic_agent.py.html" },
  { key: "class", label: "Class Diagram", file: "mermaid_class.html" },
  { key: "sequence", label: "Sequence Diagram", file: "mermaid_sequence.html" },
  { key: "status", label: "Construction Status", file: "basic_agent_construction_status.html" },
  // The report body here is static (written by update_documentation_agent.py
  // when run from the terminal), but the button above it is live: on load,
  // app.js hits server.py's /api/git-status route to enable/disable it.
  { key: "update_docs", label: "Update Documentation", file: "basic_agent_update_documentation.html" },
];

// Keyed by "top/path/to/item" -> { exists, dirty }. Refetched every time a
// detail tab page loads (see selectDetail) -- not polled on a timer.
let gitStatusCache = {};

let currentTop = "home";
// Path of keys drilling down through nested `items` from the section root
// (e.g. [ "adapters", "claude_model" ]). Empty means "at the section root".
// A resolved node is a *folder* if it has an `items` map (fans out further,
// mirroring a directory in `tree`), or a *leaf* if it doesn't (has detail tabs).
let itemPath = [];

// innerHTML does not execute <script> tags, so detail pages that need JS
// (e.g. mermaid diagrams) would otherwise silently do nothing. Re-create
// each script node so the browser actually runs it.
function executeScripts( container ) {
  container.querySelectorAll( "script" ).forEach( ( oldScript ) => {
    const newScript = document.createElement( "script" );
    Array.from( oldScript.attributes ).forEach( ( attr ) => {
      newScript.setAttribute( attr.name, attr.value );
    } );
    newScript.textContent = oldScript.textContent;
    oldScript.replaceWith( newScript );
  } );
}

async function loadFile( path ) {
  try {
    const response = await fetch( path );
    if ( !response.ok ) {
      content.innerHTML = `<p class="placeholder">Not built yet (${response.status}): ${path}</p>`;
      return;
    }
    const html = await response.text();
    content.innerHTML = html.trim()
      ? html
      : `<p class="placeholder">This page is still blank — content coming later.</p>`;
    executeScripts( content );
  } catch ( error ) {
    content.innerHTML = `<p class="placeholder">Error loading ${path}: ${error.message}</p>`;
  }
}

function addLink( { text, active, className, onClick } ) {
  const a = document.createElement( "a" );
  a.href = "#";
  a.textContent = text;
  if ( active ) a.classList.add( "active" );
  if ( className ) a.classList.add( className );
  a.addEventListener( "click", ( e ) => {
    e.preventDefault();
    onClick();
  } );
  nav.appendChild( a );
}

// Resolves the node at itemPath under the given section (empty path = the
// section root itself, treated as a folder node).
function resolveNode( top, path ) {
  let node = { label: sections[ top ].label, items: sections[ top ].items };
  path.forEach( ( key ) => {
    node = node.items[ key ];
  } );
  return node;
}

function filePath( file ) {
  return [ currentTop, ...itemPath, file ].join( "/" );
}

function hasChildren( node ) {
  return !!node.items && Object.keys( node.items ).length > 0;
}

function renderNav() {
  nav.innerHTML = "";

  if ( currentTop === "home" ) {
    addLink( { text: "Home", active: true, onClick: () => goHome() } );
    Object.keys( sections ).forEach( ( key ) => {
      addLink( {
        text: sections[ key ].label,
        className: hasChildren( sections[ key ]) ? "has-children" : undefined,
        onClick: () => selectSection( key ),
      } );
    } );
    return;
  }

  const node = resolveNode( currentTop, itemPath );

  if ( node.items ) {
    // Folder level (section root or a nested group like "adapters").
    if ( itemPath.length === 0 ) {
      addLink( { text: "Home", onClick: () => goHome() } );
    } else {
      addLink( { text: "Back", className: "back", onClick: () => goUp() } );
    }
    Object.keys( node.items ).forEach( ( key ) => {
      const child = node.items[ key ];
      addLink( {
        text: child.label,
        className: hasChildren( child ) ? "has-children" : undefined,
        onClick: () => selectNode( key ),
      } );
    } );
    return;
  }

  // Leaf item: fixed detail tabs.
  addLink( { text: "Back", className: "back", onClick: () => goUp() } );
  detailTabs.forEach( ( tab ) => {
    addLink( {
      text: tab.label,
      active: tab.key === currentDetail,
      onClick: () => selectDetail( tab ),
    } );
  } );
}

let currentDetail = null;

// Folder-level overview: "<top>/.../_overview.html", sibling of the folder's
// item subfolders. Optional -- a missing/empty one just falls back to the
// old "Choose an item above." placeholder, so existing folders with no
// overview yet keep working unchanged.
async function showCurrentContent() {
  const node = resolveNode( currentTop, itemPath );
  if ( !node.items ) {
    loadFile( filePath( overviewFile ) );
    return;
  }

  const heading = `<h1>${node.label}</h1>`;
  if ( Object.keys( node.items ).length === 0 ) {
    content.innerHTML = `${heading}<p class="placeholder">No items built yet — coming later.</p>`;
    return;
  }

  const chooseMsg = `${heading}<p class="placeholder">Choose an item above.</p>`;
  try {
    const response = await fetch( [ currentTop, ...itemPath, "_overview.html" ].join( "/" ) );
    if ( response.ok ) {
      const html = await response.text();
      content.innerHTML = html.trim() ? `${heading}${html}` : chooseMsg;
      executeScripts( content );
      return;
    }
  } catch ( error ) {
    // fall through to the placeholder below
  }
  content.innerHTML = chooseMsg;
}

function goHome() {
  currentTop = "home";
  itemPath = [];
  currentDetail = null;
  renderNav();
  loadFile( "home_claude_md.html" );
}

function selectSection( top ) {
  currentTop = top;
  itemPath = [];
  currentDetail = null;
  renderNav();
  showCurrentContent();
}

function selectNode( key ) {
  itemPath.push( key );
  currentDetail = null;
  renderNav();
  showCurrentContent();
}

function goUp() {
  if ( itemPath.length === 0 ) {
    goHome();
    return;
  }
  itemPath.pop();
  currentDetail = null;
  renderNav();
  showCurrentContent();
}

function itemKey() {
  return [ currentTop, ...itemPath ].join( "/" );
}

// Runs once per detail-tab page load, not on a timer -- fetches
// server.py's /api/git-status route for the item currently open and
// updates the "Update Documentation" nav link + button accordingly.
async function refreshGitStatus() {
  const key = itemKey();
  try {
    // Relative, not "/api/..." -- this page can be loaded at the server's
    // own root or under a reverse-proxy subpath (e.g. /agent-block/ in the
    // letta-code dashboard), and an absolute path would resolve to the
    // proxy's domain root instead of back to this same server.
    const response = await fetch( `api/git-status?item=${encodeURIComponent( key )}` );
    gitStatusCache[ key ] = response.ok ? await response.json() : { exists: false, dirty: false };
  } catch ( error ) {
    gitStatusCache[ key ] = { exists: false, dirty: false };
  }
  applyGitStatusUI();
}

function applyGitStatusUI() {
  const status = gitStatusCache[ itemKey() ];
  const updateLink = Array.from( nav.querySelectorAll( "a" ) ).find(
    ( a ) => a.textContent === "Update Documentation"
  );
  if ( updateLink ) {
    updateLink.classList.toggle( "tab-dirty", !!( status && status.dirty ) );
  }
  if ( currentDetail === "update_docs" ) {
    renderUpdateButton( status );
  }
}

function renderUpdateButton( status ) {
  // .update-doc-log (if a run is/was in progress) lives inside the bar, so
  // removing the bar takes it with it.
  content.querySelector( ".update-doc-bar" )?.remove();

  const bar = document.createElement( "div" );
  bar.className = "update-doc-bar";

  const btn = document.createElement( "button" );
  btn.type = "button";
  btn.className = "update-doc-btn";
  btn.disabled = true;
  if ( !status ) {
    btn.textContent = "Checking git status…";
  } else if ( status.dirty ) {
    btn.disabled = false;
    btn.textContent = "Update Documentation";
  } else {
    btn.textContent = status.exists ? "Up to date" : "Source not found";
  }
  bar.appendChild( btn );

  const hint = document.createElement( "p" );
  hint.className = "placeholder";
  hint.textContent = status && status.dirty
    ? ( status.docs_missing ? "Docs not generated yet." : "Source changed since docs were generated." )
    : "No uncommitted source changes detected.";
  bar.appendChild( hint );

  content.prepend( bar );

  if ( status && status.dirty ) {
    btn.addEventListener( "click", () => startUpdateRun( btn, hint ) );
  }
}

// Click -> POST api/run-update starts update_documentation_agent.py in the
// background on the server (see server.py) -> poll api/run-update-status
// every few seconds, streaming its log tail into the hint line, until it
// exits -> reload the report and re-check git status.
function startUpdateRun( btn, hint ) {
  const item = itemKey();
  btn.disabled = true;
  btn.textContent = "Starting…";
  hint.textContent = "";

  // Sibling of hint inside .update-doc-bar, not content.insertBefore(...,
  // hint.nextSibling) -- hint's parent is bar, not content, so that would
  // throw NotFoundError (hint isn't a direct child of content).
  const logBox = document.createElement( "pre" );
  logBox.className = "update-doc-log";
  hint.after( logBox );

  fetch( "api/run-update", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify( { item } ),
  } )
    .then( ( r ) => r.json() )
    .then( ( data ) => {
      if ( !data.ok ) {
        btn.disabled = false;
        btn.textContent = "Update Documentation";
        logBox.textContent = `Could not start: ${data.error || "unknown error"}`;
        return;
      }
      btn.textContent = "Running…";
      pollUpdateRun( item, btn, logBox );
    } )
    .catch( ( error ) => {
      btn.disabled = false;
      btn.textContent = "Update Documentation";
      logBox.textContent = `Request failed: ${error.message}`;
    } );
}

function pollUpdateRun( item, btn, logBox ) {
  fetch( `api/run-update-status?item=${encodeURIComponent( item )}` )
    .then( ( r ) => r.json() )
    .then( ( data ) => {
      logBox.textContent = data.log_tail || "(starting…)";
      logBox.scrollTop = logBox.scrollHeight;

      if ( data.running ) {
        setTimeout( () => pollUpdateRun( item, btn, logBox ), 3000 );
        return;
      }

      btn.textContent = data.exit_code === 0 ? "Done" : `Exited (code ${data.exit_code})`;
      // Only reload if the user hasn't navigated elsewhere meanwhile.
      if ( currentDetail === "update_docs" && itemKey() === item ) {
        const tab = detailTabs.find( ( t ) => t.key === "update_docs" );
        loadFile( filePath( tab.file ) ).then( () => refreshGitStatus() );
      }
    } )
    .catch( () => setTimeout( () => pollUpdateRun( item, btn, logBox ), 3000 ) );
}

function selectDetail( tab ) {
  currentDetail = tab.key;
  renderNav();
  loadFile( filePath( tab.file ) ).then( () => refreshGitStatus() );
}

goHome();
