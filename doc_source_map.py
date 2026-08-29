"""Maps a spa_documentation item path to its real .py source file in
agent_blocks. Shared by update_documentation_agent.py and server.py -- kept
dependency-free (stdlib only) so server.py doesn't need the claude_agent_sdk
venv just to serve static files.
"""
import re
from pathlib import Path

REPO_ROOT = Path( __file__ ).resolve().parent.parent
DOCS_ROOT = Path( __file__ ).resolve().parent

_SAFE_PART = re.compile( r"^[A-Za-z0-9_]+$" )

# Every item folder uses these same fixed basenames (see
# catherine_agent_sdk/basic_agent and .../future_agent) -- kept alongside
# resolve_source_path since both update_documentation_agent.py and
# server.py need to know which files make up an item's docs.
DOC_FILES = {
    "overview": "basic_agent.html",
    "source": "basic_agent.py.html",
    "class_diagram": "mermaid_class.html",
    "sequence_diagram": "mermaid_sequence.html",
    "construction_status": "basic_agent_construction_status.html",
    "report": "basic_agent_update_documentation.html",
}

# The subset of DOC_FILES that actually needs to reflect the source file's
# current content -- used to decide whether docs are stale/missing. overview,
# construction_status, and report are hand/agent-authored status text, not
# generated-from-source content (overview is empty even on the fully-built
# catherine_agent_sdk/basic_agent reference item), so they're excluded.
SOURCE_DERIVED_DOCS = ( "source", "class_diagram", "sequence_diagram" )

VOICE_COMMUNICATION_SOURCE_FILES = {
    "interfaces": "interfaces/index.ts",
    "typescript_contracts": "typescript_contracts/contracts.ts",
    "pydantic_models": "pydantic_models/models.py",
    "voice_session": "voice_session/voice_session.ts",
    "conversation_agent": "conversation_agent/conversation_agent.ts",
    "spoken_output_policy": "spoken_output_policy/spoken_output_policy.ts",
    "conversation_coordinator": "conversation_coordinator/conversation_coordinator.ts",
    "letta_agent_adapter": "letta_agent_adapter/letta_agent_adapter.ts",
    "audio_capture": "audio_capture/audio_capture.py",
    "transcription_strategy": "transcription_strategy/transcription_strategy.py",
    "route_strategy": "route_strategy/route_strategy.ts",
    "speech_synthesizer": "speech_synthesizer/speech_synthesizer.py",
    "note_command_channel": "note_command_channel/note_command_channel.ts",
    "detection_interface": "detection_interface/detection_interface.py",
    "language_processor": "language_processor/language_processor.ts",
    "design_protocol": "design_protocol/design_protocol.ts",
    "pipecat_service_client": "pipecat_service_client/pipecat_service_client.ts",
    "pipecat_local_service": "pipecat_local_service/pipecat_local_service.py",
    "pipeline_factory": "pipeline_factory/pipeline_factory.py",
    "toyota_voice_application": "toyota_voice_application/toyota_voice_application.ts",
    "voice_health_observer": "voice_health_observer/voice_health_observer.ts",
}


def docs_missing( doc_dir: Path ) -> bool:
    """True if any source-derived doc file is missing or empty."""
    return any(
        not ( doc_dir / DOC_FILES[ key ] ).exists() or ( doc_dir / DOC_FILES[ key ] ).stat().st_size == 0
        for key in SOURCE_DERIVED_DOCS
    )


def resolve_source_path( item_path: str ) -> Path | None:
    """Docs path -> real source .py path, or None if unmapped/invalid.

    Not fully mechanical -- catherine_agent_sdk items sit directly under
    catherine_agent_sdk/, while lancedb_memory items sit under
    lancedb_memory/agent_memory/ (with adapters/ and observers/ one level
    deeper). Every path segment is validated against _SAFE_PART first since
    item_path can arrive from an untrusted query string (server.py's
    /api/git-status endpoint) -- rejects anything with "/", "..", etc.
    """
    parts = item_path.strip( "/" ).split( "/" )
    if not parts or not all( _SAFE_PART.match( part ) for part in parts ):
        return None

    section, rest = parts[ 0 ], parts[ 1: ]

    if section == "catherine_agent_sdk" and len( rest ) == 1:
        return REPO_ROOT / "catherine_agent_sdk" / f"{rest[ 0 ]}.py"

    if section == "lancedb_memory":
        base = REPO_ROOT / "lancedb_memory" / "agent_memory"
        if len( rest ) == 2 and rest[ 0 ] in ( "adapters", "observers" ):
            return base / rest[ 0 ] / f"{rest[ 1 ]}.py"
        # models/ used to be one shared models.py (every models/* item pointed
        # at the same file); it's since been split into a models/ package with
        # one file per Pydantic class, so it now resolves the same way
        # adapters/observers do.
        if len( rest ) == 2 and rest[ 0 ] == "models":
            return base / "models" / f"{rest[ 1 ]}.py"
        if len( rest ) == 1:
            return base / f"{rest[ 0 ]}.py"

    if section == "voice_communication" and len( rest ) == 1:
        source_name = VOICE_COMMUNICATION_SOURCE_FILES.get( rest[ 0 ] )
        if source_name:
            return REPO_ROOT / "voice_communication" / source_name

    if section == "solid_agent_systems" and len( rest ) == 1:
        return REPO_ROOT / "solid_agent_systems" / rest[ 0 ] / "src" / f"{rest[ 0 ]}.py"

    return None
