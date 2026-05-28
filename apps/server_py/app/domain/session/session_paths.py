from pathlib import Path

SERVER_PY_ROOT = Path(__file__).resolve().parents[3]
SESSIONS_DIR = SERVER_PY_ROOT.parent / "server" / "data" / "sessions"
