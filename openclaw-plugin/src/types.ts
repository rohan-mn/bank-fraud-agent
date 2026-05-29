export type PluginConfig = {
  apiBaseUrl?: string;
  sharedSecret?: string;
};

export type AuthClaims = {
  sub: string;
  name: string;
  iat: number;
  exp: number;
  scope: string;
  verified: boolean;
};

export type ActionInput = {
  authToken: string;
  userStatement: string;
  customerName: string;
  phone: string;
  cardName?: string;
  cardType?: string;
  cardNetwork?: string;
  amount?: number;
  currency?: string;
  transactionLocation?: string;
  homeCity?: string;
};

export type ActionResult = {
  caseId: string;
  selectedTool: string;
  status: "completed" | "blocked";
  customerMessage: string;
  detailedSteps: string[];
  safeguardsApplied: string[];
  followUps: string[];
  audit: Record<string, unknown>;
};
