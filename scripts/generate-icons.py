#!/usr/bin/env python3
"""
Generate Thunder Load app icons from a single procedural master artwork.

Outputs:
- assets/icons/icon.png (1024x1024)
- assets/icons/thunder-logo.png (256x256)
- assets/icons/icon.ico (multi-size)
- assets/icons/macOS/icon.icns (via iconutil, if available)
- assets/icons/tray-logo.png (24x24)
- assets/icons/macOS/trayTemplate.png (22x22)
"""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
ICONS_DIR = ROOT / "assets" / "icons"
MACOS_DIR = ICONS_DIR / "macOS"
SOURCE_DIR = ICONS_DIR / "source"
ICONSET_DIR = ROOT / "build" / "icon.iconset"


def _vertical_gradient(size: int, top_rgba: tuple[int, int, int, int], bottom_rgba: tuple[int, int, int, int]) -> Image.Image:
    img = Image.new("RGBA", (size, size))
    px = img.load()
    for y in range(size):
        t = y / max(1, size - 1)
        rgba = tuple(int(top_rgba[i] * (1 - t) + bottom_rgba[i] * t) for i in range(4))
        for x in range(size):
            px[x, y] = rgba
    return img


def _rounded_mask(size: int, radius: int) -> Image.Image:
    mask = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=255)
    return mask


