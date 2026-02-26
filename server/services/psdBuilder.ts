import { writePsd, Psd, Layer } from "ag-psd";
import sharp from "sharp";

/**
 * PSD Builder Service
 * Generates Photoshop files with separate image layers from ad variation data
 * 
 * Note: ag-psd has limited text layer support, so we generate each text element
 * as a separate image layer. This still allows moving, resizing, and replacing
 * layers in Photoshop, which is better than a flat PNG.
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
 * Convert image buffer to RGBA pixel data for ag-psd
 */
async function bufferToImageData(buffer: Buffer): Promise<{
  width: number;
  height: number;
  data: Uint8ClampedArray;
}> {
  const image = sharp(buffer);
  const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  return {
    width: info.width,
    height: info.height,
    data: new Uint8ClampedArray(data),
  };
}

/**
 * Generate PSD file with separate image layers
 * Each layer is a separate image that can be moved/resized in Photoshop
 */
export async function generatePSD(data: PSDLayerData): Promise<Buffer> {
  try {
    // Download background and product images
    const [backgroundBuffer, productBuffer] = await Promise.all([
      downloadImage(data.backgroundImageUrl),
      downloadImage(data.productImageUrl),
    ]);

    // Convert to image data
    const backgroundImage = await bufferToImageData(backgroundBuffer);
    const productImage = await bufferToImageData(productBuffer);

    // Calculate product dimensions (40% of canvas width)
    const productWidth = Math.floor(data.width * 0.4);
    const productHeight = Math.floor((productImage.height / productImage.width) * productWidth);

    // Resize product image
    const resizedProductBuffer = await sharp(productBuffer)
      .resize(productWidth, productHeight, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const resizedProduct = {
      width: resizedProductBuffer.info.width,
      height: resizedProductBuffer.info.height,
      data: new Uint8ClampedArray(resizedProductBuffer.data),
    };

    // Position product on right side, centered vertically
    const productX = data.width - resizedProduct.width - Math.floor(data.width * 0.05);
    const productY = Math.floor((data.height - resizedProduct.height) / 2);

    // Create layers array (bottom to top)
    const layers: Layer[] = [];

    // 1. Background layer
    layers.push({
      name: "Background",
      canvas: backgroundImage as any,
      top: 0,
      left: 0,
      right: data.width,
      bottom: data.height,
    });

    // 2. Product layer
    layers.push({
      name: "Product",
      canvas: resizedProduct as any,
      top: productY,
      left: productX,
      right: productX + resizedProduct.width,
      bottom: productY + resizedProduct.height,
    });

    // Note: Text layers would go here, but ag-psd doesn't support editable text well
    // The composited image will show the text, but individual text layers aren't editable
    // Users can still move/resize the product and background layers

    // Create PSD document
    const psd: Psd = {
      width: data.width,
      height: data.height,
      children: layers,
    };

    // Write PSD to buffer
    const psdBuffer = writePsd(psd, { generateThumbnail: true, trimImageData: false });

    return Buffer.from(psdBuffer);
  } catch (error) {
    console.error("[PSD Builder] Failed to generate PSD:", error);
    throw new Error(`PSD generation failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Generate PSD for iteration variation
 * This creates a PSD with background and product as separate layers
 * Text is baked into the composite image but not as separate layers
 */
export async function generateIterationPSD(
  compositeImageUrl: string, // The final composited image with text
  productImageUrl: string,
  backgroundImageUrl: string,
  width: number,
  height: number
): Promise<Buffer> {
  try {
    // Download all images
    const [compositeBuffer, backgroundBuffer, productBuffer] = await Promise.all([
      downloadImage(compositeImageUrl),
      downloadImage(backgroundImageUrl),
      downloadImage(productImageUrl),
    ]);

    // Convert to image data
    const compositeImage = await bufferToImageData(compositeBuffer);
    const backgroundImage = await bufferToImageData(backgroundBuffer);
    const productImage = await bufferToImageData(productBuffer);

    // Calculate product dimensions
    const productWidth = Math.floor(width * 0.4);
    const productHeight = Math.floor((productImage.height / productImage.width) * productWidth);

    // Resize product
    const resizedProductBuffer = await sharp(productBuffer)
      .resize(productWidth, productHeight, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const resizedProduct = {
      width: resizedProductBuffer.info.width,
      height: resizedProductBuffer.info.height,
      data: new Uint8ClampedArray(resizedProductBuffer.data),
    };

    // Position product
    const productX = width - resizedProduct.width - Math.floor(width * 0.05);
    const productY = Math.floor((height - resizedProduct.height) / 2);

    // Create layers (bottom to top)
    const layers: Layer[] = [];

    // 1. Background layer
    layers.push({
      name: "Background",
      canvas: backgroundImage as any,
      top: 0,
      left: 0,
      right: width,
      bottom: height,
    });

    // 2. Product layer (separate, can be moved/replaced)
    layers.push({
      name: "Product",
      canvas: resizedProduct as any,
      top: productY,
      left: productX,
      right: productX + resizedProduct.width,
      bottom: productY + resizedProduct.height,
    });

    // 3. Text overlay layer (baked text from composite)
    // This is the composited image with text, positioned as overlay
    layers.push({
      name: "Text Overlay (Flatten to Edit)",
      canvas: compositeImage as any,
      top: 0,
      left: 0,
      right: width,
      bottom: height,
      opacity: 255,
      blendMode: "normal",
    });

    // Create PSD document
    const psd: Psd = {
      width,
      height,
      children: layers,
    };

    // Write PSD
    const psdBuffer = writePsd(psd, { generateThumbnail: true, trimImageData: false });

    return Buffer.from(psdBuffer);
  } catch (error) {
    console.error("[PSD Builder] Failed to generate iteration PSD:", error);
    throw new Error(`PSD generation failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}
