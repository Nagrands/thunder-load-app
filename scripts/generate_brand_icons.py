#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageOps


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
ICO_SIZES = [
    (16, 16),
    (24, 24),
    (32, 32),
    (48, 48),
    (64, 64),
    (128, 128),
    (256, 256),
]


def scale_value(size: int, value: int) -> int:
    return int(round(value * size / APP_ICON_SIZE))


def fit_bbox(
    bbox: tuple[int, int, int, int],
    size: int,
) -> tuple[int, int, int, int]:
    x0, y0, x1, y1 = bbox
    return (
        scale_value(size, x0),
        scale_value(size, y0),
        scale_value(size, x1),
        scale_value(size, y1),
    )


def make_vertical_gradient(
    size: tuple[int, int],
    top: str,
    bottom: str,
) -> Image.Image:
    gradient = Image.linear_gradient("L").resize(size)
    return ImageOps.colorize(gradient, top, bottom).convert("RGBA")


def glow(
    size: int,
    color: tuple[int, int, int, int],
    bbox: tuple[int, int, int, int],
    blur: int,
) -> Image.Image:
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(layer).ellipse(fit_bbox(bbox, size), fill=color)
    return layer.filter(
        ImageFilter.GaussianBlur(max(1, scale_value(size, blur))),
    )


def build_tile_mask(size: int) -> tuple[Image.Image, int, int]:
    margin = int(round(size * 0.07))
    radius = int(round(size * 0.235))
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (margin, margin, size - margin, size - margin),
        radius=radius,
        fill=255,
    )
    return mask, margin, radius


def add_tile_background(canvas: Image.Image, size: int) -> None:
    tile = make_vertical_gradient((size, size), "#0d1930", "#040813")
    tile = Image.alpha_composite(
        tile,
        glow(size, (31, 145, 255, 116), (64, 88, 520, 786), 92),
    )
    tile = Image.alpha_composite(
        tile,
        glow(size, (255, 163, 48, 86), (526, 136, 968, 780), 110),
    )

    top_sheen = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(top_sheen).rounded_rectangle(
        (
            scale_value(size, 168),
            scale_value(size, 114),
            scale_value(size, 850),
            scale_value(size, 448),
        ),
        radius=scale_value(size, 166),
        fill=(255, 255, 255, 20),
    )
    top_sheen = top_sheen.filter(ImageFilter.GaussianBlur(scale_value(size, 88)))
    tile = Image.alpha_composite(tile, top_sheen)

    vignette = Image.radial_gradient("L").resize((size, size))
    vignette = ImageOps.invert(vignette)
    vignette = ImageOps.colorize(vignette, "#000000", "#000000").convert("RGBA")
    vignette.putalpha(
        ImageOps.autocontrast(vignette.convert("L")).point(lambda p: int(p * 0.48)),
    )
    tile = Image.alpha_composite(tile, vignette)

    mask, margin, radius = build_tile_mask(size)
    clipped = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    clipped.paste(tile, (0, 0), mask)
    canvas.alpha_composite(clipped)

    border = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(border)
    draw.rounded_rectangle(
        (margin, margin, size - margin - 1, size - margin - 1),
        radius=radius,
        outline=(255, 255, 255, 60),
        width=max(2, size // 160),
    )
    draw.rounded_rectangle(
        (
            margin + scale_value(size, 18),
            margin + scale_value(size, 18),
            size - margin - scale_value(size, 18),
            size - margin - scale_value(size, 18),
        ),
        radius=max(1, radius - scale_value(size, 18)),
        outline=(255, 255, 255, 18),
        width=max(1, size // 256),
    )
    canvas.alpha_composite(border)


def t_mask(size: int) -> Image.Image:
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)

    corner = max(8, size // 18)

    draw.rounded_rectangle(
        fit_bbox((228, 232, 796, 398), size),
        radius=corner,
        fill=255,
    )
    draw.rounded_rectangle(
        fit_bbox((430, 232, 594, 810), size),
        radius=corner,
        fill=255,
    )
    return mask


def colored_shape(
    size: int,
    mask: Image.Image,
    top: str,
    bottom: str,
    glow_color: tuple[int, int, int, int] | None = None,
    glow_bbox: tuple[int, int, int, int] | None = None,
    outline_color: tuple[int, int, int, int] | None = None,
    highlight_alpha: int = 0,
) -> Image.Image:
    fill = make_vertical_gradient((size, size), top, bottom)
    if glow_color and glow_bbox:
        fill = Image.alpha_composite(fill, glow(size, glow_color, glow_bbox, 44))

    if highlight_alpha:
        highlight = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        ImageDraw.Draw(highlight).rounded_rectangle(
            (
                scale_value(size, 264),
                scale_value(size, 236),
                scale_value(size, 760),
                scale_value(size, 544),
            ),
            radius=max(8, size // 10),
            fill=(255, 255, 255, highlight_alpha),
        )
        highlight = highlight.filter(ImageFilter.GaussianBlur(max(1, size // 26)))
        fill = Image.alpha_composite(fill, highlight)

    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(fill, (0, 0), mask)

    if outline_color:
        outline = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        outline_draw = ImageDraw.Draw(outline)
        for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            outline_draw.bitmap((dx, dy), mask, fill=outline_color)
        outline = outline.filter(ImageFilter.GaussianBlur(max(1, size // 220)))
        out = Image.alpha_composite(outline, out)
    return out


def render_t_symbol(size: int) -> Image.Image:
    mask = t_mask(size)

    shadow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    for dx, dy in [
        (scale_value(size, 18), scale_value(size, 22)),
        (scale_value(size, 16), scale_value(size, 20)),
    ]:
        shadow_draw.bitmap((dx, dy), mask, fill=(0, 0, 0, 128))
    shadow = shadow.filter(ImageFilter.GaussianBlur(max(1, size // 22)))

    t_shape = colored_shape(
        size,
        mask,
        "#f8fbff",
        "#aebfd8",
        glow_color=(90, 194, 255, 72),
        glow_bbox=(168, 190, 818, 860),
        outline_color=(220, 235, 255, 28),
        highlight_alpha=40,
    )

    inner_shadow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    inner_shadow_draw = ImageDraw.Draw(inner_shadow)
    inner_shadow_draw.rounded_rectangle(
        fit_bbox((438, 296, 592, 802), size),
        radius=max(8, size // 18),
        fill=(0, 0, 0, 40),
    )
    inner_shadow = inner_shadow.filter(ImageFilter.GaussianBlur(max(1, size // 28)))

    warm_accent = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(warm_accent).rounded_rectangle(
        fit_bbox((526, 220, 804, 418), size),
        radius=max(8, size // 14),
        fill=(255, 175, 52, 72),
    )
    warm_accent = warm_accent.filter(ImageFilter.GaussianBlur(max(1, size // 24)))

    symbol = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    symbol.alpha_composite(shadow)
    symbol.alpha_composite(warm_accent)
    symbol.alpha_composite(t_shape)
    symbol.alpha_composite(inner_shadow)
    return symbol


def create_app_icon(size: int = APP_ICON_SIZE) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    add_tile_background(canvas, size)
    canvas.alpha_composite(render_t_symbol(size))
    return canvas


def create_windows_tray_icon(size: int = 32) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    circle = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(circle).ellipse((2, 2, size - 2, size - 2), fill=(45, 150, 255, 255))
    circle = Image.alpha_composite(
        circle,
        glow(size, (255, 170, 50, 70), (400, 420, 960, 980), 70).resize((size, size), Image.Resampling.LANCZOS),
    )
    canvas.alpha_composite(circle)

    draw = ImageDraw.Draw(canvas)
    draw.rounded_rectangle((8, 8, 24, 13), radius=3, fill=(255, 255, 255, 255))
    draw.rounded_rectangle((13, 8, 18, 24), radius=3, fill=(255, 255, 255, 255))
    return canvas


def create_macos_template(size: int = 24) -> Image.Image:
    scale = 4
    large_size = size * scale
    canvas = Image.new("RGBA", (large_size, large_size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    draw.ellipse((14, 14, 82, 82), fill=(0, 0, 0, 255))
    draw.rounded_rectangle((31, 30, 65, 40), radius=6, fill=(0, 0, 0, 0))
    draw.rounded_rectangle((43, 30, 53, 64), radius=6, fill=(0, 0, 0, 0))

    return canvas.resize((size, size), Image.Resampling.LANCZOS)


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
