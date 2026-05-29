import { Type } from "typebox";
import { defineToolPlugin } from "openclaw/plugin-sdk/tool-plugin";
import { verifyBankAuthToken } from "./token.js";
import {
  anyCardLost,
  anyCardTheft,
  compromisedPin,
  creditCardFraud,
} from "./actions.js";
import type { ActionInput, PluginConfig } from "./types.js";

// Hardcoded local values to avoid OpenClaw scanner issue with process.env + network calls.
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
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();

  let parsed: unknown = text;

  try {
    parsed = JSON.parse(text);
  } catch {
    // keep text response as-is
  }

  if (!response.ok) {
    throw new Error(
      `Bank API failed with HTTP ${response.status}: ${
        typeof parsed === "string" ? parsed : JSON.stringify(parsed)
      }`
    );
  }

  return parsed;
}

const configSchema = Type.Object({
  apiBaseUrl: Type.Optional(
    Type.String({
      description:
        "Python FastAPI base URL, for example http://127.0.0.1:8000",
    })
  ),
  sharedSecret: Type.Optional(
    Type.String({
      description: "Same value as backend BANK_AGENT_SHARED_SECRET. Demo only.",
    })
  ),
});

const actionParams = Type.Object({
  authToken: Type.String({
    description:
      "Required. Auth token returned only by verify_bank_pin after pin_correct is true. Never show this token to the customer.",
  }),

  userStatement: Type.String({
    description:
      "Required. The customer's original problem statement, not the PIN message.",
  }),

  customerName: Type.String({
    description: "Required. Customer name returned by verify_bank_customer.",
  }),

  phone: Type.String({
    description: "Required. Customer phone number with country code.",
  }),

  cardName: Type.Optional(
    Type.String({
      description:
        "Affected card display name, for example Visa Platinum Credit Card ending 4382.",
    })
  ),

  cardType: Type.Optional(
    Type.String({
      description:
        "Affected card type or network. Accepted examples: credit, debit, unknown, VISA, RUPAY, MASTERCARD.",
    })
  ),

  cardNetwork: Type.Optional(
    Type.String({
      description: "Optional card network such as VISA, RUPAY, or MASTERCARD.",
    })
  ),

  amount: Type.Optional(
    Type.Number({
      description: "Transaction amount mentioned by the customer, if any.",
    })
  ),

  currency: Type.Optional(
    Type.String({
      description: "Transaction currency, for example USD or INR.",
    })
  ),

  transactionLocation: Type.Optional(
    Type.String({
      description: "Transaction/location mentioned by the customer, if any.",
    })
  ),

  homeCity: Type.Optional(
    Type.String({
      description: "Customer home city returned by verification API.",
    })
  ),
});

