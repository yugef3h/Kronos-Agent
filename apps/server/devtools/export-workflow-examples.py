#!/usr/bin/env python3
"""从 Chrome localStorage LevelDB 导出工作流应用到 apps/server/data/workflow-examples/"""

from __future__ import annotations

import json
import shutil
from pathlib import Path

SERVER_ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = SERVER_ROOT / "data/workflow-examples"
PREVIEW_SRC = SERVER_ROOT / "data/workflow-draft-previews"
PREVIEW_DST = OUT_DIR / "previews"
KEY = b"kronos_workflow_apps_v1"
CHROME_LEVELDB = Path.home() / "Library/Application Support/Google/Chrome/Default/Local Storage/leveldb"


def parse_utf16_json_array(raw: bytes, idx: int) -> list | None:
    p = idx + len(KEY)
    while p < len(raw) - 1 and raw[p : p + 2] != b"[\x00":
        p += 1
    if p >= len(raw) - 1:
        return None
    depth = 0
    i = p
    while i + 1 < len(raw):
        ch = raw[i : i + 2].decode("utf-16-le")
        if ch == "[":
            depth += 1
        elif ch == "]":
            depth -= 1
            i += 2
            if depth == 0:
                break
        i += 2
    text = raw[p:i].decode("utf-16-le")
    return json.loads(text)


def load_apps() -> list:
    if not CHROME_LEVELDB.is_dir():
        raise SystemExit(f"Chrome leveldb not found: {CHROME_LEVELDB}")
    for ldb in sorted(CHROME_LEVELDB.glob("*.ldb"), key=lambda p: p.stat().st_mtime, reverse=True):
        raw = ldb.read_bytes()
        idx = raw.find(KEY)
        if idx < 0:
            continue
        try:
            apps = parse_utf16_json_array(raw, idx)
            if apps:
                print(f"parsed from {ldb.name}: {len(apps)} apps")
                return apps
        except Exception as err:
            print(f"skip {ldb.name}: {err}")
    raise SystemExit("kronos_workflow_apps_v1 not found in Chrome leveldb")


def main() -> None:
    apps = load_apps()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    PREVIEW_DST.mkdir(parents=True, exist_ok=True)

    for app in apps:
        app_id = app["id"]
        path = OUT_DIR / f"{app_id}.json"
        path.write_text(json.dumps(app, ensure_ascii=False, indent=2), encoding="utf-8")
        print("wrote", path.name)

        src_file = PREVIEW_SRC / f"{app_id}.jpg"
        if src_file.is_file():
            shutil.copy2(src_file, PREVIEW_DST / f"{app_id}.jpg")
            print("preview", app_id)

    print(f"done: {len(apps)} example apps -> {OUT_DIR}")


if __name__ == "__main__":
    main()
