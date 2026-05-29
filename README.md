# Bank Card Protection Agent Demo: Python + OpenClaw + Ollama Qwen3:8b

This is a Windows 11 friendly prototype for a bank hackathon/demo.

It provides:

1. A Python FastAPI backend with exactly two banking APIs:
   - `POST /api/v1/customer/verify`
   - `POST /api/v1/customer/pin/verify`
2. An OpenClaw tool plugin that displays tools in the OpenClaw dashboard:
   - `verify_bank_customer`
   - `verify_bank_pin`
   - `handle_credit_card_fraud`
   - `handle_any_card_theft`
   - `handle_compromised_pin`
   - `handle_any_card_lost`
3. A recommended OpenClaw agent instruction file.
4. Local Ollama model setup using `qwen3:8b`.

> Demo safety note: In real banking systems, never collect a full PIN inside a chatbot. Use the bank's secure authentication/step-up flow. This prototype uses a mock 6-digit PIN only because the requested demo flow explicitly needs it.

---

## 1. Folder structure

```text
bank-card-protection-openclaw/
  README.md
  backend/
    requirements.txt
    .env.example
    run.ps1
    app/
      __init__.py
      main.py
      models.py
      data_store.py
      auth.py
      risk_engine.py
  openclaw-plugin/
    package.json
    tsconfig.json
    openclaw.plugin.json
    README.md
    src/
      index.ts
      token.ts
      actions.ts
      types.ts
  openclaw/
    agent_instructions.md
  scripts/
    setup_windows.ps1
```

---

## 2. Prerequisites on Windows 11

Use PowerShell or CMD. No WSL is required.

Install:

- Python 3.11+
- Node.js 22.19+ or Node.js 24+
- Ollama for Windows
- OpenClaw CLI

Check versions:

```powershell
py -3 --version
node --version
npm --version
ollama --version
openclaw --version
```

---

## 3. Pull the Ollama model

```powershell
ollama pull qwen3:8b
ollama list
```

If Ollama is not already running:

```powershell
ollama serve
```

Keep that terminal open, or use the Ollama desktop tray app.

---

## 4. Configure OpenClaw with Ollama Qwen3:8b

Recommended interactive path:

```powershell
openclaw onboard
```

Choose:

- Provider: Ollama
- Mode: Local only
- Base URL: `http://127.0.0.1:11434`
- Model: `qwen3:8b`

Non-interactive option:

```powershell
openclaw onboard --non-interactive --auth-choice ollama --custom-base-url "http://127.0.0.1:11434" --custom-model-id "qwen3:8b" --accept-risk
```

Verify gateway:

```powershell
openclaw gateway status
openclaw dashboard
```

Dashboard should open at:

```text
http://127.0.0.1:18789/
```

---

## 5. Start the Python backend

```powershell
cd bank-card-protection-openclaw\backend
copy .env.example .env
notepad .env
```

Keep this value for both backend and plugin:

```env
BANK_AGENT_SHARED_SECRET=dev-change-me-use-a-long-random-secret
BANK_AUTH_TOKEN_TTL_SECONDS=900
```

Run:

```powershell
.\run.ps1
```

Test API health:

```powershell
curl http://127.0.0.1:8000/health
```

Test customer verification:

```powershell
curl -X POST "http://127.0.0.1:8000/api/v1/customer/verify" ^
  -H "Content-Type: application/json" ^
  -d "{\"phone\":\"+919876543210\",\"user_statement\":\"someone spent 200 dollars off my credit card in Bengaluru\"}"
```

PowerShell alternative:

```powershell
Invoke-RestMethod -Method Post `
  -Uri "http://127.0.0.1:8000/api/v1/customer/verify" `
  -ContentType "application/json" `
  -Body '{"phone":"+919876543210","user_statement":"someone spent 200 dollars off my credit card in Bengaluru"}'
```

Test PIN:

```powershell
Invoke-RestMethod -Method Post `
  -Uri "http://127.0.0.1:8000/api/v1/customer/pin/verify" `
  -ContentType "application/json" `
  -Body '{"phone":"+919876543210","name":"Rohan Menon","pin":"123456"}'
```

Demo users:

| Phone | Name | PIN | Cards |
|---|---|---:|---|
| `+919876543210` | Rohan Menon | `123456` | Credit + debit |
| `+919111111111` | Ananya Sharma | `654321` | Debit only |

---

## 6. Build and install the OpenClaw plugin

Open a new PowerShell terminal:

```powershell
cd bank-card-protection-openclaw\openclaw-plugin
npm install
npm run build
openclaw plugins build --entry .\dist\index.js
openclaw plugins validate --entry .\dist\index.js
```

Install the local plugin:

```powershell
cd ..
openclaw plugins install --link .\openclaw-plugin
openclaw plugins enable bank-card-protection
```

Configure the plugin. The exact config editing method can vary by OpenClaw version. Use whichever your CLI supports.

Option A, config commands:

```powershell
openclaw config set plugins.entries.bank-card-protection.config.apiBaseUrl "http://127.0.0.1:8000"
openclaw config set plugins.entries.bank-card-protection.config.sharedSecret "dev-change-me-use-a-long-random-secret"
```

Option B, edit OpenClaw config manually and add:

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

Restart and inspect:

```powershell
openclaw gateway restart
openclaw plugins inspect bank-card-protection --runtime --json
openclaw dashboard
```

You should see these plugin-owned tools in runtime inspection/dashboard tool surfaces:

- `verify_bank_customer`
- `verify_bank_pin`
- `handle_credit_card_fraud`
- `handle_any_card_theft`
- `handle_compromised_pin`
- `handle_any_card_lost`

---

## 7. Add the agent instructions

Open `openclaw/agent_instructions.md` and paste it into your OpenClaw agent/system instructions area or equivalent agent config.

The important flow is:

```text
User statement -> ask phone if missing -> verify_bank_customer -> ask 6 digit PIN -> verify_bank_pin -> choose one safeguard tool -> explain each step -> final case summary
```

---

## 8. Demo prompts

### Credit-card fraud

```text
My phone number is +919876543210. Someone spent 200 dollars off my credit card in Bengaluru. Please help.
```

Expected path:

```text
verify_bank_customer -> ask PIN -> verify_bank_pin -> handle_credit_card_fraud
```

Use PIN:

```text
123456
```

### PIN compromised

```text
My phone number is +919876543210. I posted a picture online and my card and PIN are visible. I am worried someone will use it.
```

Expected path:

```text
verify_bank_customer -> ask PIN -> verify_bank_pin -> handle_compromised_pin
```

### Card stolen

```text
My phone number is +919876543210. Someone stole my wallet and my credit card was inside.
```

Expected path:

```text
verify_bank_customer -> ask PIN -> verify_bank_pin -> handle_any_card_theft
```

### Card lost

```text
My phone number is +919111111111. I lost my debit card today. Please block it.
```

Expected path:

```text
verify_bank_customer -> ask PIN -> verify_bank_pin -> handle_any_card_lost
```

Use PIN:

```text
654321
```

---

## 9. What the two APIs return

### POST /api/v1/customer/verify

Request:

```json
{
  "phone": "+919876543210",
  "user_statement": "someone spent 200 dollars off my credit card in Bengaluru"
}
```

Response includes:

- whether the customer exists
- name, masked account/card details
- credit/debit cards owned by the customer
- user statement risk analysis
- location check against home city
- suggested primary tool
- next step instruction

### POST /api/v1/customer/pin/verify

Request:

```json
{
  "phone": "+919876543210",
  "name": "Rohan Menon",
  "pin": "123456"
}
```

Response includes:

- `pin_correct`
- `auth_token` if correct
- token expiry
- allowed safeguard tools

The safeguard tools verify the `auth_token` locally using the same HMAC shared secret, so the demo still has only two banking APIs.

---

## 10. Replacing mock data with real bank systems

Replace `backend/app/data_store.py` with calls to:

- customer profile API
- card inventory API
- transaction history API
- fraud/dispute API
- card block/reissue API
- notification API

For production, change the authentication design:

- do not ask for full PIN in chat
- use OAuth/SSO/device binding
- use step-up authentication or secure banking app approval
- keep tools allowlisted
- add human approval for irreversible actions
- store audit logs in a tamper-evident store
- mask card, account, and customer details
