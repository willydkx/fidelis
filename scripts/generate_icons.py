"""Generates Fidelis's icon assets: progress rings + checkmark on a blue gradient.

Requires Pillow (pip install pillow):
    python scripts/generate_icons.py
"""

import math
from pathlib import Path

from PIL import Image, ImageDraw

SIZE = 1024
ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets" / "images"
# Copied as-is to the root of the web build (PWA manifest icons).
PUBLIC = ROOT / "public"

GRADIENT_TOP = (29, 94, 173)
GRADIENT_BOTTOM = (64, 150, 235)
RING_TRACK = (255, 255, 255, 55)
RING_SPECS = [
    # radius_frac, width_frac, color, progress_fraction  (outer -> inner = daily/weekly/monthly)
    (0.345, 0.052, (237, 168, 25, 255), 0.82),
    (0.262, 0.052, (34, 190, 134, 255), 0.64),
    (0.179, 0.052, (238, 140, 177, 255), 0.47),
]
WHITE = (255, 255, 255, 255)

# Android adaptive icons are 108dp with the launcher mask guaranteed to show only the
# central 66dp circle; the rings span ~0.74 of the canvas, so shrink them to fit inside it.
ADAPTIVE_SCALE = 0.74


def gradient(size: int) -> Image.Image:
    column = Image.new("RGB", (1, size))
    for y in range(size):
        t = y / (size - 1)
        column.putpixel((0, y), tuple(round(a * (1 - t) + b * t) for a, b in zip(GRADIENT_TOP, GRADIENT_BOTTOM)))
    return column.resize((size, size)).convert("RGBA")


def point_on_circle(cx: float, cy: float, radius: float, angle_deg: float) -> tuple[float, float]:
    angle = math.radians(angle_deg)
    return cx + radius * math.cos(angle), cy + radius * math.sin(angle)


def draw_emblem(size: int, scale: float = 1.0, monochrome: bool = False) -> Image.Image:
    """Rings + checkmark on a transparent canvas. Monochrome drops the tracks and colors."""
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    c = size / 2

    for radius_frac, width_frac, color, fraction in RING_SPECS:
        radius, width = size * radius_frac * scale, size * width_frac * scale
        bbox = [c - radius, c - radius, c + radius, c + radius]
        if not monochrome:
            draw.ellipse(bbox, outline=RING_TRACK, width=round(width))
        fill = WHITE if monochrome else color
        start, end = -90, -90 + 360 * fraction
        draw.arc(bbox, start=start, end=end, fill=fill, width=round(width))
        for angle in (start, end):
            px, py = point_on_circle(c, c, radius, angle)
            draw.ellipse([px - width / 2, py - width / 2, px + width / 2, py + width / 2], fill=fill)

    width = size * 0.052 * scale
    points = [
        (c - size * 0.075 * scale, c + size * 0.012 * scale),
        (c - size * 0.018 * scale, c + size * 0.07 * scale),
        (c + size * 0.095 * scale, c - size * 0.075 * scale),
    ]
    draw.line(points, fill=WHITE, width=round(width), joint="curve")
    for px, py in (points[0], points[-1]):
        draw.ellipse([px - width / 2, py - width / 2, px + width / 2, py + width / 2], fill=WHITE)
    return layer


def rounded(image: Image.Image) -> Image.Image:
    mask = Image.new("L", image.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, image.width - 1, image.height - 1], radius=round(image.width * 0.225), fill=255)
    out = Image.new("RGBA", image.size, (0, 0, 0, 0))
    out.paste(image, (0, 0), mask)
    return out


def main() -> None:
    background = gradient(SIZE)
    outputs = {
        # Legacy/fallback icon and store listing.
        "icon.png": rounded(Image.alpha_composite(background, draw_emblem(SIZE))),
        "android-icon-background.png": background,
        "android-icon-foreground.png": draw_emblem(SIZE, ADAPTIVE_SCALE),
        "android-icon-monochrome.png": draw_emblem(SIZE, ADAPTIVE_SCALE, monochrome=True),
        "splash-icon.png": draw_emblem(SIZE),
        "favicon.png": rounded(Image.alpha_composite(background, draw_emblem(SIZE))).resize((48, 48), Image.LANCZOS),
    }
    for name, image in outputs.items():
        image.save(ASSETS / name, format="PNG")
        print(f"wrote {ASSETS / name}")

    full_bleed = Image.alpha_composite(background, draw_emblem(SIZE))
    web_outputs = {
        "icon-192.png": rounded(full_bleed).resize((192, 192), Image.LANCZOS),
        "icon-512.png": rounded(full_bleed).resize((512, 512), Image.LANCZOS),
        # Maskable icons may be cropped to a circle of 80% of the canvas, like adaptive icons.
        "icon-maskable-512.png": Image.alpha_composite(background, draw_emblem(SIZE, ADAPTIVE_SCALE)).resize((512, 512), Image.LANCZOS),
        # iOS rounds the corners itself and shows transparency as black.
        "apple-touch-icon.png": full_bleed.convert("RGB").resize((180, 180), Image.LANCZOS),
    }
    PUBLIC.mkdir(exist_ok=True)
    for name, image in web_outputs.items():
        image.save(PUBLIC / name, format="PNG")
        print(f"wrote {PUBLIC / name}")


if __name__ == "__main__":
    main()
