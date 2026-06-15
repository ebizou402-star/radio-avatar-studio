from __future__ import annotations

import colorsys
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "radio-characters.jpeg"


PARTS = {
    "cutout-left-torso.png": {
        "polygon": [(11, 50), (20, 44), (28, 46), (33, 53), (33, 64), (26, 68), (16, 65), (10, 56)],
        "include_dark": False,
    },
    "cutout-left-hands.png": {
        "polygon": [(29, 48), (39, 51), (42, 60), (37, 67), (29, 62)],
        "include_dark": False,
    },
    "cutout-left-lap.png": {
        "polygon": [(15, 63), (30, 64), (36, 78), (34, 93), (27, 98), (20, 93), (13, 78)],
        "include_dark": False,
    },
    "cutout-right-torso.png": {
        "polygon": [(64, 43), (78, 41), (87, 51), (90, 67), (85, 77), (73, 72), (64, 63), (58, 52)],
        "include_dark": False,
    },
    "cutout-right-hands.png": {
        "polygon": [(66, 54), (79, 53), (84, 61), (80, 69), (68, 66), (62, 60)],
        "include_dark": False,
    },
    "cutout-right-lap.png": {
        "polygon": [(60, 68), (77, 68), (90, 82), (88, 98), (73, 98), (64, 88)],
        "include_dark": False,
    },
    "cutout-head-left.png": {
        "polygon": [(22, 39), (24, 35), (29, 33), (33, 35), (33, 40), (32, 46), (28, 49), (23, 47), (21, 42)],
        "include_dark": True,
    },
    "cutout-head-right.png": {
        "polygon": [(61, 34), (67, 31), (73, 34), (76, 40), (74, 47), (66, 50), (61, 47), (59, 40)],
        "include_dark": True,
    },
}


def is_person_pixel(r: int, g: int, b: int, include_dark: bool) -> bool:
    rf, gf, bf = r / 255, g / 255, b / 255
    _, saturation, value = colorsys.rgb_to_hsv(rf, gf, bf)
    luma = 0.2126 * r + 0.7152 * g + 0.0722 * b

    is_clothing_or_skin = luma > 158 and saturation < 0.3
    is_skin_shadow = luma > 142 and saturation < 0.2 and abs(r - g) < 42 and abs(g - b) < 42
    is_warm_dark_background = r > g + 12 and r > b + 12
    is_hair = include_dark and luma < 85 and saturation < 0.65 and not is_warm_dark_background
    return is_clothing_or_skin or is_skin_shadow or is_hair


def percent_polygon(points: list[tuple[int, int]], width: int, height: int) -> list[tuple[float, float]]:
    return [(x * width / 100, y * height / 100) for x, y in points]


def main() -> None:
    source = Image.open(SOURCE).convert("RGBA")
    width, height = source.size

    for filename, config in PARTS.items():
      polygon_mask = Image.new("L", source.size, 0)
      ImageDraw.Draw(polygon_mask).polygon(percent_polygon(config["polygon"], width, height), fill=255)

      output = Image.new("RGBA", source.size, (0, 0, 0, 0))
      src_pixels = source.load()
      mask_pixels = polygon_mask.load()
      out_pixels = output.load()

      include_dark = bool(config["include_dark"])
      for y in range(height):
          for x in range(width):
              if not mask_pixels[x, y]:
                  continue
              r, g, b, a = src_pixels[x, y]
              if is_person_pixel(r, g, b, include_dark):
                  out_pixels[x, y] = (r, g, b, a)

      output.save(ROOT / "assets" / filename)


if __name__ == "__main__":
    main()
