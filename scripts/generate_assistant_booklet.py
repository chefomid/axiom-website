from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

from PIL import Image
from reportlab.lib.pagesizes import A4, landscape
from reportlab.pdfgen import canvas

ROOT = Path(r"c:\Users\Orcc_\OneDrive\Desktop\AXIOM\website")
BOOKLET_DIR = ROOT / "public" / "insurance-manager" / "booklet"
OUTPUT_DIR = ROOT / "InsuranceManager" / "output"
OUTPUT_PATH = OUTPUT_DIR / "Assistant-Booklet.pdf"

# Layout rhythm (8pt grid)
MARGIN_X = 56
MARGIN_TOP = 52
FOOTER_H = 44
IMAGE_TEXT_GAP = 44
TITLE_BODY_GAP = 12
SECTION_GAP = 22

# Type scale
COLOR_TITLE = (0.97, 0.97, 0.97)
COLOR_BODY = (0.74, 0.74, 0.74)
COLOR_MUTED = (0.52, 0.52, 0.52)
COLOR_ACCENT = (0.78, 0.62, 0.28)

EXECUTIVE_SUMMARY = (
    "Assistant is the coverage intelligence layer inside Insurance Manager. "
    "It answers portfolio questions in General Chat and reviews contracts in Compliance, "
    "always grounded in the book you imported. Teams can choose cloud or offline models, "
    "surface gaps with citations, and export broker-ready reports from one workspace."
)

ASSISTANT = {
    "primary": [
        "Model selector with cloud models or offline AI mode",
        "General Chat with evidence tables tied to your portfolio session",
        "Compliance workflow to map contract requirements to your program",
        "Broker-ready exports: Excel download, workspace save, tag, and send",
    ],
    "callouts": [
        "Same normalized session as Portfolio, Exposures, Broker Connect, and Mailman",
        "Grounded on vault facts in your workspace, not invented limits or carriers",
        "Offline mode when data residency or air-gapped review matters",
    ],
    "compliance_steps": [
        {
            "image": "15-assistant-03-compliance-upload.png",
            "title": "Add contracts and analyze",
            "body": (
                "Drop or browse contract files in Compliance (.txt and .md work best). Batch several "
                "files, review the list, then click Analyze. Requirements are extracted from your "
                "contracts and checked against coverages already in Portfolio."
            ),
        },
        {
            "image": "16-assistant-04-compliance-reading.png",
            "title": "Reading your contract",
            "body": (
                "Assistant processes uploaded files against policy data from your portfolio imports. "
                "Your API key runs the checks; large files may be truncated per model limits."
            ),
        },
        {
            "image": "17-assistant-05-compliance-review-gaps.png",
            "title": "Gap identification",
            "body": (
                "The review table maps each contract requirement to your program. Non-compliant rows "
                "flag missing coverage with explanations and citations back to declarations, forms "
                "schedules, and policy files in your workspace."
            ),
        },
        {
            "image": "18-assistant-06-compliance-review-partial.png",
            "title": "Partial matches",
            "body": (
                "Partial status when limits or wording almost align but endorsements, additional insured "
                "status, waivers, or duration requirements still need broker follow-up. Each row cites "
                "the closest proof found in your book."
            ),
        },
        {
            "image": "19-assistant-07-compliance-review-compliant.png",
            "title": "Compliant requirements",
            "body": (
                "Compliant rows confirm umbrella, WC, GL, auto, and other limits meet contract language "
                "with source references. Download Excel, save to workspace, tag the request, and send "
                "the report to your broker from the page."
            ),
        },
    ],
}


@dataclass
class TextSection:
    label: str | None = None
    lines: list[str] = field(default_factory=list)
    font_name: str = "Helvetica"
    font_size: float = 10.5
    leading: float = 15
    color: tuple[float, float, float] = (0.76, 0.76, 0.76)
    label_color: tuple[float, float, float] = (0.58, 0.58, 0.58)
    label_size: float = 9.5
    label_gap: float = 8
    section_gap: float = 18


@dataclass
class Spread:
    page_label: str
    title: str
    body: str
    image_name: str | None = None
    sections: list[TextSection] = field(default_factory=list)


def image_path(name: str | None) -> Path | None:
    if not name:
        return None
    path = BOOKLET_DIR / name
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


def section_height(c: canvas.Canvas, section: TextSection, width: float) -> float:
    height = 0.0
    if section.label:
        height += section.label_size + section.label_gap
    for line in section.lines:
        wrapped = wrap_lines(c, line, width, section.font_name, section.font_size)
        height += max(1, len(wrapped)) * section.leading
    return height


