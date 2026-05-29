import { Type } from "typebox";
import { defineToolPlugin } from "openclaw/plugin-sdk/tool-plugin";
import { verifyBankAuthToken } from "./token.js";
import { anyCardLost, anyCardTheft, compromisedPin, creditCardFraud } from "./actions.js";
import type { ActionInput, PluginConfig } from "./types.js";

// Keep this literal to avoid OpenClaw scanner warnings about process.env + network send.
const DEFAULT_API_BASE_URL = "http://127.0.0.1:8000";
const DEFAULT_SHARED_SECRET = "dev-change-me-use-a-long-random-secret";

function apiBaseUrl(config: PluginConfig): string {
  return (config.apiBaseUrl ?? DEFAULT_API_BASE_URL).replace(/\/$/, "");
}

function sharedSecret(config: PluginConfig): string {
  return config.sharedSecret ?? DEFAULT_SHARED_SECRET;
}

async function postJson(url: string, payload: unknown): Promise<unknown> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  let parsed: unknown = text;
  try {
    parsed = JSON.parse(text);
  } catch {
    // Leave non-JSON text as-is.
  }

  if (!response.ok) {
    throw new Error(`Bank API failed with HTTP ${response.status}: ${typeof parsed === "string" ? parsed : JSON.stringify(parsed)}`);
  }

  return parsed;
}

const configSchema = Type.Object({
  apiBaseUrl: Type.Optional(Type.String({ description: "Python FastAPI base URL, for example http://127.0.0.1:8000" })),
  sharedSecret: Type.Optional(Type.String({ description: "Same value as backend BANK_AGENT_SHARED_SECRET. Demo only." })),
});

const actionParams = Type.Object({
  authToken: Type.String({ description: "Required. Auth token returned only by verify_bank_pin after pin_correct is true. Never show this token to the customer." }),
  userStatement: Type.String({ description: "Required. The customer's original problem statement/concern, not the PIN message." }),
  customerName: Type.String({ description: "Required. Customer name returned by verify_bank_customer / verify_bank_pin." }),
  phone: Type.String({ description: "Required. Customer phone number with country code." }),
  cardName: Type.Optional(Type.String({ description: "Affected card display name from verification result, for example Visa Platinum Credit Card ending 4382." })),
  cardType: Type.Optional(Type.String({ description: "Affected card type. Preferred values are credit, debit, or unknown. Card network values like VISA/RUPAY/MASTERCARD are also accepted to prevent schema rejection." })),
  cardNetwork: Type.Optional(Type.String({ description: "Optional card network such as VISA, RUPAY, or MASTERCARD, if known." })),
  amount: Type.Optional(Type.Number({ description: "Transaction amount mentioned by the customer, if any." })),
  currency: Type.Optional(Type.String({ description: "Transaction currency, for example USD or INR." })),
  transactionLocation: Type.Optional(Type.String({ description: "Transaction/location mentioned by the customer, if any." })),
  homeCity: Type.Optional(Type.String({ description: "Customer home city returned by verification API." })),
});

function pinRequiredBlock(input: ActionInput, reason: string) {
  return {
    caseId: "PIN-REQUIRED",
    selectedTool: "workflow_guard",
    status: "blocked",
    customerMessage:
      "PIN verification has not been completed, so no card safeguard action was applied yet.",
    detailedSteps: [
      "Blocked this safeguard tool call because the strict workflow requires PIN verification first.",
      "Correct flow: verify_bank_customer → ask the user for the 6 digit BANK PIN → verify_bank_pin → then call exactly one safeguard tool.",
      `Reason: ${reason}`,
    ],
    safeguardsApplied: [],
    followUps: [
      "Ask the customer only for their 6 digit BANK PIN.",
      "After verify_bank_pin returns pin_correct true, use the returned auth_token as authToken for the chosen safeguard tool.",
      "Never invent authToken values such as *** or REDACTED.",
    ],
    audit: {
      customerName: input.customerName,
      phone: input.phone,
      sourceStatement: input.userStatement,
      timestamp: new Date().toISOString(),
    },
  } as const;
}

function verifyActionAllowed(input: ActionInput, config: PluginConfig): ReturnType<typeof pinRequiredBlock> | null {
  const token = (input.authToken ?? "").trim();

  if (!token || token === "***" || token.toLowerCase() === "redacted" || token.toLowerCase() === "auth_token" || !token.includes(".")) {
    return pinRequiredBlock(input, "Missing, redacted, invented, or malformed authToken.");
  }

  try {
    verifyBankAuthToken(token, sharedSecret(config), input.phone, input.customerName);
    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return pinRequiredBlock(input, message);
  }
}

