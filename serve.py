#!/usr/bin/env python3
"""在本机打开日后。同一 Wi-Fi 下，iPhone Safari 访问打印出的地址即可。"""

from __future__ import annotations

import http.server
import socket
import socketserver
from pathlib import Path

PORT = 5173
ROOT = Path(__file__).resolve().parent


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)


def lan_ip() -> str:
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.connect(("8.8.8.8", 80))
        return sock.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        sock.close()


if __name__ == "__main__":
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("0.0.0.0", PORT), Handler) as httpd:
        ip = lan_ip()
        print(f"Mac 浏览器:     http://127.0.0.1:{PORT}")
        print(f"iPhone 同一 Wi-Fi: http://{ip}:{PORT}")
        print("iPhone：分享 → 添加到主屏幕，会更像 App。")
        print("Ctrl+C 结束")
        httpd.serve_forever()
