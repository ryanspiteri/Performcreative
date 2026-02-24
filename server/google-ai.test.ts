import { describe, it, expect } from "vitest";

describe("Google AI API Key Validation", () => {
  it("should have GOOGLE_AI_API_KEY configured", () => {
    expect(process.env.GOOGLE_AI_API_KEY).toBeDefined();
    expect(process.env.GOOGLE_AI_API_KEY).toMatch(/^AIza/);
  });

  it("should successfully call Google AI API with configured key", async () => {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    expect(apiKey).toBeDefined();

    // Test with a simple text generation request to validate the key
    // Using gemini-2.5-flash which is available in v1beta API
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: "Hello",
                },
              ],
            },
          ],
        }),
      }
    );

    const data = await response.json();
    
    // Log the response for debugging
    if (!response.ok) {
      console.error("Google AI API Error:", data);
    }
    
    expect(response.ok).toBe(true);
    expect(data).toHaveProperty("candidates");
  }, 30000); // 30 second timeout for API call
});
