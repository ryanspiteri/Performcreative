import { generateProductAd } from './server/services/nanoBananaPro.ts';

console.log('Testing Nano Banana Pro image generation...');
console.log('This will take 90-120 seconds due to Thinking mode...\n');

const startTime = Date.now();

try {
  const result = await generateProductAd({
    prompt: 'A premium supplement product bottle on a clean white surface with dramatic lighting. The bottle should be the hero element, prominently displayed in the center. Add bold text at the top: "PREMIUM QUALITY". Modern, professional product photography style.',
    productRenderUrl: null, // No product render for this test
    controlImageUrl: null, // No control image for this test
    aspectRatio: '4:5',
    resolution: '2K',
  });

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(1);

  console.log(`\n✅ SUCCESS! Image generated in ${duration} seconds`);
  console.log(`Image URL: ${result.url}`);
  console.log(`\nYou can view the image at: ${result.url}`);
} catch (error) {
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(1);
  
  console.error(`\n❌ FAILED after ${duration} seconds`);
  console.error(`Error: ${error.message}`);
  console.error(`\nFull error:`, error);
  process.exit(1);
}
