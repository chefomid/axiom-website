from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from PIL import Image
from reportlab.lib.pagesizes import A4, landscape
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "Pictures" / "COI Tracker"
BRIEF_PATH = SOURCE_DIR / "COI_Tracker_Booklet_Content_Brief.txt"
OUTPUT_DIR = ROOT / "public" / "coi-tracker"
BOOKLET_PATH = OUTPUT_DIR / "COI-Tracker-Booklet.pdf"
INDIVIDUAL_DIR = SOURCE_DIR / "output" / "individual"

# Matches CoiTrackerModal.jsx DOSSIER order (interactive dossier is source of truth).
MODAL_ASSET_SEQUENCE = [1, 2, 3, 4, 7, 8, 10, 11, 12, 13]


@dataclass
class Asset:
    asset_id: int
    title: str
    filename: str
    description: str
    primary_features: list[str]
    sub_features: list[str]

    @property
    def image_path(self) -> Path:
        return SOURCE_DIR / self.filename

    @property
    def pdf_name(self) -> str:
        return self.filename.replace(".png", ".pdf")


def parse_quoted_value(text: str, label: str) -> str:
    pattern = rf"{re.escape(label)}:\s*[\r\n]+\"([^\"]+)\""
    match = re.search(pattern, text, flags=re.MULTILINE)
    return match.group(1).strip() if match else ""


def extract_bullets(block: str, label: str) -> list[str]:
    match = re.search(
        rf"{re.escape(label)}:\s*[\r\n]+((?:- .*(?:\r?\n|$))+)",
        block,
        flags=re.MULTILINE,
    )
    if not match:
        return []
    raw = match.group(1).strip().splitlines()
    return [line[2:].strip() for line in raw if line.strip().startswith("- ")]


def parse_assets(brief_text: str) -> list[Asset]:
    assets: list[Asset] = []
    blocks = re.findall(
        r"\[ASSET\s+(\d+)\](.*?)(?=(?:\n-+\n\[ASSET\s+\d+\])|\Z)",
        brief_text,
        flags=re.DOTALL,
    )

    for asset_num, block in blocks:
        title_match = re.search(r"Suggested title:\s*(.+)", block)
        filename_match = re.search(r"Suggested output filename:\s*(.+)", block)
        description_match = re.search(r"Marketing description:\s*[\r\n]+\"([^\"]+)\"", block)

        if not title_match or not filename_match:
            continue

        assets.append(
            Asset(
                asset_id=int(asset_num),
                title=title_match.group(1).strip(),
                filename=filename_match.group(1).strip(),
                description=description_match.group(1).strip() if description_match else "",
                primary_features=extract_bullets(block, "Primary features shown"),
                sub_features=extract_bullets(block, "Sub-features to call out"),
            )
        )

    return sorted(assets, key=lambda a: a.asset_id)


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
    bullets: Iterable[str],
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


def draw_image_fit(
    c: canvas.Canvas,
    image_path: Path,
    x: float,
    y: float,
    width: float,
    height: float,
    *,
    valign: str = "center",
) -> None:
    with Image.open(image_path) as img:
        img_w, img_h = img.size

    scale = min(width / img_w, height / img_h)
    draw_w = img_w * scale
    draw_h = img_h * scale
    draw_x = x + (width - draw_w) / 2
    draw_y = y + (height - draw_h) if valign == "top" else y + (height - draw_h) / 2

    c.setFillColorRGB(0.06, 0.06, 0.06)
    c.rect(x, y, width, height, stroke=0, fill=1)
    c.drawImage(str(image_path), draw_x, draw_y, draw_w, draw_h, preserveAspectRatio=True, mask="auto")


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
    c.drawString(56, page_h - 170, "COI TRACKER")
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
    c.drawString(56, 57, "Certificate of Insurance Intelligence")
    c.showPage()


def draw_back_cover(c: canvas.Canvas, page_w: float, page_h: float, cta: str) -> None:
    c.setFillColorRGB(0.03, 0.03, 0.03)
    c.rect(0, 0, page_w, page_h, stroke=0, fill=1)
    draw_page_header(c, page_w, page_h, "Closing")
    draw_wrapped_paragraph(
        c, cta, 56, page_h / 2 + 20, page_w - 120, "Helvetica-Bold", 20, (0.95, 0.95, 0.95), 25
    )
    c.setFillColorRGB(0.6, 0.6, 0.6)
    c.setFont("Helvetica", 10)
    c.drawString(56, 72, "AXIOM - Enterprise Risk Intelligence")
    c.showPage()


def measure_asset_text_height(c: canvas.Canvas, asset: Asset, text_w: float) -> float:
    height = 0.0
    height += max(1, len(wrap_lines(c, asset.title, text_w, "Helvetica-Bold", 18))) * 22 + 10
    height += max(1, len(wrap_lines(c, asset.description, text_w, "Helvetica", 10.5))) * 14 + 10
    height += 16
    for bullet in asset.primary_features:
        height += max(1, len(wrap_lines(c, bullet, text_w - 10, "Helvetica", 9.5))) * 13
    height += 8 + 16
    for bullet in asset.sub_features:
        height += max(1, len(wrap_lines(c, bullet, text_w - 10, "Helvetica", 9.5))) * 13
    return height


