#!/usr/bin/env python3
"""Chroma-key #00FF00 pose plates to RGBA."""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / "public" / "assets" / "heroes"


def key_green(src: Path, dest: Path) -> None:
    im = Image.open(src).convert("RGBA")
    arr = np.asarray(im).copy()
    rgb = arr[:, :, :3].astype(np.float32)
    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    dominate = g - np.maximum(r, b)
    drop = np.clip((dominate - 16.0) / 36.0, 0.0, 1.0)
    alpha = np.clip(255.0 * (1.0 - drop), 0, 255).astype(np.uint8)
    # kill leftover green spill on the fringe
    spill = drop > 0.12
    rgb[spill, 1] = np.minimum(rgb[spill, 1], np.maximum(rgb[spill, 0], rgb[spill, 2]))
    arr[:, :, :3] = rgb.astype(np.uint8)
    arr[:, :, 3] = alpha
    dest.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(arr).save(dest, "PNG")
    print(f"{dest.name:28} a0={((alpha == 0).mean() * 100):5.1f}%")


def main() -> None:
    mapping = Path("/tmp/pose-green-map.txt")
    if not mapping.exists():
        raise SystemExit("missing /tmp/pose-green-map.txt")
    for line in mapping.read_text().splitlines():
        if not line.strip():
            continue
        src_s, dest_s = line.split()
        key_green(Path(src_s), ROOT / dest_s)


if __name__ == "__main__":
    main()
