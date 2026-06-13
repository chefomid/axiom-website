"""Deterministic ISO 1–6 inference from vision cues (not LLM-assigned)."""

from __future__ import annotations

import re
from typing import Any

ISO_DEFINITIONS: dict[int, str] = {
    1: "Frame",
    2: "Joisted masonry",
    3: "Noncombustible",
    4: "Masonry noncombustible",
    5: "Modified fire resistive",
    6: "Fire resistive",
}


def _text_blob(vision: dict[str, Any]) -> str:
    parts = [
        vision.get("facadeMaterial") or "",
        vision.get("roofMaterial") or "",
        vision.get("constructionTypeEstimate") or "",
        " ".join(vision.get("structuralClues") or []),
    ]
    return " ".join(parts).lower()


def _has_any(text: str, patterns: list[str]) -> bool:
    return any(re.search(p, text) for p in patterns)


def _confidence_rank(level: str) -> int:
    return {"high": 0, "medium": 1, "low": 2}.get(level, 2)


def _min_confidence(a: str, b: str) -> str:
    return a if _confidence_rank(a) >= _confidence_rank(b) else b


def infer_iso(vision: dict[str, Any]) -> dict[str, Any]:
    """
    Map normalized vision cues to ISO construction class.
    Returns iso_class (e.g. ISO 2), iso_label, confidence_cap, rationale, limitations.
    """
    text = _text_blob(vision)
    llm_conf = vision.get("confidence") or "medium"
    rationale: list[str] = []
    extra_limitations: list[str] = []

    frame_cues = _has_any(
        text,
        [
            r"\bwood\b",
            r"\bframe\b",
            r"\bsiding\b",
            r"\bvinyl\b",
            r"\bhardiplank\b",
            r"\bstucco on wood\b",
        ],
    )
    masonry_cues = _has_any(
        text,
        [
            r"\bmason",
            r"\bbrick\b",
            r"\bconcrete block\b",
            r"\bcb\b",
            r"\bstone\b",
            r"\btile\b",
            r"\badobe\b",
        ],
    )
    metal_cues = _has_any(
        text,
        [
            r"\bmetal\b",
            r"\bsteel\b",
            r"\bcorrugated\b",
            r"\bnoncombust",
        ],
    )
    combust_roof = _has_any(
        text,
        [
            r"\bshingle\b",
            r"\bwood\b.*\broof\b",
            r"\basphalt\b",
            r"\bcombust",
            r"\bcomposition\b",
        ],
    )
    noncomb_roof = _has_any(
        text,
        [
            r"\bmetal roof\b",
            r"\bmembrane\b",
            r"\bnoncombust.*roof\b",
            r"\bconcrete roof\b",
        ],
    )
    fire_resistive = _has_any(
        text,
        [
            r"\bfire[- ]resist",
            r"\bcurtain wall\b",
            r"\bconcrete frame\b",
            r"\bhigh[- ]rise\b",
            r"\b2[- ]hour\b",
        ],
    )
    modified_fr = _has_any(
        text,
        [
            r"\bmodified fire",
            r"\b1[- ]hour\b",
            r"\brated assembly\b",
        ],
    )

    iso_num: int | None = None

    if frame_cues and masonry_cues:
        extra_limitations.append("Mixed frame and masonry cues — classification uncertain")
        iso_num = 2 if masonry_cues else 1
        rationale.append("Conflicting facade cues; defaulting to lower-confidence masonry/frame blend")
    elif fire_resistive:
        iso_num = 6
        rationale.append("Fire-resistive structural cues visible or inferred from imagery")
    elif modified_fr:
        iso_num = 5
        rationale.append("Modified fire-resistive assembly cues suggested")
    elif masonry_cues and noncomb_roof and not combust_roof:
        iso_num = 4
        rationale.append("Masonry walls with noncombustible roof deck cues")
    elif masonry_cues and (combust_roof or not noncomb_roof):
        iso_num = 2
        rationale.append("Masonry or concrete block walls with combustible roof or upper construction")
    elif metal_cues and not masonry_cues:
        iso_num = 3
        rationale.append("Noncombustible metal or steel shell without masonry load walls")
    elif frame_cues:
        iso_num = 1
        rationale.append("Wood or frame construction dominant on visible elevations")
    elif _has_any(text, [r"\bjoisted masonry\b", r"\bjm\b"]):
        iso_num = 2
        rationale.append("Construction estimate matches joisted masonry")
    elif _has_any(text, [r"\bnoncombustible\b"]):
        iso_num = 3
        rationale.append("Noncombustible construction estimate")

    estimate = (vision.get("constructionTypeEstimate") or "").lower()
    if iso_num is None and estimate:
        if "frame" in estimate or "wood" in estimate:
            iso_num = 1
            rationale.append("Construction type estimate suggests frame")
        elif "joisted" in estimate or "jm" in estimate:
            iso_num = 2
            rationale.append("Construction type estimate suggests joisted masonry")
        elif "masonry non" in estimate:
            iso_num = 4
            rationale.append("Construction type estimate suggests masonry noncombustible")
        elif "noncombust" in estimate:
            iso_num = 3
            rationale.append("Construction type estimate suggests noncombustible")
        elif "fire resist" in estimate:
            iso_num = 6
            rationale.append("Construction type estimate suggests fire resistive")

    confidence = llm_conf
    if iso_num is None:
        return {
            "iso_class": None,
            "iso_label": None,
            "confidence_cap": "low",
            "rationale": rationale or ["Insufficient visual cues for ISO classification"],
            "limitations": extra_limitations,
        }

    if iso_num >= 5:
        confidence = _min_confidence(confidence, "low")
        extra_limitations.append("ISO 5–6 cannot be confirmed at high confidence from imagery alone")
    elif iso_num >= 4:
        confidence = _min_confidence(confidence, "medium")

    if extra_limitations:
        confidence = _min_confidence(confidence, "low")

    label = ISO_DEFINITIONS[iso_num]
    rationale.append(f"Mapped to {label} (ISO {iso_num}) from visible materials and structural cues")

    return {
        "iso_class": f"ISO {iso_num}",
        "iso_label": label,
        "confidence_cap": confidence,
        "rationale": rationale,
        "limitations": extra_limitations,
    }


def construction_display_value(vision: dict[str, Any], iso_result: dict[str, Any]) -> str | None:
    estimate = vision.get("constructionTypeEstimate")
    iso_label = iso_result.get("iso_label")
    if estimate and iso_label:
        return f"{iso_label} ({estimate})"
    if estimate:
        return estimate
    if iso_label:
        return iso_label
    if vision.get("facadeMaterial"):
        return str(vision["facadeMaterial"])
    return None