export default defineToolPlugin({
  id: "bank-card-protection",
  name: "Bank Card Protection",
  description:
    "Strict bank-card protection workflow tools. The correct order is verify_bank_customer, ask PIN, verify_bank_pin, then exactly one safeguard tool.",
  configSchema,
  tools: (tool) => [
    tool({
      name: "verify_bank_customer",
      label: "1. Verify Bank Customer",
      description:
        "FIRST TOOL ONLY. Use this before asking for PIN and before any card protection tool. Input is the registered phone number and the user's original statement/concern. If phone is missing, ask the user for phone instead of using any tool.",
      parameters: Type.Object({
        phone: Type.String({ description: "Customer phone number with country code, for example +919876543210." }),
        userStatement: Type.String({ description: "The user's original statement/concern about fraud, theft, lost card, or PIN/card exposure." }),
      }),
      async execute({ phone, userStatement }, config: PluginConfig, context) {
        context.signal?.throwIfAborted();
        const result = await postJson(`${apiBaseUrl(config)}/api/v1/customer/verify`, {
          phone,
          user_statement: userStatement,
        });
        return {
          workflow_stage_completed: "stage_1_customer_identity_lookup",
          tool_status: "customer_verification_completed",
          bank_api_called: "POST /api/v1/customer/verify",
          result,
          next_agent_instruction:
            "If result.account_exists is true, stop using tools and ask the user only for their 6 digit BANK PIN. Do not analyze or call safeguard tools yet. If false, do not ask PIN and route to manual support.",
        };
      },
    }),

    tool({
      name: "verify_bank_pin",
      label: "2. Verify Bank PIN",
      description:
        "SECOND TOOL ONLY. Use only after verify_bank_customer returned account_exists true and the user has provided a 6 digit BANK PIN. Never use this before customer verification. Never show the PIN or auth token to the user.",
      parameters: Type.Object({
        phone: Type.String({ description: "Verified customer phone number with country code from verify_bank_customer." }),
        name: Type.String({ description: "Customer name returned by verify_bank_customer." }),
        pin: Type.String({ description: "The 6 digit BANK PIN provided by the user." }),
      }),
      async execute({ phone, name, pin }, config: PluginConfig, context) {
        context.signal?.throwIfAborted();
        const result = await postJson(`${apiBaseUrl(config)}/api/v1/customer/pin/verify`, {
          phone,
          name,
          pin,
        });
        return {
          workflow_stage_completed: "stage_2_pin_verification",
          tool_status: "pin_verification_completed",
          bank_api_called: "POST /api/v1/customer/pin/verify",
          result,
          next_agent_instruction:
            "If result.pin_correct is true, analyze the original user statement and choose exactly one safeguard tool from result.allowed_resolution_tools. Priority: compromised PIN/card details exposure > credit card fraud transaction > physical card theft > lost card. Never reveal result.auth_token.",
        };
      },
    }),

    tool({
      name: "handle_credit_card_fraud",
      label: "3A. Handle Credit Card Fraud",
      description:
        "POST-PIN TOOL ONLY. Use only after verify_bank_pin returned pin_correct true and authToken is available. Select this when the original statement describes unauthorized/suspicious CREDIT CARD spend, charge, transaction, purchase, amount, merchant, or location. Do not use for stolen/lost card unless an unauthorized credit-card transaction is the main issue.",
      parameters: actionParams,
      async execute(input: ActionInput, config: PluginConfig, context) {
        context.signal?.throwIfAborted();
        const blocked = verifyActionAllowed(input, config);
        if (blocked) return blocked;
        return creditCardFraud(input);
      },
    }),

    tool({
      name: "handle_any_card_theft",
      label: "3B. Handle Any Card Theft",
      description:
        "POST-PIN TOOL ONLY. Use only after verify_bank_pin returned pin_correct true and authToken is available. Select this when the original statement describes physical card theft, wallet stolen, robbed, card taken, or someone stole the card. Do not use for lost/misplaced cards unless theft is stated.",
      parameters: actionParams,
      async execute(input: ActionInput, config: PluginConfig, context) {
        context.signal?.throwIfAborted();
        const blocked = verifyActionAllowed(input, config);
        if (blocked) return blocked;
        return anyCardTheft(input);
      },
    }),

    tool({
      name: "handle_compromised_pin",
      label: "3C. Handle Compromised PIN/Card Details",
      description:
        "POST-PIN TOOL ONLY. Use only after verify_bank_pin returned pin_correct true and authToken is available. Select this for PIN, OTP, CVV, password, or card details exposure; online photo/picture/social media post; visible PIN; or card/PIN seen by others. This has higher priority than fraud/theft/lost if secret exposure is mentioned.",
      parameters: actionParams,
      async execute(input: ActionInput, config: PluginConfig, context) {
        context.signal?.throwIfAborted();
        const blocked = verifyActionAllowed(input, config);
        if (blocked) return blocked;
        return compromisedPin(input);
      },
    }),

    tool({
      name: "handle_any_card_lost",
      label: "3D. Handle Any Card Lost",
      description:
        "POST-PIN TOOL ONLY. Use only after verify_bank_pin returned pin_correct true and authToken is available. Select this when the original statement says the credit/debit card is lost, missing, misplaced, or cannot be found, and there is no clear theft, fraud transaction, or PIN/card details exposure.",
      parameters: actionParams,
      async execute(input: ActionInput, config: PluginConfig, context) {
        context.signal?.throwIfAborted();
        const blocked = verifyActionAllowed(input, config);
        if (blocked) return blocked;
        return anyCardLost(input);
      },
    }),
  ],
});
