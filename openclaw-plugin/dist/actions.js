function caseId(prefix) {
    const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
    const random = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `${prefix}-${stamp}-${random}`;
}
function safeCardName(cardName, cardType) {
    if (cardName && cardName.trim().length > 0)
        return cardName.trim();
    if (cardType === "credit")
        return "the selected credit card";
    if (cardType === "debit")
        return "the selected debit card";
    return "the affected card";
}
function locationLine(input) {
    if (!input.transactionLocation)
        return "No transaction location was provided by the user statement.";
    if (!input.homeCity)
        return `Transaction/location mentioned: ${input.transactionLocation}.`;
    const differs = input.transactionLocation.toLowerCase() !== input.homeCity.toLowerCase();
    return differs
        ? `Transaction/location mentioned: ${input.transactionLocation}, which differs from home city ${input.homeCity}.`
        : `Transaction/location mentioned: ${input.transactionLocation}, same as home city ${input.homeCity}.`;
}
function amountLine(input) {
    if (!input.amount)
        return "No exact amount was provided by the user statement.";
    return `Amount mentioned by user: ${input.currency ?? "UNKNOWN"} ${input.amount}.`;
}
export function creditCardFraud(input) {
    const card = safeCardName(input.cardName, "credit");
    return {
        caseId: caseId("CC-FRAUD"),
        selectedTool: "handle_credit_card_fraud",
        status: "completed",
        customerMessage: `I have treated this as possible credit-card fraud for ${card}.`,
        detailedSteps: [
            "Confirmed customer authentication token from successful PIN verification.",
            "Classified the statement as an unauthorized/suspicious credit-card transaction.",
            locationLine(input),
            amountLine(input),
            `Applied immediate temporary block to online, contactless, and international transactions for ${card}.`,
            "Raised a fraud dispute case and attached the user's original statement for analyst review.",
            "Marked the suspicious transaction for chargeback/reversal investigation.",
            "Enabled heightened monitoring on all customer cards for the next 72 hours.",
            "Prepared customer-facing next steps without revealing internal auth token or PIN details."
        ],
        safeguardsApplied: [
            "Temporary credit-card freeze",
            "Online transaction block",
            "International transaction block",
            "Suspicious transaction dispute created",
            "Fraud-monitoring flag added",
            "Customer SMS/email alert queued"
        ],
        followUps: [
            "Ask the customer to confirm whether the transaction is recognized.",
            "If unrecognized, advise not to share PIN/OTP and wait for the bank's dispute reference.",
            "Offer replacement card issuance if the physical card may be compromised."
        ],
        audit: {
            customerName: input.customerName,
            phone: input.phone,
            card,
            sourceStatement: input.userStatement,
            timestamp: new Date().toISOString()
        }
    };
}
export function anyCardTheft(input) {
    const card = safeCardName(input.cardName, input.cardType);
    return {
        caseId: caseId("CARD-THEFT"),
        selectedTool: "handle_any_card_theft",
        status: "completed",
        customerMessage: `I have treated this as possible card theft involving ${card}.`,
        detailedSteps: [
            "Confirmed customer authentication token from successful PIN verification.",
            "Classified the statement as physical card theft or wallet theft.",
            `Hard-blocked ${card} to stop ATM, POS, online, contactless, and international usage.`,
            "Added a theft marker so any attempted authorization is declined.",
            "Started replacement-card workflow with old card permanently disabled.",
            "Queued customer alert and generated a theft service case.",
            "Added 72-hour enhanced monitoring for related accounts and other cards."
        ],
        safeguardsApplied: [
            "Permanent card block",
            "Replacement card workflow started",
            "ATM/POS/online/contactless usage disabled",
            "Theft marker added",
            "Enhanced account monitoring enabled"
        ],
        followUps: [
            "Ask whether any transactions after the theft are unauthorized.",
            "If yes, run the credit-card fraud tool for the disputed transaction too.",
            "Advise the customer to file a local police report if required by bank policy."
        ],
        audit: {
            customerName: input.customerName,
            phone: input.phone,
            card,
            sourceStatement: input.userStatement,
            timestamp: new Date().toISOString()
        }
    };
}
export function compromisedPin(input) {
    const card = safeCardName(input.cardName, input.cardType);
    return {
        caseId: caseId("PIN-COMP"),
        selectedTool: "handle_compromised_pin",
        status: "completed",
        customerMessage: `I have treated this as possible PIN/card-detail compromise involving ${card}.`,
        detailedSteps: [
            "Confirmed customer authentication token from successful PIN verification.",
            "Classified the statement as exposed secret/card details, for example PIN visible in an online photo.",
            `Temporarily blocked PIN-based ATM/POS transactions for ${card}.`,
            "Disabled online/card-not-present transactions until the customer resets credentials or receives a replacement card.",
            "Triggered PIN reset advisory through secure bank channel, not through the chat.",
            "Queued replacement-card recommendation because exposed card number plus PIN is high risk.",
            "Added watchlist monitoring for abnormal attempts."
        ],
        safeguardsApplied: [
            "PIN-based transaction block",
            "Online/card-not-present transaction block",
            "Secure PIN reset advisory queued",
            "Replacement-card recommendation created",
            "High-risk monitoring enabled"
        ],
        followUps: [
            "Tell the customer to delete or hide the online image immediately.",
            "Tell the customer never to share PIN/OTP in chat, email, or phone calls.",
            "Recommend changing PIN only through official ATM/mobile banking flow."
        ],
        audit: {
            customerName: input.customerName,
            phone: input.phone,
            card,
            sourceStatement: input.userStatement,
            timestamp: new Date().toISOString()
        }
    };
}
export function anyCardLost(input) {
    const card = safeCardName(input.cardName, input.cardType);
    return {
        caseId: caseId("CARD-LOST"),
        selectedTool: "handle_any_card_lost",
        status: "completed",
        customerMessage: `I have treated this as a lost-card case involving ${card}.`,
        detailedSteps: [
            "Confirmed customer authentication token from successful PIN verification.",
            "Classified the statement as lost or misplaced card.",
            `Temporarily blocked ${card} for ATM, POS, online, contactless, and international transactions.`,
            "Opened a lost-card service case.",
            "Enabled replacement-card option if the customer cannot recover the card.",
            "Added monitoring for declined attempts after the block."
        ],
        safeguardsApplied: [
            "Temporary card block",
            "Lost-card service case created",
            "Replacement-card option prepared",
            "Attempt monitoring enabled"
        ],
        followUps: [
            "Ask whether the card is definitely lost or only temporarily misplaced.",
            "If definitely lost, convert temporary block to permanent block and issue replacement.",
            "Ask the customer to review recent transactions for anything unrecognized."
        ],
        audit: {
            customerName: input.customerName,
            phone: input.phone,
            card,
            sourceStatement: input.userStatement,
            timestamp: new Date().toISOString()
        }
    };
}
