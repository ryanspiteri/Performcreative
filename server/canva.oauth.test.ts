import { describe, it, expect } from "vitest";
import { generatePKCE, getCanvaAuthUrl } from "./services/canva";
import { ENV } from "./_core/env";

describe("Canva OAuth Integration", () => {
  it("should generate valid PKCE challenge and verifier", () => {
    const { verifier, challenge } = generatePKCE();
    
    // Verifier should be 43-128 characters (base64url encoded 32 bytes = 43 chars)
    expect(verifier).toBeDefined();
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(verifier.length).toBeLessThanOrEqual(128);
    
    // Challenge should be 43 characters (base64url encoded SHA256 = 43 chars)
    expect(challenge).toBeDefined();
    expect(challenge.length).toBe(43);
    
    // Should not contain invalid base64url characters
    expect(verifier).not.toMatch(/[+/=]/);
    expect(challenge).not.toMatch(/[+/=]/);
  });

  it("should generate correct authorization URL", () => {
    const redirectUri = "https://example.com/callback";
    const state = "test-state-123";
    const codeChallenge = "test-challenge-abc";
    
    const authUrl = getCanvaAuthUrl(redirectUri, state, codeChallenge);
    
    // Should use correct authorization endpoint
    expect(authUrl).toContain("https://www.canva.com/api/oauth/authorize");
    
    // Should include all required parameters
    expect(authUrl).toContain(`client_id=${ENV.CANVA_CLIENT_ID}`);
    expect(authUrl).toContain(`redirect_uri=${encodeURIComponent(redirectUri)}`);
    expect(authUrl).toContain("response_type=code");
    expect(authUrl).toContain(`state=${state}`);
    expect(authUrl).toContain(`code_challenge=${codeChallenge}`);
    expect(authUrl).toContain("code_challenge_method=S256");
    
    // Should include required scopes
    expect(authUrl).toContain("scope=");
    expect(authUrl).toContain("asset%3Aread");
    expect(authUrl).toContain("asset%3Awrite");
    expect(authUrl).toContain("design%3Acontent%3Aread");
    expect(authUrl).toContain("design%3Acontent%3Awrite");
  });

  it("should have valid Canva credentials configured", () => {
    if (!ENV.CANVA_CLIENT_ID) return; // Skip when Canva not configured
    expect(ENV.CANVA_CLIENT_ID).toBeDefined();
    expect(ENV.CANVA_CLIENT_ID).toMatch(/^OC-/);
    
    // Client secret should be in correct format (cnvca...)
    expect(ENV.CANVA_CLIENT_SECRET).toBeDefined();
    expect(ENV.CANVA_CLIENT_SECRET).toMatch(/^cnvca/);
    expect(ENV.CANVA_CLIENT_SECRET.length).toBeGreaterThan(50);
  });
});
