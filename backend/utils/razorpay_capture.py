"""Razorpay payment settlement checks (India QR / payment links)."""
from __future__ import annotations

from fastapi import HTTPException


def normalize_razorpay_payment_id(raw: str) -> str:
    """Receipts sometimes show ids without the pay_ prefix."""
    pid = (raw or "").strip()
    if not pid:
        return ""
    if pid.startswith("pay_"):
        return pid
    alnum = pid.replace("_", "")
    if alnum.isalnum() and len(pid) >= 8:
        return f"pay_{pid}"
    return pid


def razorpay_payment_is_captured(payment: dict) -> bool:
    if not payment:
        return False
    status = (payment.get("status") or "").lower()
    if status == "captured":
        return True
    if payment.get("captured") is True and status not in ("failed", "refunded"):
        return True
    return False


def require_captured_razorpay_payment(
    payment: dict,
    *,
    min_amount_paise: int | None = None,
    context: str = "payment",
) -> None:
    """
    Block enrollment until Razorpay reports captured (money actually settled).
    Authorized / created can show a success screen to the payer but may never debit.
    """
    status = (payment.get("status") or "unknown").lower()
    if status == "failed":
        err = (payment.get("error_description") or payment.get("error_reason") or "").strip()
        detail = "Payment failed at the bank — you are not enrolled."
        if err:
            detail += f" ({err})"
        raise HTTPException(status_code=400, detail=detail)
    if status == "refunded" or (payment.get("amount_refunded") or 0) > 0:
        raise HTTPException(status_code=400, detail="Payment was refunded — not enrolled.")

    if not razorpay_payment_is_captured(payment):
        raise HTTPException(
            status_code=409,
            detail=(
                f"Payment is not settled yet (Razorpay status={status}). "
                "If your bank account was not debited, wait and retry — "
                "enrollment is created only after capture."
            ),
        )

    amount = int(payment.get("amount") or 0)
    if min_amount_paise and amount > 0 and amount < min_amount_paise:
        raise HTTPException(
            status_code=400,
            detail="Payment amount is below the program fee.",
        )