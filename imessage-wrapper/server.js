import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();

const PORT =  8787;
const OPENCLAW_GATEWAY_URL = (
  process.env.OPENCLAW_GATEWAY_URL || "http://127.0.0.1:18789"
).replace(/\/$/, "");

const OPENCLAW_GATEWAY_AUTH =
  process.env.OPENCLAW_GATEWAY_AUTH ||
  process.env.OPENCLAW_GATEWAY_TOKEN ||
  "";

const OPENCLAW_MODEL_TARGET =
  process.env.OPENCLAW_MODEL_TARGET || "openclaw/default";

const OPENCLAW_SESSION_KEY =
  process.env.OPENCLAW_SESSION_KEY || "bank-fraud-imessage-wrapper";

app.use(
  cors({
    origin: ["http://127.0.0.1:5173", "http://localhost:5173"],
  })
);

app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    wrapper: "bank-fraud-imessage-wrapper",
    openclawGatewayUrl: OPENCLAW_GATEWAY_URL,
    modelTarget: OPENCLAW_MODEL_TARGET,
    sessionKey: OPENCLAW_SESSION_KEY,
  });
});

function cleanHistory(history = []) {
  return history
    .filter(
      (m) =>
        m &&
        ["user", "assistant"].includes(m.role) &&
        typeof m.content === "string"
    )
    .slice(-12)
    .map((m) => ({
      role: m.role,
      content: m.content,
    }));
}

function normalizeMessages(reqBody) {
  if (Array.isArray(reqBody.messages)) {
    return reqBody.messages
      .filter(
        (m) =>
          m &&
          ["user", "assistant", "system"].includes(m.role) &&
          typeof m.content === "string"
      )
      .map((m) => ({
        role: m.role,
        content: m.content,
      }));
  }

  if (typeof reqBody.message === "string" && reqBody.message.trim()) {
    return [
      ...cleanHistory(reqBody.history),
      {
        role: "user",
        content: reqBody.message.trim(),
      },
    ];
  }

  if (typeof reqBody.content === "string" && reqBody.content.trim()) {
    return [
      ...cleanHistory(reqBody.history),
      {
        role: "user",
        content: reqBody.content.trim(),
      },
    ];
  }

  return null;
}

function extractAssistantText(data) {
  const choiceMessage = data?.choices?.[0]?.message?.content;
  if (typeof choiceMessage === "string" && choiceMessage.trim()) {
    return choiceMessage;
  }

  const content = data?.content;
  if (typeof content === "string" && content.trim()) {
    return content;
  }

  const message = data?.message;
  if (typeof message === "string" && message.trim()) {
    return message;
  }

  const outputText = data?.output_text;
  if (typeof outputText === "string" && outputText.trim()) {
    return outputText;
  }

  const text = data?.text;
  if (typeof text === "string" && text.trim()) {
    return text;
  }

  return "OpenClaw returned a response, but the wrapper could not extract the assistant text. Check the wrapper terminal raw logs.";
}

const SYSTEM_PROMPT = `
You are BankFraudAgent, a consumer banking protection assistant.

You must follow this exact flow:
1. First understand the user's statement or concern.
2. Extract the user's phone number.
3. Call verify_bank_customer first.
4. If customer verification succeeds, ask the user for their 6 digit BANK PIN.
5. Do not call any safeguard tool before PIN verification.
6. When the user gives the PIN, call verify_bank_pin.
7. If PIN is correct, analyze the original user statement.
8. Choose exactly one most suitable safeguard tool:
   - handle_credit_card_fraud for unauthorized credit card spending or suspicious credit card transactions.
   - handle_any_card_theft for stolen card or wallet stolen.
   - handle_compromised_pin for exposed PIN, leaked PIN, visible PIN, shared PIN, card photo exposure, CVV/OTP/PIN exposure.
   - handle_any_card_lost for lost or misplaced card.
9. After the safeguard tool completes, explain every action taken.

Do not skip identity verification.
Do not skip PIN verification.
Do not call final safeguard tools before verify_bank_pin succeeds.
Use only the enabled bank-card-protection tools.

Final response rules:
- Do not include a "Next steps" section.
- Do not ask follow-up questions after the safeguard tool has completed.
- Do not ask "Would you like to proceed..." or offer optional actions.
- Do not say "please confirm whether the card is definitely lost".
- Treat the selected safeguard action as already completed once the tool returns success.
- The final response must only include:
  1. Verification status
  2. Issue detected
  3. Tool/action applied
  4. Actions already taken
  5. Case/reference ID, if available
  6. A short safety reminder
- Keep the final response concise and definitive.
`;

app.post("/api/chat", async (req, res) => {
  const resolvedSessionKey = req.body?.sessionKey || OPENCLAW_SESSION_KEY;
  const incomingMessages = normalizeMessages(req.body || {});

  if (!incomingMessages) {
    return res.status(400).json({
      error: "Request body must contain either message string or messages array",
      received: req.body,
    });
  }

  const messages = [
    {
      role: "system",
      content: SYSTEM_PROMPT,
    },
    ...incomingMessages,
  ];

  const headers = {
    "Content-Type": "application/json",
    "x-openclaw-session-key": resolvedSessionKey,
    "x-openclaw-message-channel": "imessage-wrapper",
  };

  if (OPENCLAW_GATEWAY_AUTH) {
    headers.Authorization = `Bearer ${OPENCLAW_GATEWAY_AUTH}`;
  }

  try {
    const response = await fetch(
      `${OPENCLAW_GATEWAY_URL}/v1/chat/completions`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: OPENCLAW_MODEL_TARGET,
          user: resolvedSessionKey,
          messages,
          temperature: 0,
          top_p: 0.2,
        }),
      }
    );

    const rawText = await response.text();

    let data;
    try {
      data = JSON.parse(rawText);
    } catch {
      data = { rawText };
    }

    if (!response.ok) {
      console.error("OpenClaw error:", response.status, data);
      return res.status(response.status).json({
        error: "OpenClaw Gateway returned an error",
        status: response.status,
        details: data,
      });
    }

    const assistantText = extractAssistantText(data);

    console.log("OpenClaw assistant text:", assistantText);

    return res.json({
      role: "assistant",
      reply: assistantText,
      content: assistantText,
      message: assistantText,
      sessionKey: resolvedSessionKey,
      raw: data,
    });
  } catch (error) {
    console.error("Wrapper proxy error:", error);

    return res.status(500).json({
      error: "Could not reach OpenClaw Gateway",
      details: error.message,
    });
  }
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(`iMessage wrapper proxy running at http://127.0.0.1:${PORT}`);
  console.log(`Forwarding chat to OpenClaw Gateway: ${OPENCLAW_GATEWAY_URL}`);
  console.log(`OpenClaw session key: ${OPENCLAW_SESSION_KEY}`);
});