( () => {
  const MERMAID_THEME = {
    startOnLoad: false,
    securityLevel: "loose",
    theme: "base",
    themeVariables: {
      lineColor: "#b58b36",
      primaryColor: "#17365d",
      primaryTextColor: "#ffffff",
      primaryBorderColor: "#0d2744",
      secondaryColor: "#eaf2fb",
      tertiaryColor: "#f8f2e4",
      textColor: "#172033",
      classText: "#ffffff",
      actorBkg: "#17365d",
      actorBorder: "#0d2744",
      actorTextColor: "#ffffff",
      actorLineColor: "#8fa2ba",
      signalColor: "#17365d",
      signalTextColor: "#172033",
      sequenceNumberColor: "#ffffff",
      noteBkgColor: "#f8f2e4",
      noteBorderColor: "#b58b36",
      noteTextColor: "#172033",
      labelBoxBkgColor: "#eaf2fb",
      labelTextColor: "#172033",
    },
  };

  function ensureMermaidLoaded() {
    if ( window.mermaid ) return Promise.resolve();
    return new Promise( ( resolve, reject ) => {
      const script = document.createElement( "script" );
      script.src = document.body.dataset.mermaidSrc;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild( script );
    } );
  }

  function wireDiagramPanZoom( figure ) {
    const viewport = figure.querySelector( ".mermaid-viewport" );
    const canvas = figure.querySelector( ".mermaid-canvas" );
    let scale = 1;
    let x = 0;
    let y = 0;
    let dragging = false;
    let startX = 0;
    let startY = 0;

    const apply = () => {
      canvas.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
    };
    const reset = () => {
      scale = 1;
      x = 0;
      y = 0;
      apply();
    };
    const zoomAt = ( clientX, clientY, factor ) => {
      const rect = viewport.getBoundingClientRect();
      const px = clientX - rect.left;
      const py = clientY - rect.top;
      const next = Math.min( 4, Math.max( 0.3, scale * factor ));
      if ( next === scale ) return;
      x = px - ( px - x ) * ( next / scale );
      y = py - ( py - y ) * ( next / scale );
      scale = next;
      apply();
    };

    viewport.addEventListener( "wheel", ( event ) => {
      event.preventDefault();
      if ( event.shiftKey ) {
        x -= event.deltaY;
        apply();
        return;
      }
      zoomAt( event.clientX, event.clientY, Math.exp( -event.deltaY * 0.0015 ));
    }, { passive: false } );

    viewport.addEventListener( "pointerdown", ( event ) => {
      dragging = true;
      startX = event.clientX - x;
      startY = event.clientY - y;
      viewport.classList.add( "dragging" );
      viewport.setPointerCapture( event.pointerId );
    } );
    viewport.addEventListener( "pointermove", ( event ) => {
      if ( !dragging ) return;
      x = event.clientX - startX;
      y = event.clientY - startY;
      apply();
    } );
    const stop = ( event ) => {
      dragging = false;
      viewport.classList.remove( "dragging" );
      if ( viewport.hasPointerCapture?.( event.pointerId )) {
        viewport.releasePointerCapture( event.pointerId );
      }
    };
    viewport.addEventListener( "pointerup", stop );
    viewport.addEventListener( "pointercancel", stop );
    viewport.addEventListener( "dblclick", reset );

    figure.querySelectorAll( ".diagram-controls button" ).forEach( ( button ) => {
      button.addEventListener( "click", () => {
        const rect = viewport.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        if ( button.dataset.action === "in" ) zoomAt( centerX, centerY, 1.25 );
        else if ( button.dataset.action === "out" ) zoomAt( centerX, centerY, 0.8 );
        else reset();
      } );
    } );
  }

  async function renderLessonDiagrams() {
    const figures = Array.from( document.querySelectorAll( ".mermaid-figure" ) );
    if ( figures.length === 0 ) return;

    try {
      await ensureMermaidLoaded();
      window.mermaid.initialize( MERMAID_THEME );
      for ( const figure of figures ) {
        const source = figure.querySelector( "pre.mermaid" );
        if ( !source || source.dataset.rendered === "1" ) continue;
        const definition = source.innerHTML
          .replace( /&lt;/g, "<" )
          .replace( /&gt;/g, ">" )
          .replace( /&quot;/g, '"' )
          .replace( /&#39;/g, "'" )
          .replace( /&nbsp;/g, " " )
          .replace( /&amp;/g, "&" );
        const id = "split-mmd-" + figure.dataset.diagram + "-" + Date.now()
          + "-" + Math.floor( Math.random() * 1e6 );
        const { svg } = await window.mermaid.render( id, definition );
        figure.querySelector( ".mermaid-canvas" ).innerHTML = svg;
        source.dataset.rendered = "1";
        wireDiagramPanZoom( figure );
      }
    } catch ( error ) {
      figures.forEach( ( figure ) => {
        figure.querySelector( ".mermaid-canvas" ).textContent =
          "Diagram could not be rendered: " + error.message;
      } );
    }
  }

  window.addEventListener( "DOMContentLoaded", renderLessonDiagrams );
} )();

