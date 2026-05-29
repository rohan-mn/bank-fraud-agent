from __future__ import annotations

from typing import Any

from .auth import constant_time_equals, hash_pin


def _pin_hash(phone: str, pin: str) -> str:
    return hash_pin(phone, pin)


# Demo data. Replace this with your core-banking/KYC service integration.
# Demo PINs:
# +919876543210 -> 123456
# +919111111111 -> 654321
CUSTOMERS: dict[str, dict[str, Any]] = {
    "+919876543210": {
        "name": "Rohan Menon",
        "phone": "+919876543210",
        "account_exists": True,
        "customer_id": "CUST-1001",
        "home_city": "Pune",
        "pin_hash_plain_seed": "123456",
        "accounts": [
            {"type": "savings", "account_mask": "XXXXXX1122", "status": "ACTIVE"}
        ],
        "credit_cards": [
            {
                "card_id": "cc_visa_4382",
                "display_name": "Visa Platinum Credit Card ending 4382",
                "network": "VISA",
                "status": "ACTIVE",
                "limits": {"daily_online_limit_inr": 150000, "international_enabled": True},
                "recent_transactions": [
                    {
                        "txn_id": "TXN-90001",
                        "merchant": "BLR Electronics Hub",
                        "amount": 200,
                        "currency": "USD",
                        "city": "Bengaluru",
                        "status": "SUSPICIOUS",
                    }
                ],
            }
        ],
        "debit_cards": [
            {
                "card_id": "dc_rupay_9910",
                "display_name": "RuPay Debit Card ending 9910",
                "network": "RUPAY",
                "status": "ACTIVE",
                "limits": {"daily_atm_limit_inr": 25000, "online_enabled": True},
                "recent_transactions": [],
            }
        ],
    },
    "+919111111111": {
        "name": "Ananya Sharma",
        "phone": "+919111111111",
        "account_exists": True,
        "customer_id": "CUST-1002",
        "home_city": "Bengaluru",
        "pin_hash_plain_seed": "654321",
        "accounts": [
            {"type": "salary", "account_mask": "XXXXXX7788", "status": "ACTIVE"}
        ],
        "credit_cards": [],
        "debit_cards": [
            {
                "card_id": "dc_visa_1200",
                "display_name": "Visa Debit Card ending 1200",
                "network": "VISA",
                "status": "ACTIVE",
                "limits": {"daily_atm_limit_inr": 40000, "online_enabled": True},
                "recent_transactions": [],
            }
        ],
    },
}


def get_customer(phone: str) -> dict[str, Any] | None:
    customer = CUSTOMERS.get(phone)
    if not customer:
        return None
    copied = {k: v for k, v in customer.items() if k != "pin_hash_plain_seed"}
    return copied


def verify_pin(phone: str, provided_pin: str) -> bool:
    customer = CUSTOMERS.get(phone)
    if not customer:
        return False
    expected_hash = _pin_hash(phone, customer["pin_hash_plain_seed"])
    provided_hash = _pin_hash(phone, provided_pin)
    return constant_time_equals(expected_hash, provided_hash)


def public_customer_view(customer: dict[str, Any]) -> dict[str, Any]:
    return {
        "name": customer["name"],
        "phone": customer["phone"],
        "customer_id": customer["customer_id"],
        "home_city": customer["home_city"],
        "account_exists": customer["account_exists"],
        "has_credit_cards": len(customer.get("credit_cards", [])) > 0,
        "has_debit_cards": len(customer.get("debit_cards", [])) > 0,
        "credit_cards": customer.get("credit_cards", []),
        "debit_cards": customer.get("debit_cards", []),
        "accounts": customer.get("accounts", []),
    }
