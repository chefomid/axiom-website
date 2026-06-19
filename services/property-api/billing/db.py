"""Wallet + ledger persistence (Postgres or local SQLite fallback)."""

from __future__ import annotations

import asyncio
import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from billing.config import database_url

_pool: Any = None
_sqlite_path: Path | None = None
_ready = False
_use_postgres = False


def is_ready() -> bool:
    return _ready


def _sqlite_default_path() -> Path:
    return Path(__file__).resolve().parent.parent / "data" / "billing.sqlite"


SCHEMA_SQLITE = """
CREATE TABLE IF NOT EXISTS wallets (
    anon_id TEXT PRIMARY KEY,
    balance_credits INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    anon_id TEXT NOT NULL,
    delta_credits INTEGER NOT NULL,
    reason TEXT NOT NULL,
    reference_id TEXT,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS stripe_events (
    event_id TEXT PRIMARY KEY,
    processed_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS checkout_resume (
    session_id TEXT PRIMARY KEY,
    anon_id TEXT NOT NULL,
    purpose TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS report_confirmations (
    confirmation_id TEXT PRIMARY KEY,
    anon_id TEXT NOT NULL,
    status TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS checkout_refunds (
    session_id TEXT PRIMARY KEY,
    anon_id TEXT NOT NULL,
    stripe_refund_id TEXT NOT NULL,
    amount_usd REAL NOT NULL,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ledger_anon ON ledger(anon_id);
"""

SCHEMA_POSTGRES = """
CREATE TABLE IF NOT EXISTS wallets (
    anon_id TEXT PRIMARY KEY,
    balance_credits INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS ledger (
    id BIGSERIAL PRIMARY KEY,
    anon_id TEXT NOT NULL,
    delta_credits INTEGER NOT NULL,
    reason TEXT NOT NULL,
    reference_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS stripe_events (
    event_id TEXT PRIMARY KEY,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS checkout_resume (
    session_id TEXT PRIMARY KEY,
    anon_id TEXT NOT NULL,
    purpose TEXT NOT NULL,
    payload_json JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS report_confirmations (
    confirmation_id TEXT PRIMARY KEY,
    anon_id TEXT NOT NULL,
    status TEXT NOT NULL,
    payload_json JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS checkout_refunds (
    session_id TEXT PRIMARY KEY,
    anon_id TEXT NOT NULL,
    stripe_refund_id TEXT NOT NULL,
    amount_usd DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ledger_anon ON ledger(anon_id);
"""


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _init_sqlite(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    try:
        conn.executescript(SCHEMA_SQLITE)
        conn.commit()
    finally:
        conn.close()


async def init_db() -> None:
    global _pool, _sqlite_path, _ready, _use_postgres

    url = database_url()
    if url and url.startswith(("postgres://", "postgresql://")):
        import asyncpg

        _pool = await asyncpg.create_pool(url, min_size=1, max_size=5)
        async with _pool.acquire() as conn:
            await conn.execute(SCHEMA_POSTGRES)
        _use_postgres = True
        _ready = True
        return

    _sqlite_path = _sqlite_default_path()
    await asyncio.to_thread(_init_sqlite, _sqlite_path)
    _use_postgres = False
    _ready = True


async def close_db() -> None:
    global _pool, _ready
    if _pool is not None:
        await _pool.close()
        _pool = None
    _ready = False


def _sqlite_connect() -> sqlite3.Connection:
    assert _sqlite_path is not None
    conn = sqlite3.connect(_sqlite_path)
    conn.row_factory = sqlite3.Row
    return conn


async def get_balance(anon_id: str) -> int:
    if not _ready or not anon_id.strip():
        return 0
    aid = anon_id.strip()
    if _use_postgres:
        async with _pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT balance_credits FROM wallets WHERE anon_id = $1", aid
            )
            return int(row["balance_credits"]) if row else 0
    return await asyncio.to_thread(_sqlite_get_balance, aid)


def _sqlite_get_balance(anon_id: str) -> int:
    conn = _sqlite_connect()
    try:
        row = conn.execute(
            "SELECT balance_credits FROM wallets WHERE anon_id = ?", (anon_id,)
        ).fetchone()
        return int(row["balance_credits"]) if row else 0
    finally:
        conn.close()


async def ledger_reference_exists(reference_id: str) -> bool:
    if not _ready or not reference_id.strip():
        return False
    ref = reference_id.strip()
    if _use_postgres:
        async with _pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT 1 FROM ledger WHERE reference_id = $1 LIMIT 1",
                ref,
            )
            return row is not None
    return await asyncio.to_thread(_sqlite_ledger_reference_exists, ref)


def _sqlite_ledger_reference_exists(reference_id: str) -> bool:
    conn = _sqlite_connect()
    try:
        row = conn.execute(
            "SELECT 1 FROM ledger WHERE reference_id = ? LIMIT 1",
            (reference_id,),
        ).fetchone()
        return row is not None
    finally:
        conn.close()


async def add_credits(
    anon_id: str,
    credits: int,
    *,
    reason: str,
    reference_id: str | None = None,
) -> int:
    if credits <= 0:
        return await get_balance(anon_id)
    aid = anon_id.strip()
    if reference_id and await ledger_reference_exists(reference_id):
        return await get_balance(aid)
    if _use_postgres:
        async with _pool.acquire() as conn:
            async with conn.transaction():
                row = await conn.fetchrow(
                    """
                    INSERT INTO wallets (anon_id, balance_credits, updated_at)
                    VALUES ($1, $2, NOW())
                    ON CONFLICT (anon_id) DO UPDATE
                    SET balance_credits = wallets.balance_credits + EXCLUDED.balance_credits,
                        updated_at = NOW()
                    RETURNING balance_credits
                    """,
                    aid,
                    credits,
                )
                await conn.execute(
                    """
                    INSERT INTO ledger (anon_id, delta_credits, reason, reference_id, created_at)
                    VALUES ($1, $2, $3, $4, NOW())
                    """,
                    aid,
                    credits,
                    reason,
                    reference_id,
                )
                return int(row["balance_credits"])
    return await asyncio.to_thread(_sqlite_add_credits, aid, credits, reason, reference_id)


def _sqlite_add_credits(anon_id: str, credits: int, reason: str, reference_id: str | None) -> int:
    conn = _sqlite_connect()
    try:
        now = _now_iso()
        conn.execute(
            """
            INSERT INTO wallets (anon_id, balance_credits, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(anon_id) DO UPDATE SET
                balance_credits = balance_credits + excluded.balance_credits,
                updated_at = excluded.updated_at
            """,
            (anon_id, credits, now),
        )
        conn.execute(
            """
            INSERT INTO ledger (anon_id, delta_credits, reason, reference_id, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (anon_id, credits, reason, reference_id, now),
        )
        row = conn.execute(
            "SELECT balance_credits FROM wallets WHERE anon_id = ?", (anon_id,)
        ).fetchone()
        conn.commit()
        return int(row["balance_credits"])
    finally:
        conn.close()


async def deduct_credits(
    anon_id: str,
    credits: int,
    *,
    reason: str,
    reference_id: str | None = None,
) -> tuple[bool, int]:
    """Returns (success, balance_after)."""
    if credits <= 0:
        bal = await get_balance(anon_id)
        return True, bal
    aid = anon_id.strip()
    if _use_postgres:
        async with _pool.acquire() as conn:
            async with conn.transaction():
                row = await conn.fetchrow(
                    "SELECT balance_credits FROM wallets WHERE anon_id = $1 FOR UPDATE",
                    aid,
                )
                current = int(row["balance_credits"]) if row else 0
                if current < credits:
                    return False, current
                new_bal = current - credits
                if row:
                    await conn.execute(
                        "UPDATE wallets SET balance_credits = $1, updated_at = NOW() WHERE anon_id = $2",
                        new_bal,
                        aid,
                    )
                else:
                    return False, 0
                await conn.execute(
                    """
                    INSERT INTO ledger (anon_id, delta_credits, reason, reference_id, created_at)
                    VALUES ($1, $2, $3, $4, NOW())
                    """,
                    aid,
                    -credits,
                    reason,
                    reference_id,
                )
                return True, new_bal
    return await asyncio.to_thread(_sqlite_deduct_credits, aid, credits, reason, reference_id)


def _sqlite_deduct_credits(
    anon_id: str, credits: int, reason: str, reference_id: str | None
) -> tuple[bool, int]:
    conn = _sqlite_connect()
    try:
        now = _now_iso()
        row = conn.execute(
            "SELECT balance_credits FROM wallets WHERE anon_id = ?", (anon_id,)
        ).fetchone()
        current = int(row["balance_credits"]) if row else 0
        if current < credits:
            return False, current
        new_bal = current - credits
        conn.execute(
            "UPDATE wallets SET balance_credits = ?, updated_at = ? WHERE anon_id = ?",
            (new_bal, now, anon_id),
        )
        conn.execute(
            """
            INSERT INTO ledger (anon_id, delta_credits, reason, reference_id, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (anon_id, -credits, reason, reference_id, now),
        )
        conn.commit()
        return True, new_bal
    finally:
        conn.close()


async def claim_stripe_event(event_id: str) -> bool:
    """Return True if this event is new and should be processed."""
    if not _ready:
        return False
    if _use_postgres:
        async with _pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO stripe_events (event_id, processed_at)
                VALUES ($1, NOW())
                ON CONFLICT (event_id) DO NOTHING
                RETURNING event_id
                """,
                event_id,
            )
            return row is not None
    return await asyncio.to_thread(_sqlite_claim_stripe_event, event_id)


def _sqlite_claim_stripe_event(event_id: str) -> bool:
    conn = _sqlite_connect()
    try:
        cur = conn.execute(
            "INSERT OR IGNORE INTO stripe_events (event_id, processed_at) VALUES (?, ?)",
            (event_id, _now_iso()),
        )
        conn.commit()
        return cur.rowcount > 0
    finally:
        conn.close()


async def save_checkout_resume(
    session_id: str,
    anon_id: str,
    purpose: str,
    payload: dict[str, Any],
) -> None:
    if not _ready:
        return
    sid = session_id.strip()
    aid = anon_id.strip()
    if not sid or not aid or not purpose:
        return
    payload_json = json.dumps(payload)
    if _use_postgres:
        async with _pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO checkout_resume (session_id, anon_id, purpose, payload_json, created_at)
                VALUES ($1, $2, $3, $4::jsonb, NOW())
                ON CONFLICT (session_id) DO UPDATE
                SET anon_id = EXCLUDED.anon_id,
                    purpose = EXCLUDED.purpose,
                    payload_json = EXCLUDED.payload_json,
                    created_at = NOW()
                """,
                sid,
                aid,
                purpose,
                payload_json,
            )
        return
    await asyncio.to_thread(_sqlite_save_checkout_resume, sid, aid, purpose, payload_json)


def _sqlite_save_checkout_resume(
    session_id: str, anon_id: str, purpose: str, payload_json: str
) -> None:
    conn = _sqlite_connect()
    try:
        conn.execute(
            """
            INSERT INTO checkout_resume (session_id, anon_id, purpose, payload_json, created_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(session_id) DO UPDATE SET
                anon_id = excluded.anon_id,
                purpose = excluded.purpose,
                payload_json = excluded.payload_json,
                created_at = excluded.created_at
            """,
            (session_id, anon_id, purpose, payload_json, _now_iso()),
        )
        conn.commit()
    finally:
        conn.close()


async def get_checkout_resume(session_id: str, anon_id: str) -> dict[str, Any] | None:
    if not _ready:
        return None
    sid = session_id.strip()
    aid = anon_id.strip()
    if not sid or not aid:
        return None
    if _use_postgres:
        async with _pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT anon_id, purpose, payload_json
                FROM checkout_resume
                WHERE session_id = $1
                """,
                sid,
            )
            if not row or row["anon_id"] != aid:
                return None
            payload = row["payload_json"]
            if isinstance(payload, str):
                payload = json.loads(payload)
            return {"purpose": row["purpose"], "payload": dict(payload or {})}
    return await asyncio.to_thread(_sqlite_get_checkout_resume, sid, aid)


def _sqlite_get_checkout_resume(session_id: str, anon_id: str) -> dict[str, Any] | None:
    conn = _sqlite_connect()
    try:
        row = conn.execute(
            """
            SELECT anon_id, purpose, payload_json
            FROM checkout_resume
            WHERE session_id = ?
            """,
            (session_id,),
        ).fetchone()
        if not row or row["anon_id"] != anon_id:
            return None
        payload = json.loads(row["payload_json"] or "{}")
        return {"purpose": row["purpose"], "payload": payload}
    finally:
        conn.close()


async def save_report_confirmation_pending(
    confirmation_id: str,
    anon_id: str,
    payload: dict[str, Any],
) -> None:
    if not _ready:
        return
    cid = confirmation_id.strip()
    aid = anon_id.strip()
    if not cid or not aid:
        return
    payload_json = json.dumps({**payload, "status": "pending"})
    if _use_postgres:
        async with _pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO report_confirmations
                    (confirmation_id, anon_id, status, payload_json, created_at, updated_at)
                VALUES ($1, $2, 'pending', $3::jsonb, NOW(), NOW())
                ON CONFLICT (confirmation_id) DO UPDATE
                SET anon_id = EXCLUDED.anon_id,
                    status = 'pending',
                    payload_json = EXCLUDED.payload_json,
                    updated_at = NOW()
                """,
                cid,
                aid,
                payload_json,
            )
        return
    await asyncio.to_thread(_sqlite_save_report_confirmation, cid, aid, "pending", payload_json)


async def update_report_confirmation(
    confirmation_id: str,
    *,
    status: str,
    payload: dict[str, Any],
) -> None:
    if not _ready:
        return
    cid = confirmation_id.strip()
    if not cid:
        return
    payload_json = json.dumps(payload)
    if _use_postgres:
        async with _pool.acquire() as conn:
            await conn.execute(
                """
                UPDATE report_confirmations
                SET status = $2, payload_json = $3::jsonb, updated_at = NOW()
                WHERE confirmation_id = $1
                """,
                cid,
                status,
                payload_json,
            )
        return
    await asyncio.to_thread(_sqlite_update_report_confirmation, cid, status, payload_json)


async def get_report_confirmation(confirmation_id: str) -> dict[str, Any] | None:
    if not _ready:
        return None
    cid = confirmation_id.strip().upper()
    if not cid:
        return None
    if _use_postgres:
        async with _pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT confirmation_id, anon_id, status, payload_json
                FROM report_confirmations
                WHERE confirmation_id = $1
                """,
                cid,
            )
            if not row:
                return None
            payload = row["payload_json"]
            if isinstance(payload, str):
                payload = json.loads(payload)
            return {
                "confirmation_id": row["confirmation_id"],
                "anon_id": row["anon_id"],
                "status": row["status"],
                "payload": dict(payload or {}),
            }
    return await asyncio.to_thread(_sqlite_get_report_confirmation, cid)


def _sqlite_save_report_confirmation(
    confirmation_id: str, anon_id: str, status: str, payload_json: str
) -> None:
    conn = _sqlite_connect()
    try:
        now = _now_iso()
        conn.execute(
            """
            INSERT INTO report_confirmations
                (confirmation_id, anon_id, status, payload_json, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(confirmation_id) DO UPDATE SET
                anon_id = excluded.anon_id,
                status = excluded.status,
                payload_json = excluded.payload_json,
                updated_at = excluded.updated_at
            """,
            (confirmation_id, anon_id, status, payload_json, now, now),
        )
        conn.commit()
    finally:
        conn.close()


def _sqlite_update_report_confirmation(confirmation_id: str, status: str, payload_json: str) -> None:
    conn = _sqlite_connect()
    try:
        conn.execute(
            """
            UPDATE report_confirmations
            SET status = ?, payload_json = ?, updated_at = ?
            WHERE confirmation_id = ?
            """,
            (status, payload_json, _now_iso(), confirmation_id),
        )
        conn.commit()
    finally:
        conn.close()


def _sqlite_get_report_confirmation(confirmation_id: str) -> dict[str, Any] | None:
    conn = _sqlite_connect()
    try:
        row = conn.execute(
            """
            SELECT confirmation_id, anon_id, status, payload_json
            FROM report_confirmations
            WHERE confirmation_id = ?
            """,
            (confirmation_id,),
        ).fetchone()
        if not row:
            return None
        payload = json.loads(row["payload_json"] or "{}")
        return {
            "confirmation_id": row["confirmation_id"],
            "anon_id": row["anon_id"],
            "status": row["status"],
            "payload": payload,
        }
    finally:
        conn.close()


async def get_ledger_credit_add(reference_id: str) -> dict[str, Any] | None:
    """Return the positive credit ledger row for a checkout session, if any."""
    if not _ready or not reference_id.strip():
        return None
    ref = reference_id.strip()
    if _use_postgres:
        async with _pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT anon_id, delta_credits, reason, reference_id
                FROM ledger
                WHERE reference_id = $1 AND delta_credits > 0
                ORDER BY id DESC
                LIMIT 1
                """,
                ref,
            )
            if not row:
                return None
            return {
                "anon_id": row["anon_id"],
                "credits": int(row["delta_credits"]),
                "reason": row["reason"],
                "reference_id": row["reference_id"],
            }
    return await asyncio.to_thread(_sqlite_get_ledger_credit_add, ref)


