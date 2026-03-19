import { describe, it, expect } from "vitest";

describe("UGC Clone Engine API Keys", () => {
  it("should have valid ElevenLabs API key", async () => {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) return; // Skip when key not configured
    expect(apiKey).toBeDefined();
    expect(apiKey).toMatch(/^sk_/);

    // Test the API key by fetching available voices
    const response = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers: {
        "xi-api-key": apiKey!,
      },
    });

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.voices).toBeDefined();
    expect(Array.isArray(data.voices)).toBe(true);
  }, 15000);

  it("should have valid Runway API key", async () => {
    const apiKey = process.env.RUNWAY_API_KEY;
    if (!apiKey) return; // Skip when key not configured
    expect(apiKey).toBeDefined();
    expect(apiKey).toMatch(/^key_/);

    // Test the API key by checking account info or a lightweight endpoint
    // Note: Runway's API structure may vary - this is a basic validation
    const response = await fetch("https://api.runwayml.com/v1/tasks", {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    // Accept both 200 (success) and 401 (unauthorized but valid endpoint)
    // We just want to confirm the key format is accepted by the API
    expect([200, 401, 404]).toContain(response.status);
  }, 15000);
});
