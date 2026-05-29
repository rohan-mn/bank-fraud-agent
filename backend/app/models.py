from __future__ import annotations

from pydantic import BaseModel, Field, field_validator


class VerifyCustomerRequest(BaseModel):
    phone: str = Field(..., examples=["+919876543210"])
    user_statement: str = Field(..., min_length=3, examples=["someone spent 200 dollars off my credit card in Bengaluru"])

    @field_validator("phone")
    @classmethod
    def normalize_phone(cls, value: str) -> str:
        cleaned = value.strip().replace(" ", "")
        if not cleaned.startswith("+") or len(cleaned) < 8:
            raise ValueError("Phone must include country code, for example +919876543210")
        return cleaned


class VerifyPinRequest(BaseModel):
    phone: str = Field(..., examples=["+919876543210"])
    name: str = Field(..., min_length=2, examples=["Rohan Menon"])
    pin: str = Field(..., min_length=6, max_length=6, examples=["123456"])

    @field_validator("phone")
    @classmethod
    def normalize_phone(cls, value: str) -> str:
        cleaned = value.strip().replace(" ", "")
        if not cleaned.startswith("+") or len(cleaned) < 8:
            raise ValueError("Phone must include country code, for example +919876543210")
        return cleaned

    @field_validator("pin")
    @classmethod
    def pin_must_be_digits(cls, value: str) -> str:
        if not value.isdigit():
            raise ValueError("PIN must be exactly 6 digits")
        return value
