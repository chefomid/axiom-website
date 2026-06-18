from __future__ import annotations

import sys
from dataclasses import dataclass, field
from pathlib import Path

from reportlab.lib.pagesizes import A4, landscape
from reportlab.pdfgen import canvas

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from booklet_layout import (  # noqa: E402
    draw_image_band,
    draw_images_gallery,
    draw_images_quad,
    draw_images_stacked,
    draw_vertical_spread,
    gallery_block_height,
    image_aspect,
    natural_height,
    quad_block_height,
    stacked_block_height,
)

BOOKLET_DIR = ROOT / "public" / "insurance-manager" / "booklet"
OUTPUT_DIR = ROOT / "public" / "insurance-manager"
BOOKLET_PATH = OUTPUT_DIR / "Insurance-Manager-Booklet.pdf"


@dataclass
class Spread:
    page_label: str
    title: str
    description: str
    primary: list[str] = field(default_factory=list)
    callouts: list[str] = field(default_factory=list)
    layout: str = "single"
    images: list[str] = field(default_factory=list)
    callout_note: str | None = None


# Mirrors InsuranceManagerModal.jsx DOSSIER (interactive dossier is source of truth).
DOSSIER: list[Spread] = [
    Spread(
        page_label="Portfolio",
        title="All Coverages in One View",
        description=(
            "GL, Auto, Property, WC, and Umbrella on one screen — dates, carriers, limits, "
            "exposures, and premiums."
        ),
        primary=[
            "AI extraction or guided manual import per line",
            "One-click exposure workbooks and BOR letters",
            "MODE toggle: AI or manual, same outputs",
        ],
        callouts=[
            "Whole program visible in minutes",
            "Hybrid automation: speed or auditability",
        ],
        layout="single",
        images=["02-portfolio-overview-manual-import.png"],
    ),
    Spread(
        page_label="Exposures",
        title="Detailed Exposure Views",
        description=(
            "Underwriter-ready schedules by line — GL locations, Auto fleet with NHTSA VIN check, "
            "WC payroll totals."
        ),
        primary=[
            "Sortable GL and Auto tables with Excel export",
            "NHTSA VIN validation with one-click corrections",
            "WC class codes with grand-total payroll",
        ],
        callouts=[
            "One model across Portfolio, Assistant, and Broker Connect",
            "Raw JSON tab on every line",
        ],
        layout="quad",
        images=[
            "03-exposures-gl-locations.png",
            "03-exposures-gl-exposures.png",
            "05-exposures-workers-comp-class-codes.png",
            "04-exposures-auto-vehicles.png",
        ],
        callout_note="NHTSA VIN Check — VINs decoded via NHTSA vPIC; make, model, and type compared to your schedule.",
    ),
    Spread(
        page_label="Broker Connect",
        title="Broker Connect",
        description=(
            "Endorsements, COIs, and renewal applications in one traceable flow with numbered "
            "outbound records."
        ),
        primary=[
            "Stack portfolio-wide changes into one broker email",
            "Upload carrier forms and stage renewal docs",
            "COI requests with COI-1 · END-1 tracker",
        ],
        callouts=[
            "One transaction across the portfolio",
            "Request history without leaving the app",
        ],
        layout="stack",
        images=[
            "06-broker-connect-new-endorsement.png",
            "06-broker-connect-applications.png",
        ],
    ),
    Spread(
        page_label="Mailman",
        title="Insurance Email Inside the Workflow",
        description="Outlook via Nylas — Inbox, Sent, and compose beside your portfolio imports.",
        primary=[
            "Reply or compose with attachments and thread tagging",
            "COI threads tied to workspace context",
            "Integrated with Broker Connect outbound tracker",
        ],
        callouts=[
            "Email stays inside operations",
            "API keys stay server-side",
        ],
        layout="gallery",
        images=[
            "10-mailman-inbox-powered-by-nylas.png",
            "12-mailman-compose-reply-in-context.png",
            "11-mailman-compose-new-email.png",
        ],
    ),
    Spread(
        page_label="Assistant",
        title="Assistant",
        description=(
            "Coverage intelligence in the same workspace — General Chat grounded in your session, "
            "Compliance for contract review."
        ),
        primary=[
            "Cloud or offline AI model choice",
            "Compliance: upload contracts, map gaps, export to broker",
        ],
        callouts=[
            "Grounded on vault facts, not invented limits",
            "Offline mode for data residency",
        ],
        layout="stack",
        images=[
            "13-assistant-01-general-chat.png",
            "14-assistant-02-compliance-start.png",
        ],
    ),
    Spread(
        page_label="Compliance 01",
        title="Add contracts and analyze",
        description=(
            "Upload contracts (.txt or .md), batch if needed, then Analyze. Requirements are checked "
            "against coverages in Portfolio."
        ),
        layout="hero",
        images=["15-assistant-03-compliance-upload.png"],
    ),
    Spread(
        page_label="Compliance 02",
        title="Reading your contract",
        description="Files are processed against policy data from your portfolio imports.",
        layout="hero",
        images=["16-assistant-04-compliance-reading.png"],
    ),
    Spread(
        page_label="Compliance 03",
        title="Gap identification",
        description=(
            "Each requirement mapped to your program. Non-compliant rows flag gaps with citations "
            "to policy files."
        ),
        layout="hero",
        images=["17-assistant-05-compliance-review-gaps.png"],
    ),
    Spread(
        page_label="Compliance 04",
        title="Partial matches",
        description=(
            "Partial when limits almost align but endorsements or waivers still need broker follow-up."
        ),
        layout="hero",
        images=["18-assistant-06-compliance-review-partial.png"],
    ),
    Spread(
        page_label="Compliance 05",
        title="Compliant requirements",
        description=(
            "Compliant rows confirm limits meet contract language. Export Excel and send to your broker."
        ),
        layout="hero",
        images=["19-assistant-07-compliance-review-compliant.png"],
    ),
]


