#!/usr/bin/env python3
"""
Open Emulator - Servidor local ligero para PC, Lenovo Tab 11 y Mandos Remotos (1-4 jugadores).
- Sirve la PWA en toda la red local (Wi-Fi) y via tunel HTTPS.
- Expone /api/roms para detectar automaticamente los juegos en la carpeta roms/.
- Puente en tiempo real (SSE + POST) para usar celulares/tablets como mandos J1-J4.
"""

import http.server
import json
import mimetypes
import os
import queue
import socket
import socketserver
import threading
import time
import urllib.parse
from pathlib import Path

PORT = int(os.environ.get("PORT", "8080"))
ROOT_DIR = Path(__file__).resolve().parent
ROMS_DIR = ROOT_DIR / "roms"

SUPPORTED_EXTENSIONS = {
    ".sfc", ".smc", ".fig", ".swc",
    ".nes", ".fds", ".unif", ".unf",
    ".gba", ".gb", ".gbc",
    ".n64", ".z64", ".v64",
    ".nds",
    ".md", ".gen", ".smd",
    ".sms", ".gg",
    ".chd", ".pbp", ".cue", ".iso",
    ".zip", ".7z",
}

mimetypes.add_type("application/manifest+json", ".webmanifest")
mimetypes.add_type("application/javascript", ".js")
mimetypes.add_type("image/svg+xml", ".svg")
mimetypes.add_type("application/wasm", ".wasm")

# --- Real-time Remote Controller Hub (SSE) ---
_sse_lock = threading.Lock()
_sse_clients: list[queue.Queue] = []
_active_players: dict[int, float] = {}  # player_index (0..3) -> last_seen timestamp


def _broadcast_remote(payload: dict):
    data = json.dumps(payload, separators=(",", ":"))
    with _sse_lock:
        dead = []
        for q in _sse_clients:
            try:
                q.put_nowait(data)
            except queue.Full:
                dead.append(q)
        for q in dead:
            _sse_clients.remove(q)


def _get_connected_players() -> list[int]:
    now = time.time()
    with _sse_lock:
        stale = [p for p, ts in _active_players.items() if now - ts > 15]
        for p in stale:
            del _active_players[p]
        return sorted(_active_players.keys())


def get_local_ips() -> list[str]:
    ips = set()
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            ips.add(s.getsockname()[0])
    except OSError:
        pass

    try:
        hostname = socket.gethostname()
        for info in socket.getaddrinfo(hostname, None, socket.AF_INET):
            ip = info[4][0]
            if not ip.startswith("127."):
                ips.add(ip)
    except OSError:
        pass

    return sorted(ips)


def scan_roms() -> list[dict]:
    if not ROMS_DIR.exists():
        return []

    found = []
    for path in sorted(ROMS_DIR.rglob("*")):
        if not path.is_file():
            continue
        ext = path.suffix.lower()
        if ext not in SUPPORTED_EXTENSIONS:
            continue
        rel = path.relative_to(ROMS_DIR).as_posix()
        stat = path.stat()
        found.append({
            "name": path.stem,
            "filename": path.name,
            "ext": ext,
            "size": stat.st_size,
            "url": "/roms/" + urllib.parse.quote(rel),
            "folder": path.parent.relative_to(ROMS_DIR).as_posix() if path.parent != ROMS_DIR else "",
        })
    return found


class OpenEmulatorHandler(http.server.SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT_DIR), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Content-Length", "0")
        self.end_headers()

    def _send_json(self, obj: dict, status: int = 200):
        payload = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)

        if parsed.path == "/api/roms":
            self._send_json({"roms": scan_roms()})
            return

        if parsed.path == "/api/health":
            self._send_json({"status": "ok", "ips": get_local_ips(), "port": PORT})
            return

        if parsed.path == "/api/remote/players":
            self._send_json({"players": _get_connected_players()})
            return

        if parsed.path == "/api/remote/stream":
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Connection", "keep-alive")
            self.send_header("X-Accel-Buffering", "no")
            self.end_headers()

            client_q: queue.Queue = queue.Queue(maxsize=256)
            with _sse_lock:
                _sse_clients.append(client_q)

            try:
                init_msg = json.dumps({"type": "players", "players": _get_connected_players()})
                self.wfile.write(f"data: {init_msg}\n\n".encode("utf-8"))
                self.wfile.flush()

                while True:
                    try:
                        msg = client_q.get(timeout=12)
                        self.wfile.write(f"data: {msg}\n\n".encode("utf-8"))
                        self.wfile.flush()
                    except queue.Empty:
                        # Keep-alive comment so tunnels/proxies don't drop SSE
                        self.wfile.write(b": ping\n\n")
                        self.wfile.flush()
            except (BrokenPipeError, ConnectionResetError, OSError):
                pass
            finally:
                with _sse_lock:
                    if client_q in _sse_clients:
                        _sse_clients.remove(client_q)
            return

        super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path not in ("/api/remote/input", "/api/remote/ping"):
            self._send_json({"error": "not_found"}, 404)
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
            raw = self.rfile.read(length) if length > 0 else b"{}"
            body = json.loads(raw.decode("utf-8"))
        except Exception:
            self._send_json({"error": "invalid_json"}, 400)
            return

        player = int(body.get("player", 0))
        if 0 <= player <= 3:
            with _sse_lock:
                is_new = player not in _active_players
                _active_players[player] = time.time()
            if is_new:
                _broadcast_remote({"type": "players", "players": _get_connected_players()})

        if parsed.path == "/api/remote/input":
            events = body.get("events")
            if isinstance(events, list) and events:
                _broadcast_remote({"type": "input", "player": player, "events": events})

        self._send_json({"ok": True})

    def log_message(self, format, *args):
        msg = format % args
        if "/api/roms" in msg or "GET / " in msg or "controller.html" in msg:
            print(f"[OpenEmulator] {self.address_string()} - {msg}")


class ThreadedTCPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True
    daemon_threads = True


def main():
    ROMS_DIR.mkdir(exist_ok=True)
    ips = get_local_ips()

    with ThreadedTCPServer(("0.0.0.0", PORT), OpenEmulatorHandler) as httpd:
        print("\n" + "=" * 62)
        print("  OPEN EMULATOR listo para PC, Lenovo Tab 11 y Mandos Remotos")
        print("=" * 62)
        print(f"  En esta PC:         http://localhost:{PORT}")
        print(f"  Mandos en celular:  http://localhost:{PORT}/controller.html")
        if ips:
            for ip in ips:
                print(f"  En red local:       http://{ip}:{PORT}")
        print("-" * 62)
        print(f"  Carpeta de ROMs:    {ROMS_DIR}")
        print(f"  ROMs detectados:    {len(scan_roms())}")
        print("  Presiona Ctrl+C para detener el servidor.")
        print("=" * 62 + "\n")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServidor detenido. Hasta la proxima partida!")


if __name__ == "__main__":
    main()
