import crypto from "node:crypto";
function base64UrlDecode(input) {
    const padLength = (4 - (input.length % 4)) % 4;
    const padded = input + "=".repeat(padLength);
    return Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}
function sign(input, sharedSecret) {
    return crypto.createHmac("sha256", sharedSecret).update(input).digest();
}
export function verifyBankAuthToken(authToken, sharedSecret, expectedPhone, expectedName) {
    const parts = authToken.split(".");
    if (parts.length !== 3) {
        throw new Error("Invalid auth token format. Verify PIN again.");
    }
    const [headerPart, payloadPart, signaturePart] = parts;
    const signingInput = `${headerPart}.${payloadPart}`;
    const expectedSignature = sign(signingInput, sharedSecret);
    const providedSignature = base64UrlDecode(signaturePart);
    if (expectedSignature.length !== providedSignature.length || !crypto.timingSafeEqual(expectedSignature, providedSignature)) {
        throw new Error("Auth token signature is invalid. Verify PIN again.");
    }
    const header = JSON.parse(base64UrlDecode(headerPart).toString("utf-8"));
    if (header.alg !== "HS256" || header.typ !== "BANK-AUTH") {
        throw new Error("Auth token header is invalid. Verify PIN again.");
    }
    const claims = JSON.parse(base64UrlDecode(payloadPart).toString("utf-8"));
    const now = Math.floor(Date.now() / 1000);
    if (!claims.verified || claims.scope !== "bank-card-safeguard") {
        throw new Error("Auth token scope is invalid. Verify PIN again.");
    }
    if (claims.exp < now) {
        throw new Error("Auth token expired. Ask the user to verify PIN again.");
    }
    if (claims.sub !== expectedPhone) {
        throw new Error("Auth token phone mismatch. Do not proceed.");
    }
    if (claims.name.trim().toLowerCase() !== expectedName.trim().toLowerCase()) {
        throw new Error("Auth token name mismatch. Do not proceed.");
    }
    return claims;
}
