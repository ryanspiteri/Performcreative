// Use native fetch (available in Node.js 18+)

const BANNERBEAR_API_KEY = process.env.BANNERBEAR_API_KEY!;
const BANNERBEAR_BASE_URL = 'https://sync.api.bannerbear.com'; // Synchronous endpoint

// Template UIDs from Bannerbear dashboard
export const BANNERBEAR_TEMPLATES = {
  hyperburnHelps: 'wXmzGBDakV3vZLN7gj',
  bluePurpleGradient: 'E9YaWrZMqPrNZnRd74',
} as const;

export type BannerbearTemplateId = keyof typeof BANNERBEAR_TEMPLATES;

interface BannerbearModification {
  name: string;
  text?: string;
  image_url?: string;
  color?: string;
  background?: string;
  hide?: boolean;
}

interface BannerbearImageRequest {
  template: string; // Template UID
  modifications: BannerbearModification[];
  transparent?: boolean;
  metadata?: string;
}

interface BannerbearImageResponse {
  uid: string;
  status: 'completed' | 'pending' | 'failed';
  image_url: string;
  image_url_png?: string;
  image_url_jpg?: string;
  created_at: string;
  template: string;
  modifications: BannerbearModification[];
}

/**
 * Create an image using Bannerbear's synchronous API
 * @param template - Bannerbear template UID
 * @param modifications - List of layer modifications (text, images, colors)
 * @returns The completed image URL
 */
export async function createBannerbearImage(
  template: string,
  modifications: BannerbearModification[]
): Promise<string> {
  console.log(`[Bannerbear] Creating image with template: ${template}`);
  console.log(`[Bannerbear] Modifications:`, JSON.stringify(modifications, null, 2));

  const requestBody: BannerbearImageRequest = {
    template,
    modifications,
    transparent: false, // Use opaque background
  };

  try {
    const response = await fetch(`${BANNERBEAR_BASE_URL}/v2/images`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${BANNERBEAR_API_KEY}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Bannerbear API error (${response.status}): ${errorText}`);
    }

    const result: BannerbearImageResponse = await response.json() as BannerbearImageResponse;

    if (result.status !== 'completed') {
      throw new Error(`Bannerbear image generation failed: status = ${result.status}`);
    }

    console.log(`[Bannerbear] ✓ Image created: ${result.image_url}`);
    return result.image_url;
  } catch (error: any) {
    console.error(`[Bannerbear] ✗ Error creating image:`, error.message);
    throw error;
  }
}

/**
 * Generate a static ad creative using Bannerbear
 * @param templateUid - Bannerbear template UID
 * @param headline - Main headline text
 * @param subheadline - Subheadline text (optional)
 * @param benefitCallout - Shared benefit callout text
 * @param backgroundImageUrl - Background image URL (from Flux Pro or uploaded)
 * @param productRenderUrl - Product render image URL
 * @param logoUrl - ONEST logo URL
 * @returns The final composite image URL
 */
export async function generateStaticAdWithBannerbear(params: {
  templateUid: string;
  headline: string;
  subheadline?: string;
  benefitCallout: string;
  backgroundImageUrl: string;
  productRenderUrl: string;
  logoUrl: string;
}): Promise<string> {
  const modifications: BannerbearModification[] = [
    // Background layer
    {
      name: 'background',
      image_url: params.backgroundImageUrl,
    },
    // Product render layer
    {
      name: 'product_image',
      image_url: params.productRenderUrl,
    },
    // Logo layer
    {
      name: 'logo',
      image_url: params.logoUrl,
    },
    // Headline text layer
    {
      name: 'headline',
      text: params.headline,
    },
    // Benefit callout layer
    {
      name: 'benefit_callout',
      text: params.benefitCallout,
    },
  ];

  // Subheadline is optional
  if (params.subheadline) {
    modifications.push({
      name: 'subheadline',
      text: params.subheadline,
    });
  } else {
    // Hide the subheadline layer if no text provided
    modifications.push({
      name: 'subheadline',
      hide: true,
    });
  }

  return await createBannerbearImage(params.templateUid, modifications);
}