def draw_asset_spread(c: canvas.Canvas, page_w: float, page_h: float, asset: Asset, index_label: str) -> None:
    c.setFillColorRGB(0.04, 0.04, 0.04)
    c.rect(0, 0, page_w, page_h, stroke=0, fill=1)
    draw_page_header(c, page_w, page_h, index_label)

    margin = 36
    content_top = page_h - 56
    content_bottom = 34
    gap = 26
    image_w = (page_w - (margin * 2) - gap) * 0.56
    text_w = page_w - (margin * 2) - gap - image_w

    image_x = margin
    image_y = content_bottom
    image_h = content_top - content_bottom
    draw_image_fit(c, asset.image_path, image_x, image_y, image_w, image_h, valign="top")

    text_x = image_x + image_w + gap
    text_h = measure_asset_text_height(c, asset, text_w)
    y = content_top - 4
    if text_h < image_h * 0.72:
        y = content_bottom + (image_h + text_h) / 2
    c.setFillColorRGB(1, 1, 1)
    c.setFont("Helvetica-Bold", 18)
    y = draw_wrapped_paragraph(c, asset.title, text_x, y, text_w, "Helvetica-Bold", 18, (0.96, 0.96, 0.96), 22)
    y -= 10
    y = draw_wrapped_paragraph(
        c, asset.description, text_x, y, text_w, "Helvetica", 10.5, (0.77, 0.77, 0.77), 14
    )
    y -= 10

    c.setFillColorRGB(0.8, 0.8, 0.8)
    c.setFont("Helvetica-Bold", 9.5)
    c.drawString(text_x, y, "PRIMARY FEATURES")
    y -= 16
    y = draw_bullets(
        c, asset.primary_features, text_x, y, text_w, "Helvetica", 9.5, (0.82, 0.82, 0.82), (0.65, 0.65, 0.65), 13
    )
    y -= 8
    c.setFillColorRGB(0.8, 0.8, 0.8)
    c.setFont("Helvetica-Bold", 9.5)
    c.drawString(text_x, y, "OPERATIONAL CALLOUTS")
    y -= 16
    draw_bullets(
        c, asset.sub_features, text_x, y, text_w, "Helvetica", 9.5, (0.82, 0.82, 0.82), (0.65, 0.65, 0.65), 13
    )
    c.showPage()


def draw_reporting_pair(c: canvas.Canvas, page_w: float, page_h: float, asset_a: Asset, asset_b: Asset) -> None:
    c.setFillColorRGB(0.04, 0.04, 0.04)
    c.rect(0, 0, page_w, page_h, stroke=0, fill=1)
    draw_page_header(c, page_w, page_h, "Reporting Spread")

    margin = 34
    gap = 16
    pane_w = (page_w - (margin * 2) - gap) / 2
    pane_h = page_h - 130
    y_base = 42

    for idx, asset in enumerate((asset_a, asset_b)):
        pane_x = margin + idx * (pane_w + gap)
        draw_image_fit(c, asset.image_path, pane_x, y_base + 92, pane_w, pane_h - 92)
        c.setFillColorRGB(0.95, 0.95, 0.95)
        c.setFont("Helvetica-Bold", 12)
        c.drawString(pane_x, y_base + 74, asset.title)
        draw_wrapped_paragraph(
            c, asset.description, pane_x, y_base + 58, pane_w, "Helvetica", 8.7, (0.72, 0.72, 0.72), 11
        )

    c.showPage()


def draw_individual_pdf(asset: Asset, target_file: Path) -> None:
    page_w, page_h = landscape(A4)
    c = canvas.Canvas(str(target_file), pagesize=(page_w, page_h))
    draw_asset_spread(c, page_w, page_h, asset, f"Asset {asset.asset_id:02d}")
    c.save()


def main() -> None:
    brief_text = BRIEF_PATH.read_text(encoding="utf-8")
    assets = parse_assets(brief_text)

    if not assets:
        raise RuntimeError("No assets were parsed from the content brief.")

    missing = [asset.filename for asset in assets if not asset.image_path.exists()]
    if missing:
        raise FileNotFoundError(
            "Missing expected screenshot files:\n" + "\n".join(f"- {name}" for name in missing)
        )

    front_headline = parse_quoted_value(brief_text, "Front cover headline")
    front_subheadline = parse_quoted_value(brief_text, "Front cover subheadline")
    back_cta = parse_quoted_value(brief_text, "Back cover CTA")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    INDIVIDUAL_DIR.mkdir(parents=True, exist_ok=True)

    # Individual one-page PDFs per screenshot.
    for asset in assets:
        draw_individual_pdf(asset, INDIVIDUAL_DIR / asset.pdf_name)

    # Master booklet PDF.
    page_w, page_h = landscape(A4)
    c = canvas.Canvas(str(BOOKLET_PATH), pagesize=(page_w, page_h))
    draw_cover(c, page_w, page_h, front_headline, front_subheadline)

    asset_by_id = {asset.asset_id: asset for asset in assets}
    for asset_id in MODAL_ASSET_SEQUENCE:
        asset = asset_by_id.get(asset_id)
        if not asset:
            raise RuntimeError(f"Missing dossier asset {asset_id:02d} in content brief.")

        if asset_id in (12, 13):
            continue

        draw_asset_spread(c, page_w, page_h, asset, f"Asset {asset.asset_id:02d}")

    draw_reporting_pair(c, page_w, page_h, asset_by_id[12], asset_by_id[13])

    draw_back_cover(c, page_w, page_h, back_cta)
    c.save()

    print(f"Booklet generated: {BOOKLET_PATH}")
    print(f"Individual PDFs generated in: {INDIVIDUAL_DIR}")


if __name__ == "__main__":
    main()
