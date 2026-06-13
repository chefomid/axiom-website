"""Server-side HTML renderer for Playwright PDF capture (no Vite/React required)."""

from __future__ import annotations

import html
from pathlib import Path
from typing import Any

import markdown

_PDF_CSS_PATH = Path(__file__).resolve().parent / "report_pdf_styles.css"


def _esc(value: Any) -> str:
    return html.escape("" if value is None else str(value))


def _load_pdf_css() -> str:
    if _PDF_CSS_PATH.is_file():
        return _PDF_CSS_PATH.read_text(encoding="utf-8")
    return ""


def _page_wrap(content: str) -> str:
    return f'<div class="report-page">{content}</div>'


def _page_header(meta: dict[str, Any]) -> str:
    return f"""
    <header class="report-header">
      <div class="report-brand">{_esc(meta.get('preparedBy'))}</div>
      <div class="report-meta-right">
        <div>{_esc(meta.get('title'))}</div>
        <div>{_esc(meta.get('generatedDate'))}</div>
      </div>
    </header>
    """


def _section_title(title: str, subtitle: str | None = None) -> str:
    subtitle_html = f'<p class="report-section-subtitle">{_esc(subtitle)}</p>' if subtitle else ""
    return f"""
    <h2 class="report-section-title">{_esc(title)}</h2>
    {subtitle_html}
    """


def _parameter_table(rows: list[dict[str, Any]]) -> str:
    body = "".join(
        f"<tr><td>{_esc(row.get('label'))}</td><td>{_esc(row.get('value'))}</td></tr>"
        for row in rows or []
    )
    return f"""
    <table class="report-table">
      <thead><tr><th>Parameter</th><th style="text-align:right">Value</th></tr></thead>
      <tbody>{body}</tbody>
    </table>
    """


def _kpi_grid(kpis: list[dict[str, Any]]) -> str:
    cells = "".join(
        f"""
        <div class="report-kpi">
          <div class="report-kpi-label">{_esc(kpi.get('label'))}</div>
          <div class="report-kpi-value{' report-kpi-value--accent' if kpi.get('highlight') else ''}">
            {_esc(kpi.get('value'))}
          </div>
        </div>
        """
        for kpi in kpis or []
    )
    return f'<div class="report-kpi-grid">{cells}</div>'


def _data_table(table: dict[str, Any]) -> str:
    columns = table.get("columns") or ["Band", "Value"]
    rows = table.get("rows") or []
    if not rows:
        return ""
    head = "".join(
        f'<th style="text-align:right">{_esc(col)}</th>' if i else f"<th>{_esc(col)}</th>"
        for i, col in enumerate(columns)
    )
    body = "".join(
        f"<tr><td>{_esc(row.get('label'))}</td><td>{_esc(row.get('value'))}</td></tr>"
        for row in rows
    )
    unit = table.get("unit")
    unit_html = f'<div class="report-table-unit">Unit: {_esc(unit)}</div>' if unit else ""
    return f"""
    <div class="report-section">
      <div class="report-table-caption">{_esc(table.get('title'))}</div>
      {unit_html}
      <table class="report-table">
        <thead><tr>{head}</tr></thead>
        <tbody>{body}</tbody>
      </table>
    </div>
    """


def _strip_md_frontmatter(md: str) -> str:
    if not md.startswith("---"):
        return md
    end = md.find("---", 3)
    if end == -1:
        return md
    return md[end + 3 :].lstrip()


def render_inspection_digest_html(md: str) -> str:
    """Convert Property Inspector Markdown digest to HTML for PDF embedding."""
    if not md or not md.strip():
        return ""
    body = _strip_md_frontmatter(md)
    html_body = markdown.markdown(body, extensions=["tables", "nl2br"])
    return f'<div class="report-inspection-digest">{html_body}</div>'


