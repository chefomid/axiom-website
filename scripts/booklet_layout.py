"""Aspect-ratio-aware image layout helpers for booklet PDF generators."""

from __future__ import annotations

from pathlib import Path
from typing import Callable

from PIL import Image
from reportlab.pdfgen import canvas

FRAME_FILL = (0.06, 0.06, 0.06)
FRAME_STROKE = (0.14, 0.14, 0.14)


def image_aspect(path: Path) -> float:
    with Image.open(path) as img:
        w, h = img.size
    return w / h if h else 1.0


def image_size(path: Path) -> tuple[int, int]:
    with Image.open(path) as img:
        return img.size


def natural_height(width: float, aspect: float) -> float:
    return width / aspect if aspect else width


def band_heights(width: float, total_height: float, aspects: list[float], gap: float) -> list[float]:
    if not aspects:
        return []
    if len(aspects) == 1:
        return [min(natural_height(width, aspects[0]), total_height)]

    natural = [natural_height(width, aspect) for aspect in aspects]
    gaps = gap * (len(aspects) - 1)
    available = max(total_height - gaps, 1.0)
    total_natural = sum(natural)
    if total_natural <= available:
        return natural

    scale = available / total_natural
    return [height * scale for height in natural]


def fit_dimensions(img_w: int, img_h: int, box_w: float, box_h: float) -> tuple[float, float]:
    scale = min(box_w / img_w, box_h / img_h)
    return img_w * scale, img_h * scale


def draw_image_band(
    c: canvas.Canvas,
    image_path: Path,
    x: float,
    y: float,
    width: float,
    height: float,
    *,
    valign: str = "top",
    frame: bool = True,
) -> float:
    """Draw image top-aligned inside a band. Returns actual drawn height."""
    img_w, img_h = image_size(image_path)
    draw_w, draw_h = fit_dimensions(img_w, img_h, width, height)
    draw_x = x + (width - draw_w) / 2
    draw_y = y + (height - draw_h) if valign == "top" else y + (height - draw_h) / 2

    if frame:
        c.setFillColorRGB(*FRAME_FILL)
        c.setStrokeColorRGB(*FRAME_STROKE)
        c.setLineWidth(0.5)
        c.roundRect(draw_x - 2, draw_y - 2, draw_w + 4, draw_h + 4, 2, stroke=1, fill=1)

    c.drawImage(str(image_path), draw_x, draw_y, draw_w, draw_h, preserveAspectRatio=True, mask="auto")
    return draw_h


def draw_images_stacked(
    c: canvas.Canvas,
    image_paths: list[Path],
    x: float,
    y: float,
    width: float,
    height: float,
    gap: float = 8,
) -> None:
    if not image_paths:
        return

    aspects = [image_aspect(path) for path in image_paths]
    heights = band_heights(width, height, aspects, gap)
    cursor = y + height

    for path, band_h in zip(image_paths, heights):
        cursor -= band_h
        draw_image_band(c, path, x, cursor, width, band_h, valign="top")
        cursor -= gap


def draw_images_quad(
    c: canvas.Canvas,
    image_paths: list[Path],
    x: float,
    y: float,
    width: float,
    height: float,
    gap: float = 6,
) -> None:
    if len(image_paths) != 4:
        raise ValueError("draw_images_quad expects exactly 4 images")

    cell_w = (width - gap) / 2
    aspects = [image_aspect(path) for path in image_paths]
    row_heights_natural = [
        max(natural_height(cell_w, aspects[0]), natural_height(cell_w, aspects[1])),
        max(natural_height(cell_w, aspects[2]), natural_height(cell_w, aspects[3])),
    ]
    total_natural = sum(row_heights_natural) + gap
    scale = min(1.0, height / total_natural) if total_natural else 1.0
    row_heights = [row_h * scale for row_h in row_heights_natural]

    cursor = y + height
    for row in range(2):
        row_h = row_heights[row]
        cursor -= row_h
        for col in range(2):
            index = row * 2 + col
            cell_x = x + col * (cell_w + gap)
            draw_image_band(c, image_paths[index], cell_x, cursor, cell_w, row_h, valign="top")
        if row == 0:
            cursor -= gap