def text_block_height(
    c: canvas.Canvas,
    title: str,
    body: str,
    sections: list[TextSection],
    width: float,
    title_size: float = 20,
    title_leading: float = 24,
    body_size: float = 10.5,
    body_leading: float = 15,
    title_body_gap: float = 14,
    body_section_gap: float = 20,
) -> float:
    title_lines = wrap_lines(c, title, width, "Helvetica-Bold", title_size)
    body_lines = wrap_lines(c, body, width, "Helvetica", body_size)

    height = len(title_lines) * title_leading
    height += title_body_gap
    height += len(body_lines) * body_leading

    if sections:
        height += body_section_gap
        for index, section in enumerate(sections):
            height += section_height(c, section, width)
            if index < len(sections) - 1:
                height += section.section_gap

    return height


def draw_page_bg(c: canvas.Canvas, page_w: float, page_h: float) -> None:
    c.setFillColorRGB(0.04, 0.04, 0.04)
    c.rect(0, 0, page_w, page_h, stroke=0, fill=1)


def draw_page_footer(c: canvas.Canvas, page_w: float, page_label: str) -> None:
    c.setFillColorRGB(0.34, 0.34, 0.34)
    c.setFont("Helvetica", 7.5)
    c.drawString(MARGIN_X, 24, "AXIOM Insurance Manager · Assistant")
    c.drawRightString(page_w - MARGIN_X, 24, page_label)


def draw_cover(c: canvas.Canvas, page_w: float, page_h: float) -> None:
    draw_page_bg(c, page_w, page_h)

    center_y = page_h * 0.52

    c.setFillColorRGB(*COLOR_ACCENT)
    c.roundRect(page_w / 2 - 24, center_y + 58, 48, 2.5, 1.2, stroke=0, fill=1)

    c.setFillColorRGB(*COLOR_TITLE)
    c.setFont("Helvetica-Bold", 38)
    c.drawCentredString(page_w / 2, center_y + 12, "Assistant")

    c.setFillColorRGB(*COLOR_BODY)
    c.setFont("Helvetica", 13)
    c.drawCentredString(page_w / 2, center_y - 22, "Coverage intelligence inside your portfolio workspace")

    c.setFillColorRGB(*COLOR_MUTED)
    c.setFont("Helvetica", 10)
    c.drawCentredString(page_w / 2, center_y - 50, "General Chat  ·  Compliance  ·  Broker-ready output")

    c.setFillColorRGB(0.32, 0.32, 0.32)
    c.setFont("Helvetica", 8)
    c.drawCentredString(page_w / 2, 48, "Internal reference")
    c.showPage()


def draw_executive_summary(c: canvas.Canvas, page_w: float, page_h: float) -> None:
    draw_page_bg(c, page_w, page_h)

    text_w = page_w - MARGIN_X * 2
    block_top = page_h * 0.56

    c.setFillColorRGB(*COLOR_MUTED)
    c.setFont("Helvetica", 9)
    c.drawString(MARGIN_X, block_top + 40, "Executive summary")

    c.setFillColorRGB(*COLOR_TITLE)
    c.setFont("Helvetica-Bold", 24)
    c.drawString(MARGIN_X, block_top, "What Assistant does")

    y = block_top - 32
    y = draw_wrapped_paragraph(
        c,
        EXECUTIVE_SUMMARY,
        MARGIN_X,
        y,
        text_w,
        "Helvetica",
        11.5,
        COLOR_BODY,
        17,
    )

    highlights = [
        "Session-grounded answers with evidence tables",
        "Contract compliance mapped to your imported program",
        "Cloud or offline model choice for your policy",
    ]
    y -= 36
    c.setFillColorRGB(*COLOR_MUTED)
    c.setFont("Helvetica", 9)
    c.drawString(MARGIN_X, y, "At a glance")
    y -= 24
    for point in highlights:
        c.setFillColorRGB(*COLOR_ACCENT)
        c.circle(MARGIN_X + 3, y + 3, 2.2, fill=1, stroke=0)
        c.setFillColorRGB(*COLOR_BODY)
        c.setFont("Helvetica", 10.5)
        c.drawString(MARGIN_X + 14, y, point)
        y -= 20

    draw_page_footer(c, page_w, "Summary")
    c.showPage()


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
    for line in wrap_lines(c, text, width, font_name, font_size):
        c.setFont(font_name, font_size)
        c.drawString(x, y, line)
        y -= leading
    return y