def resolve_image(name: str) -> Path:
    path = BOOKLET_DIR / name
    if not path.exists():
        raise FileNotFoundError(f"Missing booklet screenshot: {path}")
    return path


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


def draw_page_header(c: canvas.Canvas, page_w: float, page_h: float, page_label: str) -> None:
    c.setFillColorRGB(0.44, 0.44, 0.44)
    c.setFont("Helvetica", 8.5)
    c.drawString(36, page_h - 26, "AXIOM")
    c.drawRightString(page_w - 36, page_h - 26, page_label.upper())
    c.setStrokeColorRGB(0.14, 0.14, 0.14)
    c.setLineWidth(1)
    c.line(30, page_h - 34, page_w - 30, page_h - 34)


def draw_cover(c: canvas.Canvas, page_w: float, page_h: float) -> None:
    c.setFillColorRGB(0.03, 0.03, 0.03)
    c.rect(0, 0, page_w, page_h, stroke=0, fill=1)
    c.setFillColorRGB(1, 1, 1)
    c.setFont("Helvetica-Bold", 33)
    c.drawString(56, page_h - 170, "INSURANCE MANAGER")
    draw_wrapped_paragraph(
        c,
        "Your program in one workspace.",
        56,
        page_h - 220,
        page_w - 120,
        "Helvetica-Bold",
        20,
        (0.95, 0.95, 0.95),
        25,
    )
    draw_wrapped_paragraph(
        c,
        "Faster intake. One source of truth. Broker-ready communication.",
        56,
        page_h - 252,
        page_w - 120,
        "Helvetica",
        12.5,
        (0.68, 0.68, 0.68),
        16,
    )
    c.setStrokeColorRGB(0.3, 0.3, 0.3)
    c.setLineWidth(1.4)
    c.line(56, 76, page_w - 56, 76)
    c.setFillColorRGB(0.55, 0.55, 0.55)
    c.setFont("Helvetica", 9)
    c.drawString(56, 57, "Insured Operations Intelligence")
    c.showPage()


def draw_back_cover(c: canvas.Canvas, page_w: float, page_h: float) -> None:
    c.setFillColorRGB(0.03, 0.03, 0.03)
    c.rect(0, 0, page_w, page_h, stroke=0, fill=1)
    draw_page_header(c, page_w, page_h, "Closing")
    y = draw_wrapped_paragraph(
        c,
        "Insurance operations with intelligence built in",
        56,
        page_h / 2 + 40,
        page_w - 120,
        "Helvetica-Bold",
        20,
        (0.95, 0.95, 0.95),
        25,
    )
    draw_wrapped_paragraph(
        c,
        (
            "AXIOM Insurance Manager turns policy PDFs and email threads into one auditable portfolio "
            "— then moves COIs, endorsements, and applications through Broker Connect and Mailman on "
            "infrastructure you already trust."
        ),
        56,
        y - 18,
        page_w - 120,
        "Helvetica",
        11,
        (0.72, 0.72, 0.72),
        15,
    )
    c.setFillColorRGB(0.6, 0.6, 0.6)
    c.setFont("Helvetica", 10)
    c.drawString(56, 72, "AXIOM - Enterprise Risk Intelligence")
    c.showPage()


