# Bank Fraud Agent — iMessage Wrapper

This is a small iMessage-style React wrapper for the BankFraudAgent OpenClaw prototype.

The browser UI talks to a local Node proxy at `127.0.0.1:8787`. The Node proxy then calls your OpenClaw Gateway at `127.0.0.1:18789/v1/chat/completions`.

## Why there is a Node proxy

Do not put your OpenClaw Gateway token in frontend/browser JavaScript. The proxy keeps the token server-side in `.env`.

## Prerequisites

1. Python FastAPI banking backend is running on `127.0.0.1:8000`.
2. OpenClaw Gateway is running on `127.0.0.1:18789`.
3. Bank card protection plugin is visible/enabled in OpenClaw dashboard.
4. Ollama `qwen3:8b` is available and configured in OpenClaw.
5. OpenClaw Chat Completions endpoint is enabled.

## Enable OpenClaw Chat Completions endpoint

Run:

```powershell
openclaw config set gateway.http.endpoints.chatCompletions.enabled true
openclaw gateway restart
```

Then test:

```powershell
curl http://127.0.0.1:18789/v1/models
```

If your Gateway has token/password auth, add the token in `.env`.

## Setup

From project root:

```powershell
cd C:\Projects\BankFraudAgent\imessage-wrapper
copy .env.example .env
npm install
npm run dev
```

Open:

```text
http://127.0.0.1:5173
```

## Expected flow

1. User types a problem statement in the iMessage-style UI.
2. Wrapper sends it to OpenClaw Gateway.
3. OpenClaw agent uses the bank tools from the installed plugin.
4. Agent verifies customer by phone number.
5. Agent asks for 6 digit BANK PIN.
6. Agent verifies PIN.
7. Agent chooses fraud/theft/lost/PIN-compromise tool.
8. Agent response appears in this wrapper.
9. OpenClaw dashboard should also show the corresponding agent/tool run because the request is routed through the Gateway.

## Demo prompts

```text
My phone number is +919876543210. Someone spent 200 dollars off my credit card in Bengaluru. Please help.
```

PIN:

```text
123456
```

```text
My phone number is +919876543210. Someone stole my credit card from my wallet.
```

```text
My phone number is +919876543210. I posted a picture online and my card and PIN are visible.
```

```text
My phone number is +919876543210. I lost my debit card yesterday and want to block it.
```

## Troubleshooting

### Wrapper says OpenClaw Gateway returned 404

Enable the Chat Completions endpoint:

```powershell
openclaw config set gateway.http.endpoints.chatCompletions.enabled true
openclaw gateway restart
```

### Wrapper says 401/403

Set your token in `.env`:

```env
OPENCLAW_GATEWAY_TOKEN=your-token-here
```

Then restart:

```powershell
npm run dev
```

### Tools are not being used

Check plugin runtime:

```powershell
openclaw plugins inspect bank-card-protection --runtime --json
```

Check backend:

```powershell
curl http://127.0.0.1:8000/docs
```

### Chat appears in wrapper but not in OpenClaw UI

This wrapper uses OpenClaw's OpenAI-compatible HTTP surface, which executes as a normal Gateway agent run. It should appear in Gateway/dashboard run or session views. If you specifically want the exact built-in WebChat bubble session mirrored, that requires using the Gateway WebSocket protocol instead of the HTTP compatibility surface.