def draw_images_gallery(
    c: canvas.Canvas,
    image_paths: list[Path],
    x: float,
    y: float,
    width: float,
    height: float,
    gap: float = 8,
) -> None:
    if len(image_paths) < 3:
        raise ValueError("draw_images_gallery expects at least 3 images")

    hero_aspect = image_aspect(image_paths[0])
    detail_aspects = [image_aspect(path) for path in image_paths[1:]]
    hero_natural = natural_height(width, hero_aspect)
    detail_natural = sum(natural_height(width, aspect) for aspect in detail_aspects)
    detail_gaps = gap * (len(detail_aspects) - 1)
    total_natural = hero_natural + gap + detail_natural + detail_gaps

    if total_natural <= height:
        hero_h = hero_natural
        detail_heights = [natural_height(width, aspect) for aspect in detail_aspects]
    else:
        hero_share = hero_natural / total_natural
        hero_h = (height - gap - detail_gaps) * hero_share
        detail_total = height - gap - hero_h - detail_gaps
        detail_natural_sum = sum(natural_height(width, aspect) for aspect in detail_aspects)
        detail_heights = [
            detail_total * (natural_height(width, aspect) / detail_natural_sum) for aspect in detail_aspects
        ]

    cursor = y + height
    cursor -= hero_h
    draw_image_band(c, image_paths[0], x, cursor, width, hero_h, valign="top")
    cursor -= gap

    for path, band_h in zip(image_paths[1:], detail_heights):
        cursor -= band_h
        draw_image_band(c, path, x, cursor, width, band_h, valign="top")
        cursor -= gap


def stacked_block_height(width: float, aspects: list[float], gap: float) -> float:
    if not aspects:
        return 0.0
    natural = [natural_height(width, aspect) for aspect in aspects]
    return sum(natural) + gap * (len(aspects) - 1)


def quad_block_height(width: float, aspects: list[float], gap: float) -> float:
    cell_w = (width - gap) / 2
    row_heights = [
        max(natural_height(cell_w, aspects[0]), natural_height(cell_w, aspects[1])),
        max(natural_height(cell_w, aspects[2]), natural_height(cell_w, aspects[3])),
    ]
    return sum(row_heights) + gap


def gallery_block_height(width: float, aspects: list[float], gap: float) -> float:
    if len(aspects) < 3:
        return 0.0
    hero = natural_height(width, aspects[0])
    details = sum(natural_height(width, aspect) for aspect in aspects[1:])
    detail_gaps = gap * (len(aspects) - 2)
    return hero + gap + details + detail_gaps


def draw_vertical_spread(
    c: canvas.Canvas,
    page_w: float,
    page_h: float,
    *,
    page_label: str,
    margin: float,
    content_top: float,
    content_bottom: float,
    image_path: Path,
    draw_text: Callable[[canvas.Canvas, float, float, float], float],
    draw_header: Callable[[canvas.Canvas, float, float, str], None],
    image_max_fraction: float = 0.48,
    text_gap: float = 18,
) -> None:
    """Full-width spread: screenshot band on top, copy below."""
    c.setFillColorRGB(0.04, 0.04, 0.04)
    c.rect(0, 0, page_w, page_h, stroke=0, fill=1)
    draw_header(c, page_w, page_h, page_label)

    content_w = page_w - margin * 2
    available_h = content_top - content_bottom
    aspect = image_aspect(image_path)
    image_h = min(natural_height(content_w, aspect), available_h * image_max_fraction)
    image_y = content_top - image_h

    draw_image_band(c, image_path, margin, image_y, content_w, image_h, valign="top")

    text_start_y = image_y - text_gap
    draw_text(c, margin, content_w, text_start_y)
    c.showPage()