def measure_text_panel_height(c: canvas.Canvas, spread: Spread, text_w: float) -> float:
    height = 0.0

    title_lines = wrap_lines(c, spread.title, text_w, "Helvetica-Bold", 18)
    height += max(1, len(title_lines)) * 22 + 10

    desc_lines = wrap_lines(c, spread.description, text_w, "Helvetica", 10.5)
    height += max(1, len(desc_lines)) * 14

    if spread.primary:
        height += 10 + 16
        for bullet in spread.primary:
            height += max(1, len(wrap_lines(c, bullet, text_w - 10, "Helvetica", 9.5))) * 13

    if spread.callouts:
        height += 8 + 16
        for bullet in spread.callouts:
            height += max(1, len(wrap_lines(c, bullet, text_w - 10, "Helvetica", 9.5))) * 13

    if spread.callout_note:
        height += 8 + 16
        height += max(1, len(wrap_lines(c, spread.callout_note, text_w, "Helvetica", 9.5))) * 13

    return height


def draw_text_panel(c: canvas.Canvas, spread: Spread, text_x: float, text_w: float, start_y: float) -> float:
    y = start_y
    y = draw_wrapped_paragraph(c, spread.title, text_x, y, text_w, "Helvetica-Bold", 18, (0.96, 0.96, 0.96), 22)
    y -= 10
    y = draw_wrapped_paragraph(
        c, spread.description, text_x, y, text_w, "Helvetica", 10.5, (0.77, 0.77, 0.77), 14
    )

    if spread.primary:
        y -= 10
        c.setFillColorRGB(0.8, 0.8, 0.8)
        c.setFont("Helvetica-Bold", 9.5)
        c.drawString(text_x, y, "PRIMARY FEATURES")
        y -= 16
        y = draw_bullets(
            c,
            spread.primary,
            text_x,
            y,
            text_w,
            "Helvetica",
            9.5,
            (0.82, 0.82, 0.82),
            (0.65, 0.65, 0.65),
            13,
        )

    if spread.callouts:
        y -= 8
        c.setFillColorRGB(0.8, 0.8, 0.8)
        c.setFont("Helvetica-Bold", 9.5)
        c.drawString(text_x, y, "OPERATIONAL CALLOUTS")
        y -= 16
        y = draw_bullets(
            c,
            spread.callouts,
            text_x,
            y,
            text_w,
            "Helvetica",
            9.5,
            (0.82, 0.82, 0.82),
            (0.65, 0.65, 0.65),
            13,
        )

    if spread.callout_note:
        y -= 8
        c.setFillColorRGB(0.8, 0.8, 0.8)
        c.setFont("Helvetica-Bold", 9.5)
        c.drawString(text_x, y, "NHTSA VIN CHECK")
        y -= 16
        draw_wrapped_paragraph(
            c, spread.callout_note, text_x, y, text_w, "Helvetica", 9.5, (0.72, 0.72, 0.72), 13
        )

    return y


def measure_image_block_height(spread: Spread, image_w: float, max_h: float) -> float:
    paths = [resolve_image(name) for name in spread.images]
    aspects = [image_aspect(path) for path in paths]

    if spread.layout == "single":
        return min(natural_height(image_w, aspects[0]), max_h)
    if spread.layout == "quad":
        return min(quad_block_height(image_w, aspects, gap=6), max_h)
    if spread.layout == "stack":
        return min(stacked_block_height(image_w, aspects, gap=8), max_h)
    if spread.layout == "gallery":
        return min(gallery_block_height(image_w, aspects, gap=8), max_h)
    raise ValueError(f"Unknown layout: {spread.layout}")


