"""Generate PNG icons for the Ruihe miniapp from the HTML prototype strokes."""
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
TABBAR = ROOT / "assets" / "tabbar"
ICONS = ROOT / "assets" / "icons"

GRAY = (156, 163, 175, 255)  # #9CA3AF
BRAND = (43, 123, 228, 255)  # #2B7BE4
WHITE = (255, 255, 255, 255)
MUTED = (107, 114, 128, 255)  # #6B7280


def new_canvas(size):
    return Image.new("RGBA", (size, size), (0, 0, 0, 0))


def draw(size, color, fn, width=3):
    img = new_canvas(size)
    d = ImageDraw.Draw(img)
    fn(d, size, color, width)
    return img


def scale_pts(size, pts, pad=0.22):
    inner = size * (1 - pad * 2)
    return [(pad * size + x / 24 * inner, pad * size + y / 24 * inner) for x, y in pts]


def polyline(d, size, color, width, pts, closed=False):
    points = scale_pts(size, pts)
    if closed:
        points.append(points[0])
    d.line(points, fill=color, width=width, joint="curve")


def circle(d, size, color, width, cx, cy, r, fill=None):
    pts = scale_pts(size, [(cx - r, cy - r), (cx + r, cy + r)])
    box = [pts[0][0], pts[0][1], pts[1][0], pts[1][1]]
    d.ellipse(box, outline=color, width=width, fill=fill)


def save(img, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, "PNG")
    print("wrote", path.relative_to(ROOT))


def icon_home(d, size, color, width):
    polyline(d, size, color, width, [(3, 11), (12, 4), (21, 11), (21, 20), (14, 20), (14, 14), (10, 14), (10, 20), (3, 20)], True)


def icon_service(d, size, color, width):
    polyline(d, size, color, width, [(4, 6), (20, 6), (20, 20), (4, 20)], True)
    polyline(d, size, color, width, [(4, 10), (20, 10)])
    polyline(d, size, color, width, [(8, 4), (8, 9)])
    polyline(d, size, color, width, [(16, 4), (16, 9)])


def icon_order(d, size, color, width):
    polyline(d, size, color, width, [(5, 3), (16, 3), (19, 6), (19, 21), (5, 21)], True)
    polyline(d, size, color, width, [(16, 3), (16, 6), (19, 6)])
    polyline(d, size, color, width, [(8, 11), (16, 11)])
    polyline(d, size, color, width, [(8, 15), (14, 15)])


def icon_me(d, size, color, width):
    circle(d, size, color, width, 12, 8, 4)
    polyline(d, size, color, width, [(4, 21), (4, 18), (8, 15), (16, 15), (20, 18), (20, 21)])


def icon_search(d, size, color, width):
    circle(d, size, color, width, 11, 11, 6)
    polyline(d, size, color, width, [(16, 16), (21, 21)])


def icon_phone(d, size, color, width):
    polyline(d, size, color, width, [(5, 4), (8, 4), (10, 8), (8, 10), (14, 16), (16, 14), (20, 16), (20, 19), (16, 21), (8, 21), (3, 16), (3, 8)], True)


def icon_location(d, size, color, width):
    polyline(d, size, color, width, [(12, 21), (19, 12), (19, 10), (16, 5), (12, 3), (8, 5), (5, 10), (5, 12)], True)
    circle(d, size, color, width, 12, 10, 2.4)


def icon_clock(d, size, color, width):
    circle(d, size, color, width, 12, 12, 8)
    polyline(d, size, color, width, [(12, 8), (12, 13), (15, 15)])


def icon_chat(d, size, color, width):
    polyline(d, size, color, width, [(4, 5), (20, 5), (20, 16), (9, 16), (4, 20), (4, 5)])
    polyline(d, size, color, width, [(8, 9), (16, 9)])
    polyline(d, size, color, width, [(8, 12), (13, 12)])


def icon_info(d, size, color, width):
    circle(d, size, color, width, 12, 12, 8)
    polyline(d, size, color, width, [(12, 11), (12, 16)])
    circle(d, size, color, width, 12, 8, 0.6, fill=color)


def icon_arrow(d, size, color, width):
    polyline(d, size, color, width, [(9, 6), (15, 12), (9, 18)])


def icon_shield(d, size, color, width):
    polyline(d, size, color, width, [(12, 3), (20, 7), (20, 13), (12, 21), (4, 13), (4, 7)], True)
    polyline(d, size, color, width, [(9, 12), (11, 14), (15, 10)])


def icon_settings(d, size, color, width):
    circle(d, size, color, width, 12, 12, 3)
    for angle_pts in [
        [(12, 3), (12, 6)],
        [(12, 18), (12, 21)],
        [(3, 12), (6, 12)],
        [(18, 12), (21, 12)],
        [(6, 6), (8, 8)],
        [(16, 16), (18, 18)],
        [(18, 6), (16, 8)],
        [(8, 16), (6, 18)],
    ]:
        polyline(d, size, color, width, angle_pts)


def icon_close(d, size, color, width):
    polyline(d, size, color, width, [(6, 6), (18, 18)])
    polyline(d, size, color, width, [(18, 6), (6, 18)])


def icon_empty(d, size, color, width):
    icon_order(d, size, color, width)


TABBAR_ICONS = {
    "home": icon_home,
    "service": icon_service,
    "order": icon_order,
    "me": icon_me,
}

PAGE_ICONS = {
    "search": icon_search,
    "phone": icon_phone,
    "location": icon_location,
    "clock": icon_clock,
    "chat": icon_chat,
    "info": icon_info,
    "arrow": icon_arrow,
    "shield": icon_shield,
    "settings": icon_settings,
    "close": icon_close,
    "empty": icon_empty,
    "calendar": icon_service,
    "document": icon_order,
    "user": icon_me,
}


def main():
    for name, fn in TABBAR_ICONS.items():
        save(draw(81, GRAY, fn, 4), TABBAR / f"{name}.png")
        save(draw(81, BRAND, fn, 4), TABBAR / f"{name}-active.png")

    for name, fn in PAGE_ICONS.items():
        save(draw(96, GRAY, fn, 5), ICONS / f"{name}.png")
        save(draw(96, BRAND, fn, 5), ICONS / f"{name}-brand.png")
        save(draw(96, WHITE, fn, 5), ICONS / f"{name}-white.png")
        save(draw(96, MUTED, fn, 5), ICONS / f"{name}-muted.png")


if __name__ == "__main__":
    main()