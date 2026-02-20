// Use native fetch (available in Node.js 18+)

const BANNERBEAR_API_KEY = process.env.BANNERBEAR_API_KEY!;
const BANNERBEAR_SYNC_URL = 'https://sync.api.bannerbear.com'; // Synchronous endpoint
const BANNERBEAR_API_URL = 'https://api.bannerbear.com'; // Standard endpoint (for template info)

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
  template: string;
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

interface BannerbearTemplateLayer {
  name: string;
  type: string; // 'text', 'image', 'shape', etc.
  [key: string]: any;
}

interface BannerbearTemplateInfo {
  uid: string;
  name: string;
  width: number;
  height: number;
  available_modifications: BannerbearTemplateLayer[];
  preview_url?: string;
  tags?: string[];
}

// In-memory cache for template layer info (avoids repeated API calls)
const templateCache = new Map<string, { layers: string[]; info: BannerbearTemplateInfo; fetchedAt: number }>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// ============================================================
// TEMPLATE LAYER DISCOVERY
// ============================================================

/**
 * Fetch template details from Bannerbear API, including available layer names.
 * Results are cached for 10 minutes.
 */
export async function getTemplateInfo(templateUid: string): Promise<BannerbearTemplateInfo> {
  // Check cache first
  const cached = templateCache.get(templateUid);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return cached.info;
  }

  console.log(`[Bannerbear] Fetching template info for: ${templateUid}`);

  try {
    const response = await fetch(`${BANNERBEAR_API_URL}/v2/templates/${templateUid}?extended=true`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${BANNERBEAR_API_KEY}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch template info (${response.status}): ${errorText}`);
    }

    const info = await response.json() as BannerbearTemplateInfo;
    const layerNames = (info.available_modifications || []).map((m: any) => m.name);

    console.log(`[Bannerbear] Template "${info.name}" has ${layerNames.length} layers: ${layerNames.join(', ')}`);

    templateCache.set(templateUid, { layers: layerNames, info, fetchedAt: Date.now() });
    return info;
  } catch (error: any) {
    console.error(`[Bannerbear] Failed to fetch template info:`, error.message);
    throw error;
  }
}

/**
 * Get just the layer names for a template (convenience wrapper).
 */
export async function getTemplateLayers(templateUid: string): Promise<string[]> {
  const info = await getTemplateInfo(templateUid);
  return (info.available_modifications || []).map((m: any) => m.name);
}

/**
 * Validate that the modifications we want to send match the template's actual layers.
 * Returns a detailed report of matches, missing layers, and extra layers.
 */
export async function validateModifications(
  templateUid: string,
  modifications: BannerbearModification[]
): Promise<{
  valid: boolean;
  templateLayers: string[];
  requestedLayers: string[];
  matchedLayers: string[];
  missingFromTemplate: string[];
  extraInTemplate: string[];
  warnings: string[];
}> {
  const templateLayers = await getTemplateLayers(templateUid);
  const requestedLayers = modifications.map(m => m.name);

  const matchedLayers = requestedLayers.filter(l => templateLayers.includes(l));
  const missingFromTemplate = requestedLayers.filter(l => !templateLayers.includes(l));
  const extraInTemplate = templateLayers.filter(l => !requestedLayers.includes(l));

  const warnings: string[] = [];

  if (missingFromTemplate.length > 0) {
    warnings.push(
      `⚠️ These layers are NOT in your Bannerbear template: [${missingFromTemplate.join(', ')}]. ` +
      `They will be IGNORED by Bannerbear. You need to add these layers in the Bannerbear template editor.`
    );
  }

  if (extraInTemplate.length > 0) {
    warnings.push(
      `ℹ️ These template layers are not being set by the pipeline: [${extraInTemplate.join(', ')}]. ` +
      `They will use their default values from the template.`
    );
  }

  const valid = missingFromTemplate.length === 0;

  return {
    valid,
    templateLayers,
    requestedLayers,
    matchedLayers,
    missingFromTemplate,
    extraInTemplate,
    warnings,
  };
}

// ============================================================
// IMAGE CREATION
// ============================================================

/**
 * Create an image using Bannerbear's synchronous API.
 * Includes layer validation and detailed error logging.
 */
export async function createBannerbearImage(
  template: string,
  modifications: BannerbearModification[]
): Promise<string> {
  console.log(`[Bannerbear] Creating image with template: ${template}`);
  console.log(`[Bannerbear] Sending ${modifications.length} modifications: ${modifications.map(m => m.name).join(', ')}`);

  // Validate layers before sending
  try {
    const validation = await validateModifications(template, modifications);

    if (validation.warnings.length > 0) {
      for (const warning of validation.warnings) {
        console.warn(`[Bannerbear] ${warning}`);
      }
    }

    if (!validation.valid) {
      console.error(`[Bannerbear] ❌ LAYER MISMATCH DETECTED`);
      console.error(`[Bannerbear]   Template layers: [${validation.templateLayers.join(', ')}]`);
      console.error(`[Bannerbear]   Requested layers: [${validation.requestedLayers.join(', ')}]`);
      console.error(`[Bannerbear]   Missing from template: [${validation.missingFromTemplate.join(', ')}]`);
      console.error(`[Bannerbear]   → Fix: Add these layers in Bannerbear template editor, or rename existing layers to match.`);

      // Filter out modifications for layers that don't exist in the template
      // This prevents Bannerbear from silently ignoring them
      const validModifications = modifications.filter(m => validation.templateLayers.includes(m.name));
      console.warn(`[Bannerbear] Proceeding with ${validModifications.length}/${modifications.length} valid modifications`);
      modifications = validModifications;
    }
  } catch (validationError: any) {
    console.warn(`[Bannerbear] Layer validation skipped (could not fetch template info): ${validationError.message}`);
    // Continue anyway — the image creation might still work
  }

  const requestBody: BannerbearImageRequest = {
    template,
    modifications,
    transparent: false,
  };

  try {
    const response = await fetch(`${BANNERBEAR_SYNC_URL}/v2/images`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${BANNERBEAR_API_KEY}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();

      // Parse specific Bannerbear error messages for better user feedback
      let friendlyError = `Bannerbear API error (${response.status}): ${errorText}`;
      if (response.status === 422) {
        friendlyError = `Bannerbear rejected the request (422 Unprocessable). This usually means a layer name doesn't match. Error: ${errorText}`;
      } else if (response.status === 404) {
        friendlyError = `Bannerbear template not found (404). Check that template UID "${template}" is correct.`;
      } else if (response.status === 401) {
        friendlyError = `Bannerbear authentication failed (401). Check your BANNERBEAR_API_KEY.`;
      }

      console.error(`[Bannerbear] ❌ ${friendlyError}`);
      throw new Error(friendlyError);
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

// ============================================================
// STATIC AD COMPOSITING
// ============================================================

/**
 * Generate a static ad creative using Bannerbear.
 * Validates template layers before compositing.
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
    { name: 'background', image_url: params.backgroundImageUrl },
    { name: 'product_image', image_url: params.productRenderUrl },
    { name: 'logo', image_url: params.logoUrl },
    { name: 'headline', text: params.headline },
    { name: 'benefit_callout', text: params.benefitCallout },
  ];

  if (params.subheadline) {
    modifications.push({ name: 'subheadline', text: params.subheadline });
  } else {
    modifications.push({ name: 'subheadline', hide: true });
  }

  return await createBannerbearImage(params.templateUid, modifications);
}

// ============================================================
// TEMPLATE PREVIEW / TEST
// ============================================================

/**
 * Generate a preview image with dummy data to test a Bannerbear template.
 * Sends all expected layer names with placeholder content.
 */
export async function previewBannerbearTemplate(params: {
  templateUid: string;
  headline?: string;
  subheadline?: string;
  benefitCallout?: string;
  backgroundImageUrl?: string;
  productRenderUrl?: string;
  logoUrl?: string;
}): Promise<{
  imageUrl: string;
  validation: {
    valid: boolean;
    templateLayers: string[];
    matchedLayers: string[];
    missingFromTemplate: string[];
    extraInTemplate: string[];
    warnings: string[];
  };
}> {
  // Default dummy content for testing
  const headline = params.headline || 'BURN FAT FASTER';
  const subheadline = params.subheadline || 'Premium Australian Formulation';
  const benefitCallout = params.benefitCallout || 'Energy & Focus | Suppress Appetite | Boost Metabolism';
  const backgroundImageUrl = params.backgroundImageUrl || 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1080&h=1080&fit=crop'; // Dark gym background
  const productRenderUrl = params.productRenderUrl || 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663362584601/DNhkuelIfYJfVwmB.png';
  const logoUrl = params.logoUrl || 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663362584601/RAmNrJZaIJJFuitQ.png';

  const modifications: BannerbearModification[] = [
    { name: 'background', image_url: backgroundImageUrl },
    { name: 'product_image', image_url: productRenderUrl },
    { name: 'logo', image_url: logoUrl },
    { name: 'headline', text: headline },
    { name: 'subheadline', text: subheadline },
    { name: 'benefit_callout', text: benefitCallout },
  ];

  // Validate first
  const validation = await validateModifications(params.templateUid, modifications);

  // Generate the image (with only valid layers)
  const imageUrl = await createBannerbearImage(params.templateUid, modifications);

  return { imageUrl, validation };
}

/**
 * List all templates in the Bannerbear project with their layer info.
 */
export async function listBannerbearTemplates(): Promise<Array<{
  uid: string;
  name: string;
  width: number;
  height: number;
  layers: string[];
  previewUrl?: string;
  tags?: string[];
}>> {
  console.log(`[Bannerbear] Listing all templates...`);

  try {
    const response = await fetch(`${BANNERBEAR_API_URL}/v2/templates?extended=true`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${BANNERBEAR_API_KEY}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to list templates (${response.status}): ${errorText}`);
    }

    const templates = await response.json() as BannerbearTemplateInfo[];

    return templates.map(t => ({
      uid: t.uid,
      name: t.name,
      width: t.width,
      height: t.height,
      layers: (t.available_modifications || []).map((m: any) => m.name),
      previewUrl: t.preview_url,
      tags: t.tags,
    }));
  } catch (error: any) {
    console.error(`[Bannerbear] Failed to list templates:`, error.message);
    throw error;
  }
}