def _inspection_imagery_gallery(vision: dict[str, Any]) -> str:
    captures = vision.get("imagery_captures") or []
    if not captures:
        return ""
    cells = []
    for cap in captures:
        data_url = cap.get("data_url") or ""
        if not data_url:
            continue
        label = cap.get("label") or cap.get("image_id") or "Capture"
        heading = cap.get("heading")
        meta = f" @ {heading}°" if heading is not None else ""
        selected = " report-imagery-card--selected" if cap.get("selected") else ""
        cells.append(
            f"""
            <figure class="report-imagery-card{selected}">
              <img src="{data_url}" alt="{_esc(label)}" loading="lazy" />
              <figcaption>{_esc(label)}{_esc(meta)}</figcaption>
            </figure>
            """
        )
    if not cells:
        return ""
    return f'<div class="report-imagery-grid">{"".join(cells)}</div>'


def _inspection_summary_table(vision: dict[str, Any]) -> str:
    rows = [
        ("Stories (visible)", vision.get("stories_visible")),
        ("ISO class", vision.get("iso_class")),
        ("ISO label", vision.get("iso_label")),
        ("Confidence", vision.get("confidence")),
    ]
    body = "".join(
        f"<tr><td>{_esc(label)}</td><td>{_esc(val if val is not None else '—')}</td></tr>"
        for label, val in rows
    )
    return f"""
    <table class="report-table">
      <thead><tr><th>Metric</th><th>Value</th></tr></thead>
      <tbody>{body}</tbody>
    </table>
    """


def _analysis_section(section: dict[str, Any]) -> str:
    narrative = "".join(
        f'<p class="report-body">{_esc(p)}</p>' for p in section.get("narrative") or []
    )
    metrics = section.get("metrics") or []
    metrics_html = ""
    if metrics:
        cells = "".join(
            f"""
            <div class="report-metric-inline">
              <div class="report-metric-inline-label">{_esc(m.get('label'))}</div>
              <div class="report-metric-inline-value">{_esc(m.get('value'))}</div>
            </div>
            """
            for m in metrics
        )
        metrics_html = f'<div class="report-metrics-inline">{cells}</div>'
    table_html = _data_table(section["table"]) if section.get("table") else ""
    return f"""
    <section class="report-section">
      {_section_title(section.get('title', ''))}
      {narrative}
      {metrics_html}
      {table_html}
    </section>
    """


