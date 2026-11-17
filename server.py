#!/usr/bin/env python3
"""Serve the site and write layout edits back to data/*.json.

    python3 server.py

Then open http://localhost:8080
Drag pieces around and press save. The same numbers live in data/*.json,
so you can also change them in the editor and refresh.
Add ?edit=0 to preview without the editing chrome.
"""

import json
import os
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
os.chdir(ROOT)


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        path = self.path.split("?", 1)[0]
        if path == "/" or path.endswith((".html", ".json", ".js", ".css")):
            self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_POST(self):
        if self.path.split("?", 1)[0] != "/__save":
            self.send_error(404)
            return
        length = int(self.headers.get("Content-Length", "0"))
        try:
            payload = json.loads(self.rfile.read(length))
            rel = Path(payload["file"])
            if rel.is_absolute() or ".." in rel.parts or rel.parts[:1] != ("data",) or rel.suffix != ".json":
                raise ValueError("refusing to write outside data/*.json")
            target = ROOT / rel
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(json.dumps(payload["layout"], indent=2) + "\n", encoding="utf-8")
        except Exception as exc:
            body = str(exc).encode()
            self.send_response(400)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        body = b'{"ok":true}'
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(f"tyto  http://127.0.0.1:{port}")
    print("editing is on. preview with ?edit=0")
    print("save writes data/*.json")
    server.serve_forever()


if __name__ == "__main__":
    main()
