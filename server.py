#!/usr/bin/env python3
"""Local dev server for spa_documentation.

Same static-file behavior as `python3 -m http.server`, plus three extra routes:

    GET /api/git-status?item=<docs-item-path>
        -> { "item": ..., "exists": bool, "dirty": bool, "docs_missing": bool }

    POST /api/run-update  {"item": <docs-item-path>}
        -> { "ok": bool, "error"?: str }

    GET /api/run-update-status?item=<docs-item-path>
        -> { "running": bool, "exit_code": int|null, "log_tail": str }

/api/git-status runs `git status --porcelain` on that item's real source file
(see doc_source_map.py for the item-path -> source-file mapping) and also
checks whether the item's generated docs (Source / Class Diagram / Sequence
Diagram) are missing or still empty skeletons. "dirty" is true if either is
the case -- a clean git diff alone doesn't mean the docs were ever generated,
so a never-touched source file with never-generated docs must still count as
needing an update. This is what drives the "Update Documentation" tab's
button (enabled + red when dirty, greyed out when clean) -- app.js calls this
once each time a detail tab page loads, not on a timer.

/api/run-update is what the button's click handler actually calls: it starts
update_documentation_agent.py (in .venv, the real Claude Agent SDK call) for
that item as a background subprocess and returns immediately. app.js then
polls /api/run-update-status until the process exits, showing the tail of its
output, then refreshes /api/git-status and reloads the report. Only one run
per item at a time -- a second click while one's in flight is rejected, not
queued or restarted.

Needs .venv (claude_agent_sdk, pygments) for the subprocess it launches, but
this file itself is stdlib only.
"""
import json
import os
import subprocess
import threading
import time
import urllib.parse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

from doc_source_map import DOCS_ROOT, docs_missing, resolve_source_path

VENV_PYTHON = DOCS_ROOT / ".venv" / "bin" / "python"
UPDATE_SCRIPT = DOCS_ROOT / "update_documentation_agent.py"
RUNS_DIR = DOCS_ROOT / ".update_runs"

# item -> {"proc": Popen, "log_path": Path, "log_file": file, "started": float}.
# One in-flight run per item; guarded by _runs_lock since ThreadingHTTPServer
# handles requests concurrently.
_runs: dict = {}
_runs_lock = threading.Lock()


def _start_update_run( item: str ) -> dict:
    RUNS_DIR.mkdir( exist_ok=True )
    log_path = RUNS_DIR / ( item.replace( "/", "__" ) + ".log" )
    log_file = open( log_path, "wb" )

    # Local Claude Code subscription auth, not direct-API billing -- same
    # requirement as update_documentation_agent.py's own header comment.
    env = dict( os.environ )
    env.pop( "ANTHROPIC_API_KEY", None )
    env.pop( "ANTHROPIC_BASE_URL", None )

    proc = subprocess.Popen(
        [ str( VENV_PYTHON ), str( UPDATE_SCRIPT ), item ],
        cwd=str( DOCS_ROOT ),
        stdout=log_file,
        stderr=subprocess.STDOUT,
        env=env,
    )
    return { "proc": proc, "log_path": log_path, "log_file": log_file, "started": time.time() }


class DocsRequestHandler( SimpleHTTPRequestHandler ):
    def do_GET( self ) -> None:
        parsed = urllib.parse.urlparse( self.path )
        if parsed.path == "/api/git-status":
            self._handle_git_status( parsed )
            return
        if parsed.path == "/api/run-update-status":
            self._handle_run_update_status( parsed )
            return
        super().do_GET()

    def do_POST( self ) -> None:
        parsed = urllib.parse.urlparse( self.path )
        if parsed.path == "/api/run-update":
            self._handle_run_update()
            return
        self.send_error( 404 )

    def _read_json_body( self ) -> dict:
        length = int( self.headers.get( "Content-Length", "0" ) )
        raw = self.rfile.read( length ) if length else b"{}"
        return json.loads( raw or b"{}" )

    def _send_json( self, payload: dict, status: int = 200 ) -> None:
        body = json.dumps( payload ).encode( "utf-8" )
        self.send_response( status )
        self.send_header( "Content-Type", "application/json" )
        self.send_header( "Content-Length", str( len( body ) ) )
        self.end_headers()
        self.wfile.write( body )

    def _handle_run_update( self ) -> None:
        try:
            data = self._read_json_body()
        except json.JSONDecodeError:
            self._send_json( { "ok": False, "error": "invalid JSON body" }, 400 )
            return

        item = data.get( "item", "" )
        doc_dir = DOCS_ROOT / item if item else None
        source = resolve_source_path( item ) if item else None

        if not item or source is None or not doc_dir.is_dir():
            self._send_json( { "ok": False, "error": f"unknown item '{item}'" }, 400 )
            return

        with _runs_lock:
            existing = _runs.get( item )
            if existing and existing[ "proc" ].poll() is None:
                self._send_json( { "ok": False, "error": "already running" }, 409 )
                return
            _runs[ item ] = _start_update_run( item )

        self._send_json( { "ok": True } )

    def _handle_run_update_status( self, parsed: urllib.parse.ParseResult ) -> None:
        item = urllib.parse.parse_qs( parsed.query ).get( "item", [ "" ] )[ 0 ]

        with _runs_lock:
            entry = _runs.get( item )
            if entry is None:
                self._send_json( { "running": False, "exit_code": None, "log_tail": "" } )
                return

            proc = entry[ "proc" ]
            exit_code = proc.poll()
            running = exit_code is None
            if not running and not entry[ "log_file" ].closed:
                entry[ "log_file" ].close()

        log_bytes = entry[ "log_path" ].read_bytes() if entry[ "log_path" ].exists() else b""
        log_tail = log_bytes[ -4000: ].decode( "utf-8", errors="replace" )

        self._send_json( { "running": running, "exit_code": exit_code, "log_tail": log_tail } )

    def _handle_git_status( self, parsed: urllib.parse.ParseResult ) -> None:
        item = urllib.parse.parse_qs( parsed.query ).get( "item", [ "" ] )[ 0 ]
        source = resolve_source_path( item ) if item else None

        exists = bool( source and source.exists() )
        git_dirty = False
        missing = False
        if exists:
            # catherine_agent_sdk/ is its own repo, separate from agent_blocks/
            # -- ask git to find the right root per file rather than assuming
            # REPO_ROOT, so this works no matter which repo the file lives in.
            toplevel = subprocess.run(
                [ "git", "-C", str( source.parent ), "rev-parse", "--show-toplevel" ],
                capture_output=True,
                text=True,
                check=False,
            )
            git_root = toplevel.stdout.strip()
            if git_root:
                result = subprocess.run(
                    [ "git", "-C", git_root, "status", "--porcelain", "--", str( source ) ],
                    capture_output=True,
                    text=True,
                    check=False,
                )
                git_dirty = bool( result.stdout.strip() )

            missing = docs_missing( DOCS_ROOT / item )

        self._send_json( {
            "item": item,
            "exists": exists,
            "dirty": git_dirty or missing,
            "docs_missing": missing,
        } )

    def log_message( self, format: str, *args ) -> None:
        pass


def main() -> None:
    import sys

    port = int( sys.argv[ 1 ] ) if len( sys.argv ) > 1 else 8931
    server = ThreadingHTTPServer( ( "", port ), DocsRequestHandler )
    print( f"Serving spa_documentation on http://localhost:{port} (Ctrl+C to stop)" )
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
