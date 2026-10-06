#!/usr/bin/env python3
"""Export the supplied F Forjado SVG masters; app runtime has no new dependency.

Development only: python3 -m pip install cairosvg Pillow
Run from any directory: python3 scripts/export-brand-assets.py
"""

from io import BytesIO
from pathlib import Path
import shutil
import xml.etree.ElementTree as ET

import cairosvg
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
BRAND = ROOT / "public/brand/forjado"
RES = ROOT / "android/app/src/main/res"


def render(file, size):
    return Image.open(
        BytesIO(cairosvg.svg2png(url=str(BRAND / file), output_width=size, output_height=size))
    ).convert("RGBA")


def export():
    for kind, master in [("app", "eforge-icone-app.svg"), ("maskable", "eforge-icone-maskable.svg")]:
        for size in [192, 512]:
            render(master, size).save(BRAND / f"icon-{kind}-{size}.png")
    # iOS masks its touch icon; the full background comes from the maskable master.
    render("eforge-icone-maskable.svg", 180).convert("RGB").save(BRAND / "apple-touch-icon.png")
    render("eforge-favicon.svg", 32).save(BRAND / "favicon-32.png")

    # Legacy URLs remain valid for old tabs/bookmarks, but contain the new artwork.
    shutil.copyfile(BRAND / "icon-app-192.png", ROOT / "public/icon-192.png")
    shutil.copyfile(BRAND / "icon-app-512.png", ROOT / "public/icon-512.png")
    shutil.copyfile(BRAND / "favicon-32.png", ROOT / "public/favicon.png")
    shutil.copyfile(BRAND / "eforge-simbolo-roxo.svg", ROOT / "public/brand/eforge-mark.svg")

    # Keep the existing Android resource names and density buckets.
    # Only the background is removed for the adaptive foreground layer; paths stay intact.
    foreground = ET.parse(BRAND / "eforge-icone-maskable.svg").getroot()
    background = next(node for node in foreground if node.get("fill") == "#101015")
    foreground.remove(background)
    foreground_svg = ET.tostring(foreground)
    # Android: 66dp safe circle on a 108dp canvas; master: 80% PWA safe circle.
    adaptive_scale = (66 / 108) / 0.8
    for density, factor in [("mdpi", 1), ("hdpi", 1.5), ("xhdpi", 2), ("xxhdpi", 3), ("xxxhdpi", 4)]:
        folder = RES / f"mipmap-{density}"
        folder.mkdir(parents=True, exist_ok=True)
        size = round(48 * factor)
        render("eforge-icone-app.svg", size).save(folder / "ic_launcher.png")
        round_icon = render("eforge-icone-maskable.svg", size)
        circle = Image.new("L", (size, size), 0)
        ImageDraw.Draw(circle).ellipse((0, 0, size - 1, size - 1), fill=255)
        round_icon.putalpha(circle)
        round_icon.save(folder / "ic_launcher_round.png")
        canvas_size = round(108 * factor)
        artwork_size = round(canvas_size * adaptive_scale)
        artwork = Image.open(BytesIO(cairosvg.svg2png(
            bytestring=foreground_svg, output_width=artwork_size, output_height=artwork_size,
        ))).convert("RGBA")
        layer = Image.new("RGBA", (canvas_size, canvas_size))
        offset = (canvas_size - artwork_size) // 2
        layer.alpha_composite(artwork, (offset, offset))
        layer.save(folder / "ic_launcher_foreground.png")

    # Replace every existing splash bitmap, preserving dimensions, orientation and black canvas.
    for target in sorted(RES.glob("drawable*/splash.png")):
        with Image.open(target) as old:
            width, height = old.size
        logo_width = round(min(width, height) * 0.55)
        logo_height = round(logo_width * 260 / 1000)
        logo = Image.open(BytesIO(cairosvg.svg2png(
            url=str(BRAND / "eforge-logo-header.svg"),
            output_width=logo_width, output_height=logo_height,
        ))).convert("RGBA")
        splash = Image.new("RGB", (width, height), "#000000")
        splash.paste(logo, ((width - logo_width) // 2, (height - logo_height) // 2), logo)
        splash.save(target)
    print("Exported PNGs for PWA, favicon, touch icon, Android launchers and existing splash resources.")


if __name__ == "__main__":
    export()