def create_master_icon(size: int = 1024) -> Image.Image:
    radius = int(size * 0.23)
    mask = _rounded_mask(size, radius)

    base = _vertical_gradient(size, (8, 34, 112, 255), (38, 146, 255, 255))
    vignette = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    dv = ImageDraw.Draw(vignette)
    dv.ellipse(
        (-int(size * 0.25), int(size * 0.55), int(size * 1.25), int(size * 1.55)),
        fill=(5, 20, 62, 125),
    )
    vignette = vignette.filter(ImageFilter.GaussianBlur(int(size * 0.09)))
    base = Image.alpha_composite(base, vignette)

    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.paste(base, (0, 0), mask)

    # Gloss highlight.
    gloss = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    dg = ImageDraw.Draw(gloss)
    dg.ellipse(
        (int(size * 0.07), -int(size * 0.36), int(size * 0.93), int(size * 0.58)),
        fill=(216, 237, 255, 134),
    )
    gloss = gloss.filter(ImageFilter.GaussianBlur(int(size * 0.06)))
    gloss.putalpha(ImageChops.multiply(gloss.split()[-1], mask))
    canvas = Image.alpha_composite(canvas, gloss)

    # Subtle inner stroke for sharper edge on dark backgrounds.
    stroke = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ds = ImageDraw.Draw(stroke)
    inset = int(size * 0.015)
    ds.rounded_rectangle(
        (inset, inset, size - 1 - inset, size - 1 - inset),
        radius=radius - inset,
        outline=(228, 244, 255, 68),
        width=max(2, size // 128),
    )
    stroke.putalpha(ImageChops.multiply(stroke.split()[-1], mask))
    canvas = Image.alpha_composite(canvas, stroke)

    symbol = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(symbol)

    cross_w = int(size * 0.34)
    cross_h = int(size * 0.12)
    cross_x = int((size - cross_w) / 2)
    cross_y = int(size * 0.24)
    stem_w = int(size * 0.13)
    stem_h = int(size * 0.41)
    stem_x = int((size - stem_w) / 2)
    stem_y = int(size * 0.33)
    corner = max(4, int(size * 0.03))
    d.rounded_rectangle(
        (cross_x, cross_y, cross_x + cross_w, cross_y + cross_h),
        radius=corner,
        fill=(255, 255, 255, 255),
    )
    d.rounded_rectangle(
        (stem_x, stem_y, stem_x + stem_w, stem_y + stem_h),
        radius=corner,
        fill=(255, 255, 255, 255),
    )

    # Soft glow under symbol to support glossy style.
    glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    dg2 = ImageDraw.Draw(glow)
    dg2.rounded_rectangle(
        (cross_x, cross_y, cross_x + cross_w, cross_y + cross_h),
        radius=corner,
        fill=(160, 226, 255, 155),
    )
    dg2.rounded_rectangle(
        (stem_x, stem_y, stem_x + stem_w, stem_y + stem_h),
        radius=corner,
        fill=(160, 226, 255, 155),
    )
    glow = glow.filter(ImageFilter.GaussianBlur(int(size * 0.03)))
    canvas = Image.alpha_composite(canvas, glow)
    canvas = Image.alpha_composite(canvas, symbol)
    return canvas


def create_tray_icon(size: int = 24) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    pad = max(1, size // 12)
    d.rounded_rectangle(
        (pad, pad, size - 1 - pad, size - 1 - pad),
        radius=max(2, size // 5),
        fill=(19, 93, 208, 255),
    )
    cross_w = int(size * 0.58)
    cross_h = int(size * 0.19)
    cross_x = int((size - cross_w) / 2)
    cross_y = int(size * 0.17)
    stem_w = int(size * 0.22)
    stem_h = int(size * 0.53)
    stem_x = int((size - stem_w) / 2)
    stem_y = int(size * 0.33)
    corner = max(1, size // 14)
    d.rounded_rectangle(
        (cross_x, cross_y, cross_x + cross_w, cross_y + cross_h),
        radius=corner,
        fill=(255, 255, 255, 255),
    )
    d.rounded_rectangle(
        (stem_x, stem_y, stem_x + stem_w, stem_y + stem_h),
        radius=corner,
        fill=(255, 255, 255, 255),
    )
    return img


def create_macos_tray_template(size: int = 22) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    color = (0, 0, 0, 255)
    cross_w = int(size * 0.60)
    cross_h = int(size * 0.20)
    cross_x = int((size - cross_w) / 2)
    cross_y = int(size * 0.16)
    stem_w = int(size * 0.24)
    stem_h = int(size * 0.56)
    stem_x = int((size - stem_w) / 2)
    stem_y = int(size * 0.33)
    corner = max(1, size // 12)
    d.rounded_rectangle(
        (cross_x, cross_y, cross_x + cross_w, cross_y + cross_h),
        radius=corner,
        fill=color,
    )
    d.rounded_rectangle(
        (stem_x, stem_y, stem_x + stem_w, stem_y + stem_h),
        radius=corner,
        fill=color,
    )
    return img


def _base_card_icon(size: int, top: tuple[int, int, int, int], bottom: tuple[int, int, int, int]) -> Image.Image:
    radius = max(2, int(size * 0.22))
    base = _vertical_gradient(size, top, bottom)
    mask = _rounded_mask(size, radius)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(base, (0, 0), mask)

    gloss = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(gloss)
    d.ellipse(
        (int(size * 0.08), -int(size * 0.34), int(size * 0.92), int(size * 0.56)),
        fill=(216, 237, 255, 128),
    )
    gloss = gloss.filter(ImageFilter.GaussianBlur(max(1, int(size * 0.06))))
    gloss.putalpha(ImageChops.multiply(gloss.split()[-1], mask))
    out = Image.alpha_composite(out, gloss)
    return out


def _draw_icon_check(d: ImageDraw.ImageDraw, size: int, color: tuple[int, int, int, int]) -> None:
    d.line(
        (int(size * 0.30), int(size * 0.55), int(size * 0.46), int(size * 0.70)),
        fill=color,
        width=max(2, int(size * 0.10)),
        joint="curve",
    )
    d.line(
        (int(size * 0.46), int(size * 0.70), int(size * 0.74), int(size * 0.36)),
        fill=color,
        width=max(2, int(size * 0.10)),
        joint="curve",
    )


def _draw_icon_cross(d: ImageDraw.ImageDraw, size: int, color: tuple[int, int, int, int]) -> None:
    w = max(2, int(size * 0.10))
    d.line((int(size * 0.32), int(size * 0.32), int(size * 0.68), int(size * 0.68)), fill=color, width=w)
    d.line((int(size * 0.68), int(size * 0.32), int(size * 0.32), int(size * 0.68)), fill=color, width=w)


def _draw_icon_logout(d: ImageDraw.ImageDraw, size: int, color: tuple[int, int, int, int]) -> None:
    w = max(1, size // 8)
    d.rounded_rectangle(
        (int(size * 0.18), int(size * 0.22), int(size * 0.50), int(size * 0.78)),
        radius=max(1, size // 10),
        outline=color,
        width=w,
    )
    d.line((int(size * 0.44), int(size * 0.50), int(size * 0.78), int(size * 0.50)), fill=color, width=w)
    d.polygon(
        [
            (int(size * 0.64), int(size * 0.35)),
            (int(size * 0.84), int(size * 0.50)),
            (int(size * 0.64), int(size * 0.65)),
        ],
        fill=color,
    )


def _draw_icon_folder(d: ImageDraw.ImageDraw, size: int, color: tuple[int, int, int, int]) -> None:
    d.rounded_rectangle(
        (int(size * 0.14), int(size * 0.34), int(size * 0.86), int(size * 0.80)),
        radius=max(1, size // 10),
        fill=color,
    )
    d.rounded_rectangle(
        (int(size * 0.20), int(size * 0.22), int(size * 0.52), int(size * 0.40)),
        radius=max(1, size // 12),
        fill=color,
    )


def _draw_icon_settings(d: ImageDraw.ImageDraw, size: int, color: tuple[int, int, int, int]) -> None:
    cx = cy = size // 2
    r_outer = int(size * 0.33)
    r_inner = int(size * 0.14)
    spoke_w = max(1, size // 9)
    for i in range(8):
        angle = i * 45
        from math import cos, radians, sin

        x1 = int(cx + cos(radians(angle)) * int(size * 0.21))
        y1 = int(cy + sin(radians(angle)) * int(size * 0.21))
        x2 = int(cx + cos(radians(angle)) * r_outer)
        y2 = int(cy + sin(radians(angle)) * r_outer)
        d.line((x1, y1, x2, y2), fill=color, width=spoke_w)
    d.ellipse((cx - r_outer + 2, cy - r_outer + 2, cx + r_outer - 2, cy + r_outer - 2), outline=color, width=max(1, size // 10))
    d.ellipse((cx - r_inner, cy - r_inner, cx + r_inner, cy + r_inner), fill=color)


def _draw_icon_video(d: ImageDraw.ImageDraw, size: int, color: tuple[int, int, int, int]) -> None:
    d.rounded_rectangle(
        (int(size * 0.14), int(size * 0.26), int(size * 0.70), int(size * 0.74)),
        radius=max(1, size // 10),
        outline=color,
        width=max(1, size // 8),
    )
    d.polygon(
        [
            (int(size * 0.38), int(size * 0.39)),
            (int(size * 0.38), int(size * 0.61)),
            (int(size * 0.56), int(size * 0.50)),
        ],
        fill=color,
    )
    d.polygon(
        [
            (int(size * 0.70), int(size * 0.40)),
            (int(size * 0.90), int(size * 0.30)),
            (int(size * 0.90), int(size * 0.70)),
            (int(size * 0.70), int(size * 0.60)),
        ],
        fill=color,
    )


def generate_auxiliary_png_icons() -> None:
    # Notification icons (256x256).
    done = _base_card_icon(256, (8, 34, 112, 255), (38, 146, 255, 255))
    d_done = ImageDraw.Draw(done)
    _draw_icon_check(d_done, 256, (231, 247, 255, 255))
    done.save(ICONS_DIR / "info-done.png")

    err = _base_card_icon(256, (86, 19, 34, 255), (220, 56, 88, 255))
    d_err = ImageDraw.Draw(err)
    _draw_icon_cross(d_err, 256, (255, 240, 245, 255))
    err.save(ICONS_DIR / "info-error.png")

    # Small tray/menu icons (16x16).
    small_specs = [
        ("logout.png", _draw_icon_logout),
        ("open-folder.png", _draw_icon_folder),
        ("settings.png", _draw_icon_settings),
        ("video.png", _draw_icon_video),
    ]
    for filename, painter in small_specs:
        icon = _base_card_icon(16, (10, 40, 118, 255), (36, 139, 246, 255))
        dr = ImageDraw.Draw(icon)
        painter(dr, 16, (235, 247, 255, 255))
        icon.save(ICONS_DIR / filename)


def generate_icns(master: Image.Image) -> None:
    ICONSET_DIR.mkdir(parents=True, exist_ok=True)
    size_map = {
        "icon_16x16.png": 16,
        "icon_16x16@2x.png": 32,
        "icon_32x32.png": 32,
        "icon_32x32@2x.png": 64,
        "icon_128x128.png": 128,
        "icon_128x128@2x.png": 256,
        "icon_256x256.png": 256,
        "icon_256x256@2x.png": 512,
        "icon_512x512.png": 512,
        "icon_512x512@2x.png": 1024,
    }
    for filename, size in size_map.items():
        master.resize((size, size), Image.Resampling.LANCZOS).save(ICONSET_DIR / filename)

    iconutil = shutil.which("iconutil")
    if not iconutil:
        raise RuntimeError("iconutil not found; cannot generate macOS icon.icns")

    subprocess.run(
        [iconutil, "-c", "icns", str(ICONSET_DIR), "-o", str(MACOS_DIR / "icon.icns")],
        check=True,
    )


def main() -> None:
    ICONS_DIR.mkdir(parents=True, exist_ok=True)
    MACOS_DIR.mkdir(parents=True, exist_ok=True)
    SOURCE_DIR.mkdir(parents=True, exist_ok=True)

    master = create_master_icon(1024)
    master.save(ICONS_DIR / "icon.png")

    master.resize((256, 256), Image.Resampling.LANCZOS).save(ICONS_DIR / "thunder-logo.png")

    # Windows ICO includes several resolutions for best shell scaling.
    master.save(
        ICONS_DIR / "icon.ico",
        format="ICO",
        sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )

    generate_icns(master)

    create_tray_icon(24).save(ICONS_DIR / "tray-logo.png")
    create_macos_tray_template(22).save(MACOS_DIR / "trayTemplate.png")
    generate_auxiliary_png_icons()

    print("Icons generated successfully.")


if __name__ == "__main__":
    main()
