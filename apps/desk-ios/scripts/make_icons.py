"""Draws the Guileo Desk icon and splash at full resolution.

The PWA ships public/desk-app-512.png; the App Store needs a sharp 1024 px icon
(no transparency) and Capacitor's splash wants 2732 px. Upscaling the 512 would
blur, so the same drawing is redone here with the geometry measured from that
file (calendar on warm cement #161512). Run: python3 scripts/make_icons.py
"""
from pathlib import Path
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent.parent
IOS_ASSETS = HERE / "ios/App/App/Assets.xcassets"

CEMENT = "#161512"
PAPER = "#D6C29A"
INSIDE = "#24221D"
RING = "#ECE8DF"
CELLS = [
    ["#3FB4FF", "#2FE39A", "#FFC23D"],
    ["#2FE39A", "#3A372F", "#3FB4FF"],
]


def draw_icon(size):
    """The calendar on a full-bleed square, in the 512-unit grid of desk-app-512.png."""
    ss = 4  # supersample, then downscale for clean edges
    k = size * ss / 512
    im = Image.new("RGB", (size * ss, size * ss), CEMENT)
    d = ImageDraw.Draw(im)

    def box(x0, y0, x1, y1):
        return [round(x0 * k), round(y0 * k), round(x1 * k), round(y1 * k)]

    d.rounded_rectangle(box(112, 132, 400, 410), radius=round(30 * k), fill=PAPER)
    d.rounded_rectangle(box(121, 200, 391, 401), radius=round(22 * k), fill=INSIDE)
    d.rectangle(box(121, 200, 391, 230), fill=INSIDE)  # square top edge under the header
    for row, y in enumerate((229, 306)):
        for col, x in enumerate((129, 225, 321)):
            d.rounded_rectangle(box(x, y, x + 61, y + 53), radius=round(11 * k), fill=CELLS[row][col])
    for x in (172, 316):
        d.rounded_rectangle(box(x, 101, x + 24, 159), radius=round(12 * k), fill=RING)
    return im.resize((size, size), Image.LANCZOS)


def draw_splash(size=2732, icon_px=512):
    im = Image.new("RGB", (size, size), CEMENT)
    icon = draw_icon(icon_px)
    off = (size - icon_px) // 2
    im.paste(icon, (off, off))
    return im


def main():
    res = HERE / "resources"
    res.mkdir(exist_ok=True)
    draw_icon(1024).save(res / "icon-1024.png")
    draw_splash().save(res / "splash-2732.png")
    draw_icon(176).save(HERE / "www/icon.png")  # used by offline.html

    if IOS_ASSETS.exists():
        draw_icon(1024).save(IOS_ASSETS / "AppIcon.appiconset/AppIcon-512@2x.png")
        splash = draw_splash()
        for name in ("splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png"):
            splash.save(IOS_ASSETS / "Splash.imageset" / name)
        print("wrote icon + splash into", IOS_ASSETS)
    else:
        print("ios/ not added yet: run `npx cap add ios`, then this script again")


if __name__ == "__main__":
    main()
