# Bank Card Protection OpenClaw Plugin

This plugin exposes the dashboard-visible tools:

- `verify_bank_customer`
- `verify_bank_pin`
- `handle_credit_card_fraud`
- `handle_any_card_theft`
- `handle_compromised_pin`
- `handle_any_card_lost`

It calls the Python FastAPI service for only the two banking APIs:

- `POST /api/v1/customer/verify`
- `POST /api/v1/customer/pin/verify`

The four safeguard tools are local demo tools inside the plugin. They require the HMAC auth token returned by `verify_bank_pin`.

## Build

```powershell
cd openclaw-plugin
npm install
npm run build
openclaw plugins build --entry .\dist\index.js
openclaw plugins validate --entry .\dist\index.js
```

## Install locally

```powershell
cd ..
openclaw plugins install --link .\openclaw-plugin
openclaw plugins enable bank-card-protection
openclaw gateway restart
openclaw plugins inspect bank-card-protection --runtime --json
openclaw dashboard
```

## Config

Set the plugin config to point to your Python API and shared secret.

Use OpenClaw config editing if available:

```json5
{
  plugins: {
    enabled: true,
    entries: {
      "bank-card-protection": {
        enabled: true,
        config: {
          apiBaseUrl: "http://127.0.0.1:8000",
          sharedSecret: "dev-change-me-use-a-long-random-secret"
        }
      }
    }
  }
}
```

The `sharedSecret` must match `BANK_AGENT_SHARED_SECRET` in `backend/.env`.
