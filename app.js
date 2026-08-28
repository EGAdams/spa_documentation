const content = document.getElementById( "content" );
const nav = document.getElementById( "nav" );

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
    items: {},
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
];

let currentTop = "home";
let currentItem = null;

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

function renderNav() {
  nav.innerHTML = "";

  if ( currentTop === "home" ) {
    addLink( { text: "Home", active: true, onClick: () => goHome() } );
    Object.keys( sections ).forEach( ( key ) => {
      addLink( { text: sections[ key ].label, onClick: () => selectSection( key ) } );
    } );
    return;
  }

  if ( !currentItem ) {
    addLink( { text: "Home", onClick: () => goHome() } );
    const section = sections[ currentTop ];
    Object.keys( section.items ).forEach( ( key ) => {
      addLink( { text: section.items[ key ].label, onClick: () => selectItem( key ) } );
    } );
    return;
  }

  addLink( { text: "Back", className: "back", onClick: () => deselectItem() } );
  detailTabs.forEach( ( tab ) => {
    addLink( {
      text: tab.label,
      active: tab.key === currentDetail,
      onClick: () => selectDetail( tab ),
    } );
  } );
}

let currentDetail = null;

function goHome() {
  currentTop = "home";
  currentItem = null;
  currentDetail = null;
  renderNav();
  loadFile( "home_claude_md.html" );
}

function selectSection( top ) {
  currentTop = top;
  currentItem = null;
  currentDetail = null;
  renderNav();

  const section = sections[ top ];
  if ( Object.keys( section.items ).length === 0 ) {
    content.innerHTML = `<h1>${section.label}</h1><p class="placeholder">No items built yet — coming later.</p>`;
  } else {
    content.innerHTML = `<h1>${section.label}</h1><p class="placeholder">Choose an item above.</p>`;
  }
}

function selectItem( key ) {
  currentItem = key;
  currentDetail = null;
  renderNav();
  loadFile( `${currentTop}/${key}/${overviewFile}` );
}

function deselectItem() {
  currentItem = null;
  currentDetail = null;
  renderNav();
  const section = sections[ currentTop ];
  content.innerHTML = `<h1>${section.label}</h1><p class="placeholder">Choose an item above.</p>`;
}

function selectDetail( tab ) {
  currentDetail = tab.key;
  renderNav();
  loadFile( `${currentTop}/${currentItem}/${tab.file}` );
}

goHome();