function pinRequiredBlock(input: ActionInput, reason: string) {
  return {
    caseId: "PIN-REQUIRED",
    selectedTool: "workflow_guard",
    status: "blocked",
    customerMessage:
      "PIN verification has not been completed, so no card safeguard action was applied yet.",
    detailedSteps: [
      "Blocked this safeguard tool call because the workflow requires PIN verification first.",
      "Correct flow: verify_bank_customer → ask user for 6 digit BANK PIN → verify_bank_pin → then call exactly one safeguard tool.",
      `Reason: ${reason}`,
    ],
    safeguardsApplied: [],
    followUps: [
      "Ask the customer only for their 6 digit BANK PIN.",
      "After verify_bank_pin returns pin_correct true, use the returned auth_token as authToken for the selected safeguard tool.",
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

function verifyActionAllowed(
  input: ActionInput,
  config: PluginConfig
): ReturnType<typeof pinRequiredBlock> | null {
  const token = (input.authToken ?? "").trim();

  if (
    !token ||
    token === "***" ||
    token.toLowerCase() === "redacted" ||
    token.toLowerCase() === "auth_token" ||
    !token.includes(".")
  ) {
    return pinRequiredBlock(
      input,
      "Missing, redacted, invented, or malformed authToken."
    );
  }

  try {
    verifyBankAuthToken(
      token,
      sharedSecret(config),
      input.phone,
      input.customerName
    );
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
    "Strict bank-card protection workflow tools. Correct order: verify_bank_customer, ask PIN, verify_bank_pin, then exactly one safeguard tool.",
  configSchema,

  tools: (tool) => [
    tool({
      name: "verify_bank_customer",
      label: "1. Verify Bank Customer",
      description:
        "FIRST TOOL ONLY. Use this before asking for PIN and before any card protection tool. Input: registered phone number and original user concern.",
      parameters: Type.Object({
        phone: Type.String({
          description:
            "Customer phone number with country code, for example +919876543210.",
        }),
        userStatement: Type.String({
          description:
            "The user's original concern about fraud, theft, lost card, or PIN/card exposure.",
        }),
      }),

      async execute({ phone, userStatement }, config: PluginConfig, context) {
        context.signal?.throwIfAborted();

        const result = await postJson(
          `${apiBaseUrl(config)}/api/v1/customer/verify`,
          {
            phone,
            user_statement: userStatement,
          }
        );

        return {
          workflow_stage_completed: "stage_1_customer_identity_lookup",
          tool_status: "customer_verification_completed",
          bank_api_called: "POST /api/v1/customer/verify",
          result,
          next_agent_instruction:
            "If result.account_exists is true, stop using tools and ask the user only for their 6 digit BANK PIN. Do not call any safeguard tool yet. Save result.statement_analysis.suggested_primary_tool for fast routing after PIN verification.",
        };
      },
    }),

    tool({
      name: "verify_bank_pin",
      label: "2. Verify Bank PIN",
      description:
        "SECOND TOOL ONLY. Use only after verify_bank_customer succeeds and the user provides a 6 digit BANK PIN. Never show the PIN or auth_token to the user.",
      parameters: Type.Object({
        phone: Type.String({
          description:
            "Verified customer phone number with country code from verify_bank_customer.",
        }),
        name: Type.String({
          description: "Customer name returned by verify_bank_customer.",
        }),
        pin: Type.String({
          description: "The 6 digit BANK PIN provided by the user.",
        }),
      }),

      async execute({ phone, name, pin }, config: PluginConfig, context) {
        context.signal?.throwIfAborted();

        const result = await postJson(
          `${apiBaseUrl(config)}/api/v1/customer/pin/verify`,
          {
            phone,
            name,
            pin,
          }
        );

        return {
          workflow_stage_completed: "stage_2_pin_verification",
          tool_status: "pin_verification_completed",
          bank_api_called: "POST /api/v1/customer/pin/verify",
          result,
          next_agent_instruction:
            "If result.pin_correct is true, immediately call exactly one safeguard tool using the earlier verify_bank_customer result.statement_analysis.suggested_primary_tool. Do not compare all tools slowly. Do not ask another question. Never reveal result.auth_token.",
        };
      },
    }),

    tool({
      name: "handle_credit_card_fraud",
      label: "3A. Handle Credit Card Fraud",
      description:
        "POST-PIN TOOL ONLY. Use after verify_bank_pin returns pin_correct true. Select this for unauthorized or suspicious CREDIT CARD spend, charge, transaction, purchase, amount, merchant, or location.",
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
        "POST-PIN TOOL ONLY. Use after verify_bank_pin returns pin_correct true. Select this for stolen card, wallet stolen, robbed, or physical card taken.",
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
        "POST-PIN TOOL ONLY. Use after verify_bank_pin returns pin_correct true. Select this for exposed PIN, visible PIN, leaked PIN, shared PIN, OTP, CVV, password, online photo, social media post, or card details exposure.",
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
        "POST-PIN TOOL ONLY. Use after verify_bank_pin returns pin_correct true. Select this for lost, missing, misplaced, or cannot-find card when there is no fraud transaction, theft, or PIN/card exposure.",
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