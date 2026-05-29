from __future__ import annotations

import re
from typing import Any

INDIAN_CITIES = [
    "bengaluru",
    "bangalore",
    "pune",
    "mumbai",
    "delhi",
    "chennai",
    "hyderabad",
    "kochi",
    "kottayam",
]


def extract_amount(statement: str) -> dict[str, Any] | None:
    text = statement.lower()
    match = re.search(r"(?:₹|rs\.?|inr|usd|\$)?\s*(\d+(?:\.\d+)?)\s*(?:rupees|dollars|usd|inr)?", text)
    if not match:
        return None

    raw_amount = float(match.group(1))
    currency = "UNKNOWN"
    if "$" in text or "dollar" in text or "usd" in text:
        currency = "USD"
    elif "₹" in statement or "rs" in text or "rupee" in text or "inr" in text:
        currency = "INR"
    return {"amount": raw_amount, "currency": currency}


def extract_location(statement: str) -> str | None:
    lower = statement.lower()
    for city in INDIAN_CITIES:
        if city in lower:
            return "Bengaluru" if city == "bangalore" else city.title()
    return None


def analyze_statement(statement: str, customer: dict[str, Any] | None = None) -> dict[str, Any]:
    lower = statement.lower()

    signals: list[str] = []
    if any(word in lower for word in ["spent", "charged", "transaction", "purchase", "debited", "used"]):
        signals.append("possible_unauthorized_transaction")
    if any(word in lower for word in ["stole", "stolen", "theft", "robbed", "wallet stolen"]):
        signals.append("possible_card_theft")
    if any(word in lower for word in ["lost", "misplaced", "missing", "can't find", "cannot find"]):
        signals.append("possible_card_lost")
    if any(word in lower for word in ["pin", "password", "otp"]):
        signals.append("possible_secret_compromise")
    if any(word in lower for word in ["photo", "picture", "posted", "online", "instagram", "whatsapp", "social media"]):
        signals.append("possible_public_exposure")
    if "credit" in lower:
        signals.append("credit_card_mentioned")
    if "debit" in lower:
        signals.append("debit_card_mentioned")

    amount = extract_amount(statement)
    location = extract_location(statement)

    home_city = customer.get("home_city") if customer else None
    different_location = bool(location and home_city and location.lower() != home_city.lower())

    suggested_primary_tool = "none"
    if "possible_unauthorized_transaction" in signals and "credit_card_mentioned" in signals:
        suggested_primary_tool = "handle_credit_card_fraud"
    elif "possible_secret_compromise" in signals or "possible_public_exposure" in signals:
        suggested_primary_tool = "handle_compromised_pin"
    elif "possible_card_theft" in signals:
        suggested_primary_tool = "handle_any_card_theft"
    elif "possible_card_lost" in signals:
        suggested_primary_tool = "handle_any_card_lost"

    risk_level = "low"
    if any(x in signals for x in ["possible_unauthorized_transaction", "possible_card_theft", "possible_secret_compromise"]):
        risk_level = "high"
    elif "possible_card_lost" in signals:
        risk_level = "medium"

    return {
        "original_statement": statement,
        "detected_signals": signals,
        "detected_amount": amount,
        "detected_location": location,
        "home_city": home_city,
        "different_from_home_city": different_location,
        "risk_level": risk_level,
        "suggested_primary_tool": suggested_primary_tool,
    }
