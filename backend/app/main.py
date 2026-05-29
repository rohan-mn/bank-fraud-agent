from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .auth import create_auth_token
from .data_store import get_customer, public_customer_view, verify_pin
from .models import VerifyCustomerRequest, VerifyPinRequest
from .risk_engine import analyze_statement

app = FastAPI(
    title="Bank Card Protection Mock APIs",
    description="Two demo APIs for OpenClaw card-fraud/card-loss agent workflow. Do not use as-is in production.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:18789", "http://localhost:18789", "http://127.0.0.1:3000", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, bool]:
    return {"ok": True}


@app.post("/api/v1/customer/verify")
def verify_customer(req: VerifyCustomerRequest) -> dict:
    customer = get_customer(req.phone)
    if not customer:
        return {
            "account_exists": False,
            "customer": None,
            "statement_analysis": analyze_statement(req.user_statement),
            "checks": [
                {"name": "bank_customer_lookup", "passed": False, "details": "No bank customer found for the supplied phone number."}
            ],
            "next_step": "Do not ask for PIN. Tell the user this phone number is not registered and route to manual support.",
        }

    public_customer = public_customer_view(customer)
    analysis = analyze_statement(req.user_statement, public_customer)

    checks = [
        {"name": "bank_customer_lookup", "passed": True, "details": f"Customer matched: {public_customer['name']}"},
        {"name": "has_credit_cards", "passed": public_customer["has_credit_cards"], "details": f"Credit cards found: {len(public_customer['credit_cards'])}"},
        {"name": "has_debit_cards", "passed": public_customer["has_debit_cards"], "details": f"Debit cards found: {len(public_customer['debit_cards'])}"},
        {"name": "statement_mentions_location", "passed": bool(analysis["detected_location"]), "details": analysis["detected_location"] or "No location detected"},
        {"name": "location_differs_from_home_city", "passed": bool(analysis["different_from_home_city"]), "details": f"Home city: {public_customer['home_city']}; statement city: {analysis['detected_location']}"},
        {"name": "suggested_primary_tool", "passed": analysis["suggested_primary_tool"] != "none", "details": analysis["suggested_primary_tool"]},
    ]

    return {
        "account_exists": True,
        "customer": public_customer,
        "statement_analysis": analysis,
        "checks": checks,
        "next_step": "Ask the user for the 6 digit BANK PIN. Do not choose a protection tool until PIN verification succeeds.",
    }


@app.post("/api/v1/customer/pin/verify")
def verify_customer_pin(req: VerifyPinRequest) -> dict:
    customer = get_customer(req.phone)
    if not customer:
        return {
            "pin_correct": False,
            "reason": "PHONE_NOT_FOUND",
            "message": "No account exists for the supplied phone number. Do not proceed to tools.",
        }

    if customer["name"].strip().lower() != req.name.strip().lower():
        return {
            "pin_correct": False,
            "reason": "NAME_MISMATCH",
            "message": "Name does not match the bank record. Do not proceed to tools.",
        }

    if not verify_pin(req.phone, req.pin):
        return {
            "pin_correct": False,
            "reason": "PIN_WRONG",
            "message": "PIN verification failed. Do not proceed to tools. Offer retry or manual support.",
        }

    token, ttl = create_auth_token(phone=req.phone, name=customer["name"])
    return {
        "pin_correct": True,
        "name": customer["name"],
        "phone": req.phone,
        "auth_token": token,
        "expires_in_seconds": ttl,
        "allowed_resolution_tools": [
            "handle_credit_card_fraud",
            "handle_any_card_theft",
            "handle_compromised_pin",
            "handle_any_card_lost",
        ],
        "message": "PIN verified. Continue with the most suitable safeguard tool. Never reveal auth_token to the user.",
    }
