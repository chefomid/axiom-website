"""Build staged execution plans from source dependencies."""

from __future__ import annotations

from dataclasses import dataclass, field

from registry_loader import get_source_by_id

POST_PROCESS = frozenset({"cope_map", "llm_conflict_resolve", "pdf_dossier", "llm_extract"})
SKIP_FETCH = frozenset({"geocode_census"}) | POST_PROCESS


@dataclass
class ExecutionStage:
    stage_id: int
    source_ids: list[str] = field(default_factory=list)


@dataclass
class ExecutionPlan:
    stages: list[ExecutionStage] = field(default_factory=list)
    post_process: list[str] = field(default_factory=list)


def build_execution_plan(selected_sources: list[str]) -> ExecutionPlan:
    """Topological staging: geocode first, then parallel-ready batches, then post-process."""
    fetch_sources = [s for s in selected_sources if s not in SKIP_FETCH]
    post_process = [s for s in selected_sources if s in POST_PROCESS]

    if not fetch_sources:
        return ExecutionPlan(stages=[], post_process=post_process)

    by_id = {s: get_source_by_id(s) for s in fetch_sources}
    remaining = set(fetch_sources)
    completed: set[str] = {"geocode_census"}
    stages: list[ExecutionStage] = []
    stage_id = 0

    while remaining:
        ready = []
        for sid in sorted(remaining):
            src = by_id.get(sid) or {}
            deps = set(src.get("depends_on") or [])
            if deps.issubset(completed):
                ready.append(sid)
        if not ready:
            ready = sorted(remaining)

        stages.append(ExecutionStage(stage_id=stage_id, source_ids=ready))
        completed.update(ready)
        remaining -= set(ready)
        stage_id += 1

    return ExecutionPlan(stages=stages, post_process=post_process)
