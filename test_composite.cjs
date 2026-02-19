const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

(async () => {
  try {
    // Step 1: Check if font files exist
    const boldPath = path.join('/home/ubuntu/onest-creative-pipeline', 'server', 'assets', 'fonts', 'LiberationSans-Bold.ttf');
    const regPath = path.join('/home/ubuntu/onest-creative-pipeline', 'server', 'assets', 'fonts', 'LiberationSans-Regular.ttf');
    console.log('Bold font exists:', fs.existsSync(boldPath));
    console.log('Regular font exists:', fs.existsSync(regPath));
    
    // Step 2: Create a test background
    const bg = await sharp({ create: { width: 1200, height: 1200, channels: 4, background: { r: 1, g: 4, b: 10, alpha: 1 } } }).png().toBuffer();
    console.log('Background created:', bg.length, 'bytes');
    
    // Step 3: Build the embedded font SVG (same as imageCompositing.ts)
    const boldB64 = fs.readFileSync(boldPath).toString('base64');
    const regB64 = fs.readFileSync(regPath).toString('base64');
    console.log('Bold font base64 length:', boldB64.length);
    console.log('Regular font base64 length:', regB64.length);
    
    const textSvg = `<svg width="1200" height="1200" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <style type="text/css">
          @font-face {
            font-family: 'AdFont';
            font-weight: bold;
            src: url('data:font/truetype;base64,${boldB64}') format('truetype');
          }
          @font-face {
            font-family: 'AdFont';
            font-weight: normal;
            src: url('data:font/truetype;base64,${regB64}') format('truetype');
          }
        </style>
      </defs>
      <text x="600" y="168" text-anchor="middle"
        font-family="AdFont, Liberation Sans, Arial, sans-serif"
        font-size="66" font-weight="bold" fill="white"
        letter-spacing="2">BURN FAT FAST</text>
      <text x="600" y="290" text-anchor="middle"
        font-family="AdFont, Liberation Sans, Arial, sans-serif"
        font-size="34" font-weight="normal" fill="#E0E0E0"
        letter-spacing="1">Premium Australian Formulation</text>
      <text x="600" y="984" text-anchor="middle"
        font-family="AdFont, Liberation Sans, Arial, sans-serif"
        font-size="29" font-weight="bold" fill="#FF3838"
        letter-spacing="1.5">CLINICALLY DOSED FORMULA</text>
      <rect x="390" y="1030" width="420" height="66" rx="33" fill="#FF3838"/>
      <text x="600" y="1072" text-anchor="middle"
        font-family="AdFont, Liberation Sans, Arial, sans-serif"
        font-size="26" font-weight="bold" fill="white"
        letter-spacing="3">SHOP NOW</text>
    </svg>`;
    
    console.log('SVG text overlay size:', textSvg.length, 'bytes (', Math.round(textSvg.length / 1024), 'KB)');
    
    // Step 4: Try to composite with the embedded font SVG
    console.log('Attempting composite...');
    const result = await sharp(bg)
      .composite([{ input: Buffer.from(textSvg), top: 0, left: 0 }])
      .png()
      .toBuffer();
    console.log('Composite SUCCESS:', result.length, 'bytes');
    
    // Save to verify visually
    fs.writeFileSync('/tmp/test_composite_result.png', result);
    console.log('Saved to /tmp/test_composite_result.png');
    
  } catch (err) {
    console.error('Composite FAILED:', err.message);
    console.error('Stack:', err.stack);
  }
})();
