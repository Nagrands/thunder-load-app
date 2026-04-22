#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageOps


ROOT = Path(__file__).resolve().parents[1]
ICONS_DIR = ROOT / "assets" / "icons"
APP_DIR = ICONS_DIR / "app"
TRAY_DIR = ICONS_DIR / "tray"
MACOS_DIR = ICONS_DIR / "platform" / "macos"
ICONSET_DIR = MACOS_DIR / "app.iconset"

APP_ICON_SIZE = 1024
ICONSET_SPECS = [
    ("icon_16x16.png", 16),
    ("icon_16x16@2x.png", 32),
    ("icon_32x32.png", 32),
    ("icon_32x32@2x.png", 64),
    ("icon_128x128.png", 128),
    ("icon_128x128@2x.png", 256),
    ("icon_256x256.png", 256),
    ("icon_256x256@2x.png", 512),
    ("icon_512x512.png", 512),
    ("icon_512x512@2x.png", 1024),
]
ICO_SIZES = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]


def rounded_mask(size: int, radius: int) -> Image.Image:
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=255)
    return mask


def fit_bbox(bbox: tuple[int, int, int, int], size: int) -> tuple[int, int, int, int]:
    x0, y0, x1, y1 = bbox
    return (
        int(round(x0 * size / APP_ICON_SIZE)),
        int(round(y0 * size / APP_ICON_SIZE)),
        int(round(x1 * size / APP_ICON_SIZE)),
        int(round(y1 * size / APP_ICON_SIZE)),
    )


def make_vertical_gradient(size: tuple[int, int], top: str, bottom: str) -> Image.Image:
    gradient = Image.linear_gradient("L").resize(size)
    return ImageOps.colorize(gradient, top, bottom).convert("RGBA")


def glow(size: int, color: tuple[int, int, int, int], bbox: tuple[int, int, int, int], blur: int) -> Image.Image:
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    draw.ellipse(fit_bbox(bbox, size), fill=color)
    return layer.filter(ImageFilter.GaussianBlur(max(1, int(round(blur * size / APP_ICON_SIZE)))))