def draw_section(c: canvas.Canvas, section: TextSection, x: float, y: float, width: float) -> float:
    if section.label:
        c.setFillColorRGB(*COLOR_MUTED)
        c.setFont("Helvetica", section.label_size)
        c.drawString(x, y, section.label.upper())
        y -= section.label_size + section.label_gap

    for line in section.lines:
        wrapped = wrap_lines(c, line, width - 12, section.font_name, section.font_size)
        c.setFillColorRGB(*section.color)
        for wrapped_line in wrapped:
            c.setFont(section.font_name, section.font_size)
            c.drawString(x + 12, y, wrapped_line)
            y -= section.leading
    return y


def draw_image(c: canvas.Canvas, path: Path, x: float, y: float, width: float, height: float) -> None:
    with Image.open(path) as img:
        img_w, img_h = img.size

    scale = min(width / img_w, height / img_h)
    draw_w = img_w * scale
    draw_h = img_h * scale
    draw_x = x + (width - draw_w) / 2
    draw_y = y + (height - draw_h) / 2

    c.drawImage(str(path), draw_x, draw_y, draw_w, draw_h, preserveAspectRatio=True, mask="auto")


def draw_spread(c: canvas.Canvas, page_w: float, page_h: float, spread: Spread) -> None:
    draw_page_bg(c, page_w, page_h)

    content_top = page_h - MARGIN_TOP
    content_bottom = FOOTER_H + 16
    content_h = content_top - content_bottom
    text_w = page_w - MARGIN_X * 2

    image_ratio = 0.46 if spread.sections else 0.6
    image_h = content_h * image_ratio

    path = image_path(spread.image_name)
    if path:
        image_y = content_top - image_h
        draw_image(c, path, MARGIN_X, image_y, text_w, image_h)
        y = image_y - IMAGE_TEXT_GAP
    else:
        y = content_top - 8

    title_lines = wrap_lines(c, spread.title, text_w, "Helvetica-Bold", 19)
    c.setFillColorRGB(*COLOR_TITLE)
    c.setFont("Helvetica-Bold", 19)
    for line in title_lines:
        c.drawString(MARGIN_X, y, line)
        y -= 24

    y -= TITLE_BODY_GAP
    y = draw_wrapped_paragraph(c, spread.body, MARGIN_X, y, text_w, "Helvetica", 10.5, COLOR_BODY, 15)

    if spread.sections:
        y -= SECTION_GAP
        for index, section in enumerate(spread.sections):
            y = draw_section(c, section, MARGIN_X, y, text_w)
            if index < len(spread.sections) - 1:
                y -= section.section_gap

    draw_page_footer(c, page_w, spread.page_label)
    c.showPage()


def build_spreads() -> list[Spread]:
    feature_section = TextSection(
        label="Capabilities",
        lines=ASSISTANT["primary"],
        color=COLOR_BODY,
        font_size=10,
        leading=14,
        section_gap=16,
    )
    callout_section = TextSection(
        label="Why it matters",
        lines=ASSISTANT["callouts"],
        color=(0.68, 0.68, 0.68),
        font_size=10,
        leading=14,
    )

    spreads = [
        Spread(
            page_label="General Chat",
            title="Ask questions against your book",
            body=(
                "General Chat answers coverage questions using the portfolio session you already imported. "
                "Responses include evidence tables with carrier, policy, limits, and proof so teams can "
                "move quickly without guessing."
            ),
            image_name="13-assistant-01-general-chat.png",
            sections=[feature_section, callout_section],
        ),
        Spread(
            page_label="Compliance",
            title="Contract compliance review",
            body=(
                "Compliance uploads contracts, maps requirements to your program, and walks through gaps, "
                "partial matches, and compliant rows. Export broker-ready output without leaving the workspace."
            ),
            image_name="14-assistant-02-compliance-start.png",
        ),
    ]

    for index, step in enumerate(ASSISTANT["compliance_steps"], start=1):
        body = step["body"]
        spreads.append(
            Spread(
                page_label=f"Step {index}",
                title=step["title"],
                body=body,
                image_name=step["image"],
            )
        )

    return spreads


def main() -> None:
    spreads = build_spreads()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    page_w, page_h = landscape(A4)
    c = canvas.Canvas(str(OUTPUT_PATH), pagesize=(page_w, page_h))

    draw_cover(c, page_w, page_h)
    draw_executive_summary(c, page_w, page_h)
    for spread in spreads:
        draw_spread(c, page_w, page_h, spread)

    c.save()

    available = sum(1 for spread in spreads if image_path(spread.image_name))
    print(f"Assistant booklet generated: {OUTPUT_PATH}")
    print(f"Spreads with screenshots: {available}/{len(spreads)}")


if __name__ == "__main__":
    main()
