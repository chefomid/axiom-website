from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

from PIL import Image
from reportlab.lib.pagesizes import A4, landscape
from reportlab.pdfgen import canvas

ROOT = Path(r"c:\Users\Orcc_\OneDrive\Desktop\AXIOM\website")
MANIFEST_PATH = ROOT / "InsuranceManager" / "marketing-deliverable" / "MANIFEST.json"
SCREENSHOT_DIR = ROOT / "InsuranceManager" / "marketing-deliverable" / "screenshots"
OUTPUT_DIR = ROOT / "public" / "insurance-manager"
BOOKLET_PATH = OUTPUT_DIR / "Insurance-Manager-Booklet.pdf"


@dataclass
class Slide:
    slide_id: int
    title: str
    subhead: str
    bullets: list[str]
    speaker_note: str
    image_name: str | None

    @property
    def image_path(self) -> Path | None:
        if not self.image_name:
            return None
        path = SCREENSHOT_DIR / self.image_name
        return path if path.exists() else None


def wrap_lines(c: canvas.Canvas, text: str, max_width: float, font_name: str, font_size: float) -> list[str]:
    c.setFont(font_name, font_size)
    words = text.split()
    if not words:
        return []

    lines: list[str] = []
    current = words[0]
    for word in words[1:]:
        attempt = f"{current} {word}"
        if c.stringWidth(attempt, font_name, font_size) <= max_width:
            current = attempt
        else:
            lines.append(current)
            current = word
    lines.append(current)
    return lines


def draw_wrapped_paragraph(
    c: canvas.Canvas,
    text: str,
    x: float,
    y: float,
    width: float,
    font_name: str,
    font_size: float,
    color: tuple[float, float, float],
    leading: float,
) -> float:
    c.setFillColorRGB(*color)
    lines = wrap_lines(c, text, width, font_name, font_size)
    for line in lines:
        c.setFont(font_name, font_size)
        c.drawString(x, y, line)
        y -= leading
    return y


def draw_bullets(
    c: canvas.Canvas,
    bullets: list[str],
    x: float,
    y: float,
    width: float,
    font_name: str,
    font_size: float,
    text_color: tuple[float, float, float],
    bullet_color: tuple[float, float, float],
    leading: float,
) -> float:
    bullet_indent = 10
    for bullet in bullets:
        wrapped = wrap_lines(c, bullet, width - bullet_indent, font_name, font_size)
        if not wrapped:
            continue
        c.setFillColorRGB(*bullet_color)
        c.circle(x + 2, y + 3, 1.6, fill=1, stroke=0)
        c.setFillColorRGB(*text_color)
        c.setFont(font_name, font_size)
        c.drawString(x + bullet_indent, y, wrapped[0])
        y -= leading
        for line in wrapped[1:]:
            c.drawString(x + bullet_indent, y, line)
            y -= leading
    return y


def draw_image_fit(c: canvas.Canvas, image_path: Path, x: float, y: float, width: float, height: float) -> None:
    with Image.open(image_path) as img:
        img_w, img_h = img.size

    scale = min(width / img_w, height / img_h)
    draw_w = img_w * scale
    draw_h = img_h * scale
    draw_x = x + (width - draw_w) / 2
    draw_y = y + (height - draw_h) / 2

    c.setFillColorRGB(0.06, 0.06, 0.06)
    c.rect(x, y, width, height, stroke=0, fill=1)
    c.drawImage(str(image_path), draw_x, draw_y, draw_w, draw_h, preserveAspectRatio=True, mask="auto")


def draw_text_placeholder(c: canvas.Canvas, x: float, y: float, width: float, height: float, title: str) -> None:
    c.setFillColorRGB(0.06, 0.06, 0.06)
    c.rect(x, y, width, height, stroke=0, fill=1)
    c.setStrokeColorRGB(0.22, 0.22, 0.22)
    c.setLineWidth(1)
    c.rect(x + 12, y + 12, width - 24, height - 24, stroke=1, fill=0)
    c.setFillColorRGB(0.45, 0.45, 0.45)
    c.setFont("Helvetica", 9)
    c.drawCentredString(x + width / 2, y + height / 2 + 8, "PRODUCT FRAME")
    c.setFillColorRGB(0.78, 0.78, 0.78)
    c.setFont("Helvetica-Bold", 11)
    for i, line in enumerate(wrap_lines(c, title, width - 48, "Helvetica-Bold", 11)):
        c.drawCentredString(x + width / 2, y + height / 2 - 6 - i * 14, line)


def draw_page_header(c: canvas.Canvas, page_w: float, page_h: float, page_label: str) -> None:
    c.setFillColorRGB(0.44, 0.44, 0.44)
    c.setFont("Helvetica", 8.5)
    c.drawString(36, page_h - 26, "AXIOM")
    c.drawRightString(page_w - 36, page_h - 26, page_label.upper())
    c.setStrokeColorRGB(0.14, 0.14, 0.14)
    c.setLineWidth(1)
    c.line(30, page_h - 34, page_w - 30, page_h - 34)