def add_tile_background(canvas: Image.Image, size: int) -> None:
    tile = make_vertical_gradient((size, size), "#101c34", "#060914")
    tile = Image.alpha_composite(
        tile,
        glow(size, (44, 167, 255, 105), (50, 90, 490, 760), 105),
    )
    tile = Image.alpha_composite(
        tile,
        glow(size, (255, 167, 65, 98), (520, 120, 970, 780), 115),
    )
    tile = Image.alpha_composite(
        tile,
        glow(size, (255, 255, 255, 24), (300, 60, 760, 420), 120),
    )

    vignette = Image.radial_gradient("L").resize((size, size))
    vignette = ImageOps.invert(vignette)
    vignette = ImageOps.colorize(vignette, "#000000", "#000000").convert("RGBA")
    vignette.putalpha(ImageOps.autocontrast(vignette.convert("L")).point(lambda p: int(p * 0.38)))
    tile = Image.alpha_composite(tile, vignette)

    margin = int(round(size * 0.07))
    radius = int(round(size * 0.23))
    mask = Image.new("L", (size, size), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rounded_rectangle(
        (margin, margin, size - margin, size - margin),
        radius=radius,
        fill=255,
    )

    border = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    border_draw = ImageDraw.Draw(border)
    border_draw.rounded_rectangle(
        (margin, margin, size - margin - 1, size - margin - 1),
        radius=radius,
        outline=(255, 255, 255, 58),
        width=max(2, size // 160),
    )

    inner_shadow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    inner_draw = ImageDraw.Draw(inner_shadow)
    inner_draw.rounded_rectangle(
        (margin + int(size * 0.018), margin + int(size * 0.018), size - margin - int(size * 0.018), size - margin - int(size * 0.018)),
        radius=max(1, radius - int(size * 0.018)),
        outline=(255, 255, 255, 22),
        width=max(1, size // 256),
    )

    clipped = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    clipped.paste(tile, (0, 0), mask)
    clipped = Image.alpha_composite(clipped, border)
    clipped = Image.alpha_composite(clipped, inner_shadow)
    canvas.alpha_composite(clipped)


def cloud_mask(size: int) -> Image.Image:
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    parts = [
        (210, 318, 410, 550),
        (315, 226, 590, 520),
        (520, 314, 750, 548),
        (600, 356, 820, 560),
        (260, 408, 760, 628),
    ]
    for part in parts:
        draw.ellipse(fit_bbox(part, size), fill=255)
    draw.rounded_rectangle(
        fit_bbox((250, 400, 780, 610), size),
        radius=max(6, size // 12),
        fill=255,
    )
    return mask.filter(ImageFilter.GaussianBlur(max(1, size // 256)))


def render_cloud(size: int) -> Image.Image:
    mask = cloud_mask(size)
    cloud = make_vertical_gradient((size, size), "#f2f6ff", "#7d8ba7")
    cool_light = glow(size, (118, 208, 255, 88), (150, 220, 510, 620), 58)
    warm_light = glow(size, (255, 196, 118, 78), (500, 240, 880, 640), 64)
    cloud = Image.alpha_composite(cloud, cool_light)
    cloud = Image.alpha_composite(cloud, warm_light)

    shade = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(shade)
    draw.rounded_rectangle(
        fit_bbox((220, 430, 790, 660), size),
        radius=max(8, size // 10),
        fill=(17, 24, 39, 92),
    )
    shade = shade.filter(ImageFilter.GaussianBlur(max(1, size // 48)))
    cloud = Image.alpha_composite(cloud, shade)

    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(cloud, (0, 0), mask)
    return out


def render_cloud_shadow(size: int) -> Image.Image:
    shadow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    shadow_draw.ellipse(
        fit_bbox((190, 310, 820, 640), size),
        fill=(3, 6, 16, 185),
    )
    return shadow.filter(ImageFilter.GaussianBlur(max(1, size // 28)))


def bolt_points(size: int) -> list[tuple[int, int]]:
    points = [
        (560, 168),
        (427, 400),
        (537, 400),
        (402, 778),
        (642, 474),
        (512, 474),
        (645, 184),
    ]
    return [(int(round(x * size / APP_ICON_SIZE)), int(round(y * size / APP_ICON_SIZE))) for x, y in points]


def render_bolt(size: int) -> Image.Image:
    points = bolt_points(size)
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).polygon(points, fill=255)

    bolt = make_vertical_gradient((size, size), "#fff4a8", "#f59e0b")
    warmth = glow(size, (255, 145, 31, 105), (360, 120, 740, 810), 48)
    bolt = Image.alpha_composite(bolt, warmth)

    highlight = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(highlight)
    highlight_points = [
        (536, 208),
        (462, 372),
        (530, 372),
        (454, 600),
        (589, 430),
        (520, 430),
        (598, 208),
    ]
    scaled = [(int(round(x * size / APP_ICON_SIZE)), int(round(y * size / APP_ICON_SIZE))) for x, y in highlight_points]
    draw.polygon(scaled, fill=(255, 252, 228, 94))
    highlight = highlight.filter(ImageFilter.GaussianBlur(max(1, size // 96)))
    bolt = Image.alpha_composite(bolt, highlight)

    outline = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    outline_draw = ImageDraw.Draw(outline)
    outline_draw.polygon(
        points,
        outline=(74, 28, 6, 210),
        width=max(2, size // 64),
    )

    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(bolt, (0, 0), mask)
    out = Image.alpha_composite(out, outline)
    return out


def create_app_icon(size: int = APP_ICON_SIZE) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    add_tile_background(canvas, size)

    canvas.alpha_composite(render_cloud_shadow(size))
    canvas.alpha_composite(render_cloud(size))

    bolt_glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(bolt_glow).polygon(
        bolt_points(size),
        fill=(255, 170, 44, 95),
    )
    bolt_glow = bolt_glow.filter(ImageFilter.GaussianBlur(max(1, size // 42)))
    canvas.alpha_composite(bolt_glow)
    canvas.alpha_composite(render_bolt(size))
    return canvas


def create_windows_tray_icon(size: int = 24) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    shadow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(shadow)
    draw.rounded_rectangle((1, 5, size - 2, size - 6), radius=6, fill=(7, 14, 30, 170))
    shadow = shadow.filter(ImageFilter.GaussianBlur(2))
    canvas.alpha_composite(shadow)

    cloud = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(cloud)
    draw.ellipse((3, 8, 11, 16), fill=(104, 213, 255, 255))
    draw.ellipse((8, 5, 17, 15), fill=(198, 235, 255, 255))
    draw.ellipse((14, 8, 21, 16), fill=(255, 187, 116, 250))
    draw.rounded_rectangle((4, 10, 20, 17), radius=4, fill=(154, 207, 245, 250))
    canvas.alpha_composite(cloud)

    bolt = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(bolt)
    points = [(13, 4), (10, 10), (13, 10), (9, 20), (17, 11), (14, 11), (17, 4)]
    draw.polygon(points, fill=(255, 184, 39, 255), outline=(143, 73, 11, 230))
    canvas.alpha_composite(bolt)
    return canvas


def create_macos_template(size: int = 22) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    cloud_fill = (0, 0, 0, 255)
    draw.ellipse((2, 8, 9, 15), fill=cloud_fill)
    draw.ellipse((6, 5, 14, 14), fill=cloud_fill)
    draw.ellipse((12, 8, 20, 15), fill=cloud_fill)
    draw.rounded_rectangle((3, 10, 19, 16), radius=4, fill=cloud_fill)
    draw.polygon([(12, 3), (9, 10), (12, 10), (8, 20), (16, 11), (13, 11), (16, 3)], fill=cloud_fill)
    return canvas.filter(ImageFilter.GaussianBlur(0.2))


def save_png(image: Image.Image, path: Path, size: int | None = None) -> None:
    output = image if size is None else image.resize((size, size), Image.Resampling.LANCZOS)
    path.parent.mkdir(parents=True, exist_ok=True)
    output.save(path)


def build_iconset(app_icon: Image.Image) -> None:
    ICONSET_DIR.mkdir(parents=True, exist_ok=True)
    for filename, size in ICONSET_SPECS:
        save_png(app_icon, ICONSET_DIR / filename, size)


def build_icns(app_icon: Image.Image) -> None:
    app_icon.save(MACOS_DIR / "app-icon.icns")


def main() -> None:
    app_icon = create_app_icon()
    save_png(app_icon, APP_DIR / "app-icon.png")
    app_icon.save(APP_DIR / "app-icon.ico", format="ICO", sizes=ICO_SIZES)
    save_png(app_icon, APP_DIR / "app-icon-512.png", 512)
    save_png(app_icon, APP_DIR / "app-icon-256.png", 256)

    build_iconset(app_icon)
    build_icns(app_icon)

    save_png(create_windows_tray_icon(), TRAY_DIR / "tray-icon-windows.png")
    save_png(create_macos_template(), TRAY_DIR / "tray-icon-macos-template.png")


if __name__ == "__main__":
    main()
