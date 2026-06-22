from __future__ import annotations

import colorsys
from collections import deque
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "radio-characters.jpeg"
CLEAN_BACKGROUND = ROOT / "assets" / "radio-background-clean.png"
HYBRID_BACKGROUND = ROOT / "assets" / "radio-background-hybrid.png"


PARTS = {
    "cutout-left-torso.png": {
        "polygon": [(7, 50), (16, 45), (21, 43), (29, 45), (35, 52), (34, 65), (29, 70), (16, 68), (7, 59)],
        "exclude": [
            [(7, 48), (12, 48), (12, 53), (9, 54), (7, 54)],
            [(29, 57), (35, 57), (35, 70), (30, 70), (27, 64)],
        ],
        "seeds": [(16, 55), (22, 57), (27, 61)],
        "include_dark": False,
    },
    "cutout-left-hands.png": {
        "polygon": [(28, 49), (35, 50), (37, 57), (35, 63), (29, 62), (27, 56)],
        "seeds": [(31, 54), (33, 58)],
        "include_dark": False,
    },
    "cutout-left-lap.png": {
        "polygon": [(13, 63), (29, 63), (35, 76), (34, 91), (30, 98), (21, 97), (14, 85), (12, 71)],
        "seeds": [(20, 70), (27, 76), (28, 88)],
        "include_dark": False,
    },
    "cutout-right-torso.png": {
        "polygon": [(70, 42), (79, 41), (88, 51), (91, 67), (86, 78), (73, 73), (66, 64), (66, 55)],
        "exclude": [[(66, 49), (70, 49), (70, 58), (66, 58)]],
        "seeds": [(77, 49), (83, 57), (78, 67)],
        "include_dark": False,
    },
    "cutout-right-hands.png": {
        "polygon": [(68, 54), (79, 53), (85, 60), (81, 69), (69, 67), (62, 61), (64, 57)],
        "exclude": [[(65, 53), (70, 53), (70, 58), (66, 59), (64, 57)]],
        "seeds": [(70, 59), (76, 62)],
        "include_dark": False,
    },
    "cutout-right-lap.png": {
        "polygon": [(58, 68), (77, 68), (89, 79), (83, 86), (76, 84), (76, 100), (64, 100), (61, 89)],
        "seeds": [(66, 73), (73, 77), (69, 89), (69, 98)],
        "include_dark": False,
    },
    "cutout-head-left.png": {
        "polygon": [(22, 39), (24, 35), (29, 33), (33, 35), (33, 41), (32, 46), (29, 49), (24, 47), (21, 43)],
        "exclude": [[(32, 34), (34, 34), (34, 39), (33, 39)]],
        "seeds": [(27, 36), (29, 43)],
        "include_dark": True,
    },
    "cutout-head-right.png": {
        "polygon": [(63, 36), (66, 32), (70, 31), (74, 34), (77, 39), (76, 44), (73, 48), (68, 50), (64, 47), (62, 42)],
        "exclude": [[(62, 38), (65, 39), (66, 43), (66, 47), (62, 47)]],
        "seeds": [(69, 35), (70, 42)],
        "include_dark": True,
    },
}


def is_person_pixel(r: int, g: int, b: int, include_dark: bool) -> bool:
    rf, gf, bf = r / 255, g / 255, b / 255
    _, saturation, value = colorsys.rgb_to_hsv(rf, gf, bf)
    luma = 0.2126 * r + 0.7152 * g + 0.0722 * b

    is_clothing_or_skin = luma > 148 and saturation < 0.23
    is_skin_shadow = luma > 128 and saturation < 0.17 and max(r, g, b) - min(r, g, b) < 48
    is_warm_dark_background = r > g + 12 and r > b + 12
    is_hair = include_dark and luma < 85 and saturation < 0.65 and not is_warm_dark_background
    return is_clothing_or_skin or is_skin_shadow or is_hair


def nearest_mask_pixel(mask: Image.Image, point: tuple[int, int], radius: int = 20) -> tuple[int, int] | None:
    pixels = mask.load()
    width, height = mask.size
    px, py = point

    for distance in range(radius + 1):
        for y in range(max(0, py - distance), min(height, py + distance + 1)):
            for x in range(max(0, px - distance), min(width, px + distance + 1)):
                if pixels[x, y]:
                    return x, y
    return None


def retain_seed_components(mask: Image.Image, seeds: list[tuple[int, int]]) -> Image.Image:
    width, height = mask.size
    source = mask.load()
    kept = Image.new("L", mask.size, 0)
    kept_pixels = kept.load()
    visited: set[tuple[int, int]] = set()

    for seed in seeds:
        start = nearest_mask_pixel(mask, seed)
        if start is None or start in visited:
            continue

        queue = deque([start])
        visited.add(start)
        while queue:
            x, y = queue.popleft()
            kept_pixels[x, y] = 255
            for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if nx < 0 or ny < 0 or nx >= width or ny >= height:
                    continue
                point = (nx, ny)
                if point in visited or not source[nx, ny]:
                    continue
                visited.add(point)
                queue.append(point)

    return kept


def percent_polygon(points: list[tuple[int, int]], width: int, height: int) -> list[tuple[float, float]]:
    return [(x * width / 100, y * height / 100) for x, y in points]


def main() -> None:
    source = Image.open(SOURCE).convert("RGBA")
    width, height = source.size
    combined_person_mask = Image.new("L", source.size, 0)

    for filename, config in PARTS.items():
      polygon_mask = Image.new("L", source.size, 0)
      ImageDraw.Draw(polygon_mask).polygon(percent_polygon(config["polygon"], width, height), fill=255)

      color_mask = Image.new("L", source.size, 0)
      src_pixels = source.load()
      mask_pixels = polygon_mask.load()
      color_pixels = color_mask.load()

      include_dark = bool(config["include_dark"])
      for y in range(height):
          for x in range(width):
              if not mask_pixels[x, y]:
                  continue
              r, g, b, a = src_pixels[x, y]
              if is_person_pixel(r, g, b, include_dark):
                  color_pixels[x, y] = 255

      closed_mask = color_mask.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))
      seed_points = [
          (round(x * width / 100), round(y * height / 100))
          for x, y in config["seeds"]
      ]
      person_mask = retain_seed_components(closed_mask, seed_points).filter(ImageFilter.MaxFilter(3))
      person_mask = ImageChops.multiply(person_mask, polygon_mask)

      mask_draw = ImageDraw.Draw(person_mask)
      for exclusion in config.get("exclude", []):
          mask_draw.polygon(percent_polygon(exclusion, width, height), fill=0)

      combined_person_mask = ImageChops.lighter(combined_person_mask, person_mask)

      output = Image.new("RGBA", source.size, (0, 0, 0, 0))
      output.paste(source, (0, 0), person_mask)

      output.save(ROOT / "assets" / filename)

    clean_background = Image.open(CLEAN_BACKGROUND).convert("RGBA")
    # Replace only pixels that are fully covered by the original cutouts at rest.
    # This makes the still frame match the source while revealing the clean plate
    # when a character layer moves away from its original position.
    motion_mask = combined_person_mask
    hybrid_background = source.copy()
    hybrid_background.paste(clean_background, (0, 0), motion_mask)
    hybrid_background.convert("RGB").save(HYBRID_BACKGROUND, optimize=True)


if __name__ == "__main__":
    main()
