/**
 * Runs before all tests. Sets dummy env vars so modules that throw at import
 * (e.g. nanoBananaPro, geminiImage) can load when running the test suite
 * without a real .env.
 */
if (!process.env.GOOGLE_AI_API_KEY) {
  process.env.GOOGLE_AI_API_KEY = "test-key-for-unit-tests";
}
