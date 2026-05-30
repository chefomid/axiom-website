"""Server-side HTML renderer for Playwright PDF capture (no Vite/React required)."""

from __future__ import annotations

import html
from pathlib import Path
from typing import Any

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


def render_report_html(document: dict[str, Any]) -> str:
    meta = document.get("meta") or {}
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