def _sqlite_get_ledger_credit_add(reference_id: str) -> dict[str, Any] | None:
    conn = _sqlite_connect()
    try:
        row = conn.execute(
            """
            SELECT anon_id, delta_credits, reason, reference_id
            FROM ledger
            WHERE reference_id = ? AND delta_credits > 0
            ORDER BY id DESC
            LIMIT 1
            """,
            (reference_id,),
        ).fetchone()
        if not row:
            return None
        return {
            "anon_id": row["anon_id"],
            "credits": int(row["delta_credits"]),
            "reason": row["reason"],
            "reference_id": row["reference_id"],
        }
    finally:
        conn.close()


async def get_checkout_refund(session_id: str) -> dict[str, Any] | None:
    if not _ready or not session_id.strip():
        return None
    sid = session_id.strip()
    if _use_postgres:
        async with _pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT session_id, anon_id, stripe_refund_id, amount_usd, created_at
                FROM checkout_refunds
                WHERE session_id = $1
                """,
                sid,
            )
            if not row:
                return None
            return dict(row)
    return await asyncio.to_thread(_sqlite_get_checkout_refund, sid)


def _sqlite_get_checkout_refund(session_id: str) -> dict[str, Any] | None:
    conn = _sqlite_connect()
    try:
        row = conn.execute(
            """
            SELECT session_id, anon_id, stripe_refund_id, amount_usd, created_at
            FROM checkout_refunds
            WHERE session_id = ?
            """,
            (session_id,),
        ).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


async def save_checkout_refund(
    session_id: str,
    anon_id: str,
    stripe_refund_id: str,
    amount_usd: float,
) -> None:
    if not _ready:
        return
    sid = session_id.strip()
    aid = anon_id.strip()
    rid = stripe_refund_id.strip()
    if not sid or not aid or not rid:
        return
    if _use_postgres:
        async with _pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO checkout_refunds (session_id, anon_id, stripe_refund_id, amount_usd, created_at)
                VALUES ($1, $2, $3, $4, NOW())
                ON CONFLICT (session_id) DO NOTHING
                """,
                sid,
                aid,
                rid,
                amount_usd,
            )
        return
    await asyncio.to_thread(_sqlite_save_checkout_refund, sid, aid, rid, amount_usd)


def _sqlite_save_checkout_refund(
    session_id: str, anon_id: str, stripe_refund_id: str, amount_usd: float
) -> None:
    conn = _sqlite_connect()
    try:
        conn.execute(
            """
            INSERT OR IGNORE INTO checkout_refunds
                (session_id, anon_id, stripe_refund_id, amount_usd, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (session_id, anon_id, stripe_refund_id, amount_usd, _now_iso()),
        )
        conn.commit()
    finally:
        conn.close()