def render_cope_report_html(document: dict[str, Any]) -> str:
    meta = document.get("meta") or {}
    css = _load_pdf_css()
    cope_sections = document.get("copeSections") or []
    score = document.get("copeScore") or {}
    conflicts = document.get("conflicts") or []
    receipt = document.get("receipt") or {}
    hazards = document.get("hazardsSummary") or []
    vision = document.get("visionAnalysis") or {}
    sov_digest = document.get("sovDigestMd")
    statement_of_values = document.get("statementOfValues") or {}

    cope_rows = []
    for section in cope_sections:
        for field in section.get("fields") or []:
            cope_rows.append(
                {
                    "section": section.get("label") or section.get("id") or "",
                    "field": field.get("label") or field.get("id") or "",
                    "value": field.get("value") or field.get("note") or "Unknown",
                    "source": field.get("source") or "—",
                    "confidence": field.get("confidence") or "unknown",
                }
            )

    cope_table = ""
    if cope_rows:
        body = "".join(
            f"<tr><td>{_esc(row['section'])}</td><td>{_esc(row['field'])}</td>"
            f"<td>{_esc(row['value'])}</td><td>{_esc(row['source'])}</td>"
            f"<td>{_esc(row['confidence'])}</td></tr>"
            for row in cope_rows
        )
        cope_table = f"""
        <table class="report-table">
          <thead>
            <tr>
              <th>Section</th><th>Field</th><th>Value</th><th>Source</th><th>Confidence</th>
            </tr>
          </thead>
          <tbody>{body}</tbody>
        </table>
        """

    conflict_html = ""
    if conflicts:
        items = "".join(
            f"<li><strong>{_esc(c.get('field_id', '').replace('_', ' '))}</strong>: "
            + "; ".join(
                f"{_esc(a.get('value'))} ({_esc(a.get('source'))})"
                for a in (c.get("alternatives") or [])
            )
            + "</li>"
            for c in conflicts
        )
        conflict_html = f"""
        <section class="report-section">
          {_section_title('Source conflicts')}
          <ul class="report-bullets">{items}</ul>
        </section>
        """

    hazard_html = ""
    if hazards:
        items = "".join(
            f"<li><strong>{_esc(h.get('source'))}</strong>: {_esc(h.get('summary'))}</li>"
            for h in hazards
        )
        hazard_html = f"""
        <section class="report-section">
          {_section_title('Environmental hazards summary')}
          <ul class="report-bullets">{items}</ul>
        </section>
        """

    receipt_html = ""
    totals = receipt.get("totals") or {}
    if totals:
        receipt_html = f"""
        <section class="report-section">
          {_section_title('Run receipt')}
          <p class="report-body">Loaded cost: ${_esc(totals.get('loaded_cost_usd', '—'))} ·
          User price: ${_esc(totals.get('user_price_usd', '—'))}</p>
          <p class="report-body">{_esc(totals.get('note', ''))}</p>
        </section>
        """

    sov_html = ""
    if sov_digest or statement_of_values:
        unresolved = sum(
            1
            for d in (document.get("sovAnalysis") or {}).get("discrepancies") or []
            if d.get("status") != "resolved"
        )
        warn = ""
        if unresolved:
            warn = f'<p class="report-warn">{unresolved} unresolved SOV discrepancy(ies) — verify before binding.</p>'
        sov_html = f"""
        <section class="report-section">
          {_section_title('Statement of Values', 'Multi-lane reconciliation across vendor API, online public, and visual AI.')}
          {warn}
          {render_inspection_digest_html(sov_digest) if sov_digest else ''}
        </section>
        """

    inspection_html = ""
    digest_md = vision.get("inspection_digest_md")
    if digest_md:
        disclaimer = vision.get("disclaimer") or meta.get("visionDisclaimer") or ""
        inspection_html = f"""
        <section class="report-section">
          {_section_title('Image analysis', 'Property Inspector agent — Street View and satellite visual inspection.')}
          <p class="report-warn">{_esc(disclaimer)}</p>
          {_inspection_imagery_gallery(vision)}
          {_inspection_summary_table(vision)}
          {render_inspection_digest_html(digest_md)}
        </section>
        """

    pages = [
        _page_wrap(f"""
        <div class="report-cover-brand">{_esc(meta.get('preparedBy'))} Intelligence</div>
        <h1 class="report-cover-title">{_esc(meta.get('title'))}</h1>
        <p class="report-cover-location">{_esc(meta.get('location'))}</p>
        <div class="report-cover-meta">
          <p><strong>Report ID:</strong> {_esc(meta.get('reportId'))}</p>
          <p><strong>Generated:</strong> {_esc(meta.get('generatedDate'))}</p>
          <p><strong>Completeness:</strong> {_esc(score.get('completeness_pct', 0))}%</p>
        </div>
        """),
        _page_wrap(f"""
        {_page_header(meta)}
        {_section_title('COPE snapshot', 'Construction, Occupancy, Protection, and Exposure.')}
        {cope_table}
        {sov_html}
        {inspection_html}
        {hazard_html}
        {conflict_html}
        {receipt_html}
        <div class="report-footer-block">
          <p>{_esc(meta.get('dataSource'))}. Field values reflect selected sources at generation time.</p>
        </div>
        """),
    ]

    body = f'<div id="report-print-ready">{"".join(pages)}</div>'
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>{_esc(meta.get('title'))}</title>
  <style>{css}</style>
