#!/usr/bin/env python3
"""Render the 日后 home-screen icon to PNG with stdlib only."""

from __future__ import annotations

import struct
import zlib
from pathlib import Path

INK = (0x0F, 0x14, 0x19)
CLAY = (0xE8, 0xA8, 0x7C)
PAPER = (0xF4, 0xED, 0xE4)

ROOT = Path(__file__).resolve().parents[1]


def write_png(path: Path, width: int, height: int, rgb: bytearray) -> None:
    def chunk(tag: bytes, data: bytes) -> bytes:
        crc = zlib.crc32(tag + data) & 0xFFFFFFFF
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", crc)

    raw = b"".join(b"\x00" + bytes(rgb[y * width * 3 : (y + 1) * width * 3]) for y in range(height))
    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 9))
    png += chunk(b"IEND", b"")
    path.write_bytes(png)


def sample(nx: float, ny: float) -> tuple[int, int, int]:
    sun_cx, sun_cy, sun_r = 0.5, 300 / 512, 158 / 512
    horizon = 300 / 512
    dx = nx - sun_cx
    dy = ny - sun_cy
    if dx * dx + dy * dy <= sun_r * sun_r and ny <= horizon:
        return CLAY

    line_y = 300 / 512
    half_h = 8 / 512
    x0, x1 = 86 / 512, 426 / 512
    cap_r = half_h
    if x0 <= nx <= x1 and abs(ny - line_y) <= half_h:
        return PAPER
    for cap_x in (x0, x1):
        cdx = nx - cap_x
        cdy = ny - line_y
        if cdx * cdx + cdy * cdy <= cap_r * cap_r:
            return PAPER
    return INK


def render(size: int, scale: int = 4) -> bytearray:
    big = size * scale
    acc_r = [0] * (size * size)
    acc_g = [0] * (size * size)
    acc_b = [0] * (size * size)
    for by in range(big):
        ny = (by + 0.5) / big
        row = (by // scale) * size
        for bx in range(big):
            nx = (bx + 0.5) / big
            r, g, b = sample(nx, ny)
            i = row + (bx // scale)
            acc_r[i] += r
            acc_g[i] += g
            acc_b[i] += b
    area = scale * scale
    out = bytearray(size * size * 3)
    for i in range(size * size):
        out[i * 3] = acc_r[i] // area
        out[i * 3 + 1] = acc_g[i] // area
        out[i * 3 + 2] = acc_b[i] // area
    return out


def main() -> None:
    for name, size in (("icon-512.png", 512), ("icon-192.png", 192), ("apple-touch-icon.png", 180)):
        write_png(ROOT / name, size, size, render(size))
        print(f"wrote {name} ({size}x{size})")


if __name__ == "__main__":
    main()
