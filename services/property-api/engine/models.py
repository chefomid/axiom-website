"""Core data contracts for the Trusted Value Engine."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal

Status = Literal["success", "failed", "skipped"]
TrustMethod = Literal["unanimous", "precedence", "tolerance", "llm", "unknown"]


@dataclass
class Observation:
    field_id: str
    raw_value: str
    normalized_value: Any
    source: str
    confidence: str = "medium"
    source_id: str | None = None


@dataclass
class TrustedValue:
    field_id: str
    value: str | None
    display_value: str | None
    source: str | None
    confidence: str
    method: TrustMethod
    status: Literal["observed", "unknown"] = "observed"
    alternatives: list[dict[str, Any]] = field(default_factory=list)
    conflict: bool = False


@dataclass
class SourceContext:
    address: str
    geo: dict[str, Any]
    address_std: dict[str, Any] = field(default_factory=dict)
    source_url: str | None = None
    source_urls: dict[str, str] = field(default_factory=dict)
    prior_results: dict[str, SourceRunResult] = field(default_factory=dict)
    all_observations: list[Observation] = field(default_factory=list)
    conflicts: list[dict[str, Any]] = field(default_factory=list)
    trusted_values: dict[str, TrustedValue] = field(default_factory=dict)


@dataclass
class SourceRunResult:
    source_id: str
    status: Status
    fields: list[dict[str, Any]] = field(default_factory=list)
    hazards: dict[str, Any] = field(default_factory=dict)
    observations: list[Observation] = field(default_factory=list)
    message: str | None = None
    charged: bool = True
    latency_ms: int | None = None
    cache_hit: bool = False
    trusted_values: dict[str, TrustedValue] | None = None
    conflicts_override: list[dict[str, Any]] | None = None
    analysis: dict[str, Any] | None = None

    def to_legacy_fields(self) -> list[dict[str, Any]]:
        """Backward-compatible PropertyField dicts."""
        if self.fields:
            return self.fields
        return [
            {
                "key": obs.field_id,
                "value": obs.raw_value,
                "source": obs.source,
                "confidence": obs.confidence,
            }
            for obs in self.observations
            if obs.raw_value
        ]