</head>
<body>{body}</body>
</html>"""


def render_report_html(document: dict[str, Any]) -> str:
    meta = document.get("meta") or {}
    if meta.get("type") == "cope" or document.get("copeSections"):
        return render_cope_report_html(document)
    css = _load_pdf_css()
    pages: list[str] = []

    if document.get("noData"):
        pages.append(
            _page_wrap(f"""
            <div class="report-cover-brand">{_esc(meta.get('preparedBy'))}</div>
            <h1 class="report-cover-title">{_esc(meta.get('title'))}</h1>
            <p class="report-cover-location">{_esc(meta.get('location'))}</p>
            <p class="report-body">{_esc(document.get('noDataMessage'))}</p>
            """)
        )
    else:
        exec_summary = document.get("executiveSummary") or {}
        bullets = "".join(f"<li>{_esc(b)}</li>" for b in exec_summary.get("bullets") or [])
        methodology = document.get("methodology") or {}

        pages.append(
            _page_wrap(f"""
            <div class="report-cover-brand">{_esc(meta.get('preparedBy'))} Intelligence</div>
            <h1 class="report-cover-title">{_esc(meta.get('title'))}</h1>
            <p class="report-cover-type">{_esc(meta.get('type'))}</p>
            <p class="report-cover-location">{_esc(meta.get('location'))}</p>
            <div class="report-cover-meta">
              <p><strong>Prepared by:</strong> {_esc(meta.get('preparedBy'))}</p>
              <p><strong>Generated:</strong> {_esc(meta.get('generatedDate'))}</p>
              <p><strong>Source:</strong> {_esc(meta.get('dataSource'))}</p>
            </div>
            <div class="report-insight">
              <div class="report-insight-label">
                Executive summary
                <span class="report-badge">{_esc(exec_summary.get('activityLevel'))}</span>
              </div>
              <p class="report-body">{_esc(exec_summary.get('headline'))}</p>
              <p class="report-body">{_esc(exec_summary.get('meaning'))}</p>
              <ul class="report-bullets">{bullets}</ul>
            </div>
            """)
        )

        pages.append(
            _page_wrap(f"""
            {_page_header(meta)}
            {_section_title('Search parameters', 'Catalog filters applied to this report.')}
            {_parameter_table(document.get('parameters') or [])}
            <div class="report-section">
              {_section_title('Key metrics', 'Summary indicators for the selected window.')}
              {_kpi_grid(document.get('kpis') or [])}
            </div>
            """)
        )

        if document.get("catalogTables"):
            tables = "".join(_data_table(t) for t in document["catalogTables"])
            pages.append(
                _page_wrap(f"""
                {_page_header(meta)}
                {_section_title('Catalog analysis', 'USGS event counts for this report focus — tables include explicit units.')}
                {tables}
                """)
            )

        if document.get("analysisSections"):
            sections = "".join(_analysis_section(s) for s in document["analysisSections"])
            pages.append(
                _page_wrap(f"""
                {_page_header(meta)}
                {_section_title('Detailed analysis', 'Section-specific findings from the USGS catalog.')}
                {sections}
                """)
            )

        quality_note = ""
        if methodology.get("dataQualityNote"):
            quality_note = f'<p class="report-warn">{_esc(methodology.get("dataQualityNote"))}</p>'

        pages.append(
            _page_wrap(f"""
            {_page_header(meta)}
            {_section_title('Data and limitations')}
            <div class="report-footer-block">
              <p><strong>Source:</strong> {_esc(methodology.get('source'))}. Counts reflect published historical
              records for the selected magnitude threshold and time window.</p>
              <p>{_esc(methodology.get('disclaimer'))}</p>
              {quality_note}
            </div>
            """)
        )

    body = f'<div id="report-print-ready">{"".join(pages)}</div>'

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>{_esc(meta.get('title'))}</title>
  <style>{css}</style>
</head>
<body>{body}</body>
</html>"""
