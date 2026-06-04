"""Credit gating helpers."""

from __future__ import annotations

from fastapi import HTTPException

from billing.config import billing_enabled
from billing.db import deduct_credits, get_balance


def payment_required_detail(*, needed: int, balance: int, action: str) -> dict:
    return {
        "message": f"Insufficient credits for {action}",
        "needed_credits": needed,
        "balance_credits": balance,
        "action": action,
    }


async def require_and_spend(
    anon_id: str | None,
    credits: int,
    *,
    action: str,
    reference_id: str | None = None,
) -> None:
    if not billing_enabled() or credits <= 0:
        return
    if not anon_id or not anon_id.strip():
        raise HTTPException(
            status_code=400,
            detail="anon_id required when billing is enabled",
        )
    balance = await get_balance(anon_id)
    if balance < credits:
        raise HTTPException(
            status_code=402,
            detail=payment_required_detail(needed=credits, balance=balance, action=action),
        )
    ok, new_bal = await deduct_credits(
        anon_id.strip(),
        credits,
        reason=action,
        reference_id=reference_id,
    )
    if not ok:
        raise HTTPException(
            status_code=402,
            detail=payment_required_detail(needed=credits, balance=new_bal, action=action),
        )
