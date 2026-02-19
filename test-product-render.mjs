import { generateStaticAdVariations } from "./server/services/imageCompositing.ts";

const testSelections = {
  images: [
    {
      headline: "TEST PRODUCT RENDER SIZE",
      subheadline: "Verifying 42% width rendering",
      background: {
        title: "Test Background",
        description: "Simple gradient background for testing",
        prompt: "Simple gradient background from dark blue to black, vertical mobile format, 8K"
      }
    }
  ],
  benefits: "Test Benefit Callout",
  productRenderUrl: "https://d2xsxph8kpxj0f.cloudfront.net/310519663362584601/iRMuHk7nYQvS4BtpbvEbBz/product-renders/Hyperburn/2025_NEW_HB_RENDER-GRAPE.png-askqmwgm"
};

console.log("[Test] Starting product render size test...");

try {
  const results = await generateStaticAdVariations(
    "Test brief",
    "https://via.placeholder.com/1200x1200/000000/FFFFFF?text=Reference",
    "Hyperburn",
    "ONEST",
    testSelections
  );
  
  console.log("[Test] SUCCESS! Generated images:");
  results.forEach((r, i) => {
    console.log(`  ${i + 1}. ${r.variation}: ${r.url}`);
  });
  
  process.exit(0);
} catch (err) {
  console.error("[Test] FAILED:", err.message);
  console.error(err.stack);
  process.exit(1);
}