def draw_cover(c: canvas.Canvas, page_w: float, page_h: float, headline: str, subheadline: str) -> None:
    c.setFillColorRGB(0.03, 0.03, 0.03)
    c.rect(0, 0, page_w, page_h, stroke=0, fill=1)
    c.setFillColorRGB(1, 1, 1)
    c.setFont("Helvetica-Bold", 33)
    c.drawString(56, page_h - 170, "INSURANCE MANAGER")
    c.setFillColorRGB(0.92, 0.92, 0.92)
    y = draw_wrapped_paragraph(
        c, headline, 56, page_h - 220, page_w - 120, "Helvetica-Bold", 20, (0.95, 0.95, 0.95), 25
    )
    draw_wrapped_paragraph(
        c, subheadline, 56, y - 18, page_w - 120, "Helvetica", 12.5, (0.68, 0.68, 0.68), 16
    )
    c.setStrokeColorRGB(0.3, 0.3, 0.3)
    c.setLineWidth(1.4)
    c.line(56, 76, page_w - 56, 76)
    c.setFillColorRGB(0.55, 0.55, 0.55)
    c.setFont("Helvetica", 9)
    c.drawString(56, 57, "Insured Operations Intelligence")
    c.showPage()


def draw_back_cover(c: canvas.Canvas, page_w: float, page_h: float, headline: str, body: str) -> None:
    c.setFillColorRGB(0.03, 0.03, 0.03)
    c.rect(0, 0, page_w, page_h, stroke=0, fill=1)
    draw_page_header(c, page_w, page_h, "Closing")
    y = draw_wrapped_paragraph(
        c, headline, 56, page_h / 2 + 40, page_w - 120, "Helvetica-Bold", 20, (0.95, 0.95, 0.95), 25
    )
    draw_wrapped_paragraph(
        c, body, 56, y - 18, page_w - 120, "Helvetica", 11, (0.72, 0.72, 0.72), 15
    )
    c.setFillColorRGB(0.6, 0.6, 0.6)
    c.setFont("Helvetica", 10)
    c.drawString(56, 72, "AXIOM - Enterprise Risk Intelligence")
    c.showPage()


def draw_slide_spread(c: canvas.Canvas, page_w: float, page_h: float, slide: Slide) -> None:
    c.setFillColorRGB(0.04, 0.04, 0.04)
    c.rect(0, 0, page_w, page_h, stroke=0, fill=1)
    draw_page_header(c, page_w, page_h, f"Slide {slide.slide_id:02d}")

    margin = 36
    content_top = page_h - 56
    content_bottom = 34
    gap = 26
    image_w = (page_w - (margin * 2) - gap) * 0.56
    text_w = page_w - (margin * 2) - gap - image_w

    image_x = margin
    image_y = content_bottom
    image_h = content_top - content_bottom

    if slide.image_path:
        draw_image_fit(c, slide.image_path, image_x, image_y, image_w, image_h)
    else:
        draw_text_placeholder(c, image_x, image_y, image_w, image_h, slide.title)

    text_x = image_x + image_w + gap
    y = content_top - 4
    y = draw_wrapped_paragraph(c, slide.title, text_x, y, text_w, "Helvetica-Bold", 18, (0.96, 0.96, 0.96), 22)
    y -= 10
    y = draw_wrapped_paragraph(
        c, slide.subhead, text_x, y, text_w, "Helvetica", 10.5, (0.77, 0.77, 0.77), 14
    )
    y -= 10

    c.setFillColorRGB(0.8, 0.8, 0.8)
    c.setFont("Helvetica-Bold", 9.5)
    c.drawString(text_x, y, "PRIMARY FEATURES")
    y -= 16
    y = draw_bullets(
        c, slide.bullets, text_x, y, text_w, "Helvetica", 9.5, (0.82, 0.82, 0.82), (0.65, 0.65, 0.65), 13
    )
    y -= 8
    c.setFillColorRGB(0.8, 0.8, 0.8)
    c.setFont("Helvetica-Bold", 9.5)
    c.drawString(text_x, y, "SPEAKER NOTE")
    y -= 16
    draw_wrapped_paragraph(
        c, slide.speaker_note, text_x, y, text_w, "Helvetica", 9.5, (0.72, 0.72, 0.72), 13
    )
    c.showPage()


def load_slides() -> list[Slide]:
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    slides: list[Slide] = []
    for entry in manifest["deck_order"]:
        image_field = entry.get("image", "")
        image_name = None
        if image_field.endswith(".png"):
            image_name = Path(image_field).name
        slides.append(
            Slide(
                slide_id=int(entry["slide"]),
                title=entry["headline"],
                subhead=entry.get("subhead", ""),
                bullets=entry.get("bullets", []),
                speaker_note=entry.get("speaker_note", ""),
                image_name=image_name,
            )
        )
    return slides


def main() -> None:
    slides = load_slides()
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    tagline = manifest.get("tagline", "")
    closing = manifest.get("closing", {})

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    page_w, page_h = landscape(A4)
    c = canvas.Canvas(str(BOOKLET_PATH), pagesize=(page_w, page_h))

    headline, _, subhead = tagline.partition(". ")
    if not subhead:
        headline = tagline
        subhead = "Faster intake. One source of truth. Broker-ready communication."
    else:
        headline = headline.strip() + "."
        subhead = subhead.strip()

    draw_cover(c, page_w, page_h, headline, subhead)

    for slide in slides:
        draw_slide_spread(c, page_w, page_h, slide)

    draw_back_cover(
        c,
        page_w,
        page_h,
        closing.get("headline", "Insurance operations with intelligence built in"),
        closing.get("body", ""),
    )
    c.save()

    print(f"Booklet generated: {BOOKLET_PATH}")
    available = sum(1 for s in slides if s.image_path)
    print(f"Slides with screenshots: {available}/{len(slides)}")


if __name__ == "__main__":
    main()
