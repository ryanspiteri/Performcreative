import { writePsd } from "ag-psd";
import sharp from "sharp";

/**
 * PSD Builder Service
 * Generates Photoshop files from ad variation data
 * 
 * Note: ag-psd requires canvas for multi-layer PSDs which breaks deployment.
 * This simplified version creates a single-layer PSD with the composited image,
 * which still opens in Photoshop and is better than PNG for some workflows.
 */

interface PSDLayerData {
  headline: string;
  subheadline?: string;
  benefit1: string;
  benefit2: string;
  benefit3: string;
  cta: string;
  productImageUrl: string;
  backgroundImageUrl: string;
  width: number;
  height: number;
}

/**
 * Download image from URL and return as Buffer
 */
async function downloadImage(url: string): Promise<Buffer> {
  const response = await globalThis.fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Generate simplified PSD file with single composited layer
 * This avoids canvas dependency while still providing a valid PSD file
 */
export async function generatePSD(data: PSDLayerData): Promise<Buffer> {
  try {
    // Download background and product images
    const [backgroundBuffer, productBuffer] = await Promise.all([
      downloadImage(data.backgroundImageUrl),
      downloadImage(data.productImageUrl),
    ]);

    // Get image dimensions
    const productMeta = await sharp(productBuffer).metadata();

    // Calculate product dimensions (40% of canvas width)
    const productWidth = Math.floor(data.width * 0.4);
    const productHeight = Math.floor(((productMeta.height || 1) / (productMeta.width || 1)) * productWidth);

    // Resize product image
    const resizedProductBuffer = await sharp(productBuffer)
      .resize(productWidth, productHeight, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();

    // Position product on right side, centered vertically
    const productX = data.width - productWidth - Math.floor(data.width * 0.05);
    const productY = Math.floor((data.height - productHeight) / 2);

    // Composite background + product into single image
    const compositedBuffer = await sharp(backgroundBuffer)
      .resize(data.width, data.height, { fit: "cover" })
      .composite([
        {
          input: resizedProductBuffer,
          left: productX,
          top: productY,
        },
      ])
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Convert raw buffer to RGBA Uint8Array
    const pixelData = new Uint8Array(compositedBuffer.data);

    // Create PSD structure (single layer with composited image)
    const psd: any = {
      width: data.width,
      height: data.height,
      channels: 4, // RGBA
      bitsPerChannel: 8,
      colorMode: 3, // RGB
      children: [
        {
          name: "Composited Ad",
          canvas: {
            width: data.width,
            height: data.height,
            getContext: () => ({
              getImageData: () => ({
                data: pixelData,
                width: data.width,
                height: data.height,
              }),
            }),
          },
        },
      ],
    };

    // Write PSD to buffer
    const psdBuffer = Buffer.from(writePsd(psd));

    return psdBuffer;
  } catch (error) {
    console.error("[PSD Builder] Failed to generate PSD:", error);
    throw new Error(`PSD generation failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Generate PSD for iteration variation
 * This creates a single-layer PSD with the composited ad image
 */
export async function generateIterationPSD(params: {
  runId: number;
  variationIndex: number;
  variationData: any;
  width: number;
  height: number;
}): Promise<{ url: string; fileName: string }> {
  const { runId, variationIndex, variationData, width, height } = params;

  // Extract data from variation
  const variation = variationData.variation;
  
  if (!variationData.productImageUrl || !variationData.controlImageUrl) {
    throw new Error("Missing required image URLs for PSD generation");
  }

  const psdData: PSDLayerData = {
    headline: variation.headline || "",
    subheadline: variation.subheadline || "",
    benefit1: variation.benefits?.[0] || "",
    benefit2: variation.benefits?.[1] || "",
    benefit3: variation.benefits?.[2] || "",
    cta: variation.cta || "",
    productImageUrl: variationData.productImageUrl,
    backgroundImageUrl: variationData.controlImageUrl,
    width,
    height,
  };

  // Generate PSD
  const psdBuffer = await generatePSD(psdData);

  // Upload to S3
  const { storagePut } = await import("../storage");
  const fileName = `run-${runId}-variation-${variationIndex + 1}.psd`;
  const { url } = await storagePut(`psds/${fileName}`, psdBuffer, "application/octet-stream");

  return { url, fileName };
}