def draw_image_block(c: canvas.Canvas, spread: Spread, x: float, y: float, width: float, height: float) -> None:
    paths = [resolve_image(name) for name in spread.images]

    if spread.layout == "single":
        draw_image_band(c, paths[0], x, y, width, height, valign="top")
    elif spread.layout == "quad":
        draw_images_quad(c, paths, x, y, width, height, gap=6)
    elif spread.layout == "stack":
        draw_images_stacked(c, paths, x, y, width, height, gap=8)
    elif spread.layout == "gallery":
        draw_images_gallery(c, paths, x, y, width, height, gap=8)
    else:
        raise ValueError(f"Unknown layout: {spread.layout}")


def draw_hero_spread(c: canvas.Canvas, page_w: float, page_h: float, spread: Spread) -> None:
    image_path = resolve_image(spread.images[0])

    def draw_text(c: canvas.Canvas, margin: float, content_w: float, start_y: float) -> float:
        return draw_text_panel(
            c,
            Spread(
                page_label=spread.page_label,
                title=spread.title,
                description=spread.description,
            ),
            margin,
            content_w,
            start_y,
        )

    draw_vertical_spread(
        c,
        page_w,
        page_h,
        page_label=spread.page_label,
        margin=36,
        content_top=page_h - 56,
        content_bottom=34,
        image_path=image_path,
        draw_text=draw_text,
        draw_header=draw_page_header,
        image_max_fraction=0.55,
        text_gap=18,
    )


def draw_single_spread(c: canvas.Canvas, page_w: float, page_h: float, spread: Spread) -> None:
    image_path = resolve_image(spread.images[0])

    def draw_text(c: canvas.Canvas, margin: float, content_w: float, start_y: float) -> float:
        return draw_text_panel(c, spread, margin, content_w, start_y)

    draw_vertical_spread(
        c,
        page_w,
        page_h,
        page_label=spread.page_label,
        margin=36,
        content_top=page_h - 56,
        content_bottom=34,
        image_path=image_path,
        draw_text=draw_text,
        draw_header=draw_page_header,
        image_max_fraction=0.46,
        text_gap=18,
    )


def draw_spread(c: canvas.Canvas, page_w: float, page_h: float, spread: Spread) -> None:
    if spread.layout == "hero":
        draw_hero_spread(c, page_w, page_h, spread)
        return

    if spread.layout == "single":
        draw_single_spread(c, page_w, page_h, spread)
        return

    c.setFillColorRGB(0.04, 0.04, 0.04)
    c.rect(0, 0, page_w, page_h, stroke=0, fill=1)
    draw_page_header(c, page_w, page_h, spread.page_label)

    margin = 36
    content_top = page_h - 56
    content_bottom = 34
    gap = 26
    image_w = (page_w - (margin * 2) - gap) * 0.56
    text_w = page_w - (margin * 2) - gap - image_w
    image_x = margin
    available_h = content_top - content_bottom

    image_block_h = measure_image_block_height(spread, image_w, available_h)
    image_y = content_top - image_block_h

    draw_image_block(c, spread, image_x, image_y, image_w, image_block_h)

    text_x = image_x + image_w + gap
    text_h = measure_text_panel_height(c, spread, text_w)
    text_start_y = content_top - 4
    if text_h < image_block_h * 0.72:
        text_start_y = image_y + (image_block_h + text_h) / 2

    draw_text_panel(c, spread, text_x, text_w, text_start_y)
    c.showPage()


def collect_required_images() -> list[str]:
    names: list[str] = []
    for spread in DOSSIER:
        names.extend(spread.images)
    return names


def main() -> None:
    missing = [name for name in collect_required_images() if not (BOOKLET_DIR / name).exists()]
    if missing:
        raise FileNotFoundError(
            "Missing expected booklet screenshots:\n" + "\n".join(f"- {name}" for name in missing)
        )

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    page_w, page_h = landscape(A4)
    c = canvas.Canvas(str(BOOKLET_PATH), pagesize=(page_w, page_h))
    draw_cover(c, page_w, page_h)

    for spread in DOSSIER:
        draw_spread(c, page_w, page_h, spread)

    draw_back_cover(c, page_w, page_h)
    c.save()

    image_count = len(collect_required_images())
    print(f"Booklet generated: {BOOKLET_PATH}")
    print(f"Spreads: {len(DOSSIER)} · Screenshots embedded: {image_count}/{image_count}")


if __name__ == "__main__":
    main()
