// Use native fetch (available in Node.js 18+)

const BANNERBEAR_API_KEY = process.env.BANNERBEAR_API_KEY!;
const BANNERBEAR_SYNC_URL = 'https://sync.api.bannerbear.com'; // Synchronous endpoint
const BANNERBEAR_API_URL = 'https://api.bannerbear.com'; // Standard endpoint (for template info)

// ============================================================
// LAYER NAME MAPPING
// ============================================================
// The pipeline uses canonical names internally. Each template can
// map those canonical names to whatever the user named their layers
// in the Bannerbear editor. This avoids forcing the user to rename
// layers to match our code.

/** Canonical layer names used by the pipeline */
export type CanonicalLayer = 'headline' | 'subheadline' | 'benefit_callout' | 'background' | 'product_image' | 'logo';

/** Maps canonical pipeline layer names → actual Bannerbear layer names per template */
export interface TemplateLayerMapping {
  headline?: string;
  subheadline?: string;
  benefit_callout?: string;
  background?: string;
  product_image?: string;
  logo?: string;
}

/**
 * Per-template layer mappings.
 * Key = Bannerbear template UID.
 * Value = mapping from canonical names to the user's actual layer names.
 *
 * When a template is not listed here, the system will try to auto-detect
 * by fetching the template's layers and matching them.
 */
const TEMPLATE_LAYER_MAPPINGS: Record<string, TemplateLayerMapping> = {
  // Ryan's "Static Ad 1" template (1000x1000)
  // Layers: Product Render, Benefits, Heading, background, logo
  'E9YaWrZMqPrNZnRd74': {
    headline: 'Heading',
    benefit_callout: 'Benefits',
    background: 'background',
    product_image: 'Product Render',
    logo: 'Logo',
  },
};

/**
 * Auto-detect layer mapping by fetching template layers and matching
 * canonical names (case-insensitive, partial match).
 */
async function autoDetectMapping(templateUid: string): Promise<TemplateLayerMapping> {
  const layers = await getTemplateLayers(templateUid);
  const mapping: TemplateLayerMapping = {};

  const canonicalPatterns: Array<{ canonical: CanonicalLayer; patterns: string[] }> = [
    { canonical: 'headline', patterns: ['headline', 'heading', 'title', 'main_text', 'header'] },
    { canonical: 'subheadline', patterns: ['subheadline', 'subheading', 'subtitle', 'sub_text', 'tagline'] },
    { canonical: 'benefit_callout', patterns: ['benefit', 'benefits', 'callout', 'features', 'usp'] },
    { canonical: 'background', patterns: ['background', 'bg', 'backdrop', 'bg_image'] },
    { canonical: 'product_image', patterns: ['product', 'product_image', 'render', 'bottle', 'item'] },
    { canonical: 'logo', patterns: ['logo', 'brand', 'brand_logo', 'watermark'] },
  ];

  for (const { canonical, patterns } of canonicalPatterns) {
    // Try exact match first (case-insensitive)
    const exactMatch = layers.find(l =>
      patterns.some(p => l.toLowerCase() === p.toLowerCase())
    );
    if (exactMatch) {
      mapping[canonical] = exactMatch;
      continue;
    }

    // Try partial match (layer name contains pattern)
    const partialMatch = layers.find(l =>
      patterns.some(p => l.toLowerCase().includes(p.toLowerCase()))
    );
    if (partialMatch) {
      mapping[canonical] = partialMatch;
    }
  }

  return mapping;
}

/**
 * Get the effective layer mapping for a template.
 * Uses explicit mapping if available, otherwise auto-detects.
 */
export async function getLayerMapping(templateUid: string): Promise<TemplateLayerMapping> {
  // Check for explicit mapping first
  if (TEMPLATE_LAYER_MAPPINGS[templateUid]) {
    const explicit = TEMPLATE_LAYER_MAPPINGS[templateUid];
    // Merge with auto-detected for any missing mappings
    const autoDetected = await autoDetectMapping(templateUid);
    return { ...autoDetected, ...explicit };
  }

  // Fall back to auto-detection
  return autoDetectMapping(templateUid);
}

/**
 * Resolve a canonical layer name to the actual Bannerbear layer name.
 */
function resolveLayerName(mapping: TemplateLayerMapping, canonical: CanonicalLayer): string | null {
  return mapping[canonical] || null;
}

// ============================================================
// TYPES
// ============================================================

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
  type: string;
  [key: string]: any;
}

interface BannerbearTemplateInfo {
  uid: string;
  name: string;
  width: number;
  height: number;
  available_modifications: BannerbearTemplateLayer[];
  current_defaults?: BannerbearTemplateLayer[];
  preview_url?: string;
  tags?: string[];
}

// In-memory cache for template layer info
const templateCache = new Map<string, { layers: string[]; info: BannerbearTemplateInfo; fetchedAt: number }>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// ============================================================
// TEMPLATE LAYER DISCOVERY
// ============================================================

export async function getTemplateInfo(templateUid: string): Promise<BannerbearTemplateInfo> {
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
    // Use current_defaults for the full layer list (available_modifications only shows "dynamic" layers)
    const allLayers = info.current_defaults || info.available_modifications || [];
    const layerNames = allLayers.map((m: any) => m.name);

    console.log(`[Bannerbear] Template "${info.name}" has ${layerNames.length} layers: ${layerNames.join(', ')}`);

    templateCache.set(templateUid, { layers: layerNames, info, fetchedAt: Date.now() });
    return info;
  } catch (error: any) {
    console.error(`[Bannerbear] Failed to fetch template info:`, error.message);
    throw error;
  }
}

export async function getTemplateLayers(templateUid: string): Promise<string[]> {
  const info = await getTemplateInfo(templateUid);
  // Use current_defaults for full layer list; fall back to available_modifications
  const allLayers = info.current_defaults || info.available_modifications || [];
  return allLayers.map((m: any) => m.name);
}

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
      console.error(`[Bannerbear]   → Fix: Add these layers in Bannerbear template editor, or update the layer mapping.`);

      // Filter out modifications for layers that don't exist in the template
      const validModifications = modifications.filter(m => validation.templateLayers.includes(m.name));
      console.warn(`[Bannerbear] Proceeding with ${validModifications.length}/${modifications.length} valid modifications`);
      modifications = validModifications;
    }
  } catch (validationError: any) {
    console.warn(`[Bannerbear] Layer validation skipped (could not fetch template info): ${validationError.message}`);
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
// STATIC AD COMPOSITING (with layer mapping)
// ============================================================

/**
 * Generate a static ad creative using Bannerbear.
 * Automatically maps canonical layer names to the template's actual layer names.
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
  // Get the layer mapping for this template
  const mapping = await getLayerMapping(params.templateUid);

  console.log(`[Bannerbear] Layer mapping for template ${params.templateUid}:`, JSON.stringify(mapping));

  const modifications: BannerbearModification[] = [];

  // Map each canonical layer to the template's actual layer name
  const bgLayer = resolveLayerName(mapping, 'background');
  if (bgLayer) {
    modifications.push({ name: bgLayer, image_url: params.backgroundImageUrl });
  } else {
    console.warn(`[Bannerbear] No 'background' layer mapped — background image will not be applied`);
  }

  const productLayer = resolveLayerName(mapping, 'product_image');
  if (productLayer) {
    modifications.push({ name: productLayer, image_url: params.productRenderUrl });
  } else {
    console.warn(`[Bannerbear] No 'product_image' layer mapped — product render will not be applied`);
  }

  const logoLayer = resolveLayerName(mapping, 'logo');
  if (logoLayer) {
    modifications.push({ name: logoLayer, image_url: params.logoUrl });
  } else {
    console.warn(`[Bannerbear] No 'logo' layer mapped — logo will not be applied`);
  }

  const headlineLayer = resolveLayerName(mapping, 'headline');
  if (headlineLayer) {
    modifications.push({ name: headlineLayer, text: params.headline });
  } else {
    console.warn(`[Bannerbear] No 'headline' layer mapped — headline text will not be applied`);
  }

  const benefitLayer = resolveLayerName(mapping, 'benefit_callout');
  if (benefitLayer) {
    modifications.push({ name: benefitLayer, text: params.benefitCallout });
  } else {
    console.warn(`[Bannerbear] No 'benefit_callout' layer mapped — benefit text will not be applied`);
  }

  const subheadlineLayer = resolveLayerName(mapping, 'subheadline');
  if (subheadlineLayer) {
    if (params.subheadline) {
      modifications.push({ name: subheadlineLayer, text: params.subheadline });
    } else {
      modifications.push({ name: subheadlineLayer, hide: true });
    }
  }
  // No warning for missing subheadline — it's optional

  if (modifications.length === 0) {
    throw new Error(`[Bannerbear] No layers could be mapped for template ${params.templateUid}. Check your template has the required layers.`);
  }

  return await createBannerbearImage(params.templateUid, modifications);
}

// ============================================================
// TEMPLATE PREVIEW / TEST
// ============================================================

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
  layerMapping: TemplateLayerMapping;
}> {
  const headline = params.headline || 'BURN FAT FASTER';
  const subheadline = params.subheadline || 'Premium Australian Formulation';
  const benefitCallout = params.benefitCallout || 'Energy & Focus | Suppress Appetite | Boost Metabolism';
  const backgroundImageUrl = params.backgroundImageUrl || 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1080&h=1080&fit=crop';
  const productRenderUrl = params.productRenderUrl || 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663362584601/DNhkuelIfYJfVwmB.png';
  const logoUrl = params.logoUrl || 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663362584601/RAmNrJZaIJJFuitQ.png';

  // Get the layer mapping
  const layerMapping = await getLayerMapping(params.templateUid);

  console.log(`[Bannerbear Preview] Layer mapping:`, JSON.stringify(layerMapping));

  // Build modifications using the mapping
  const modifications: BannerbearModification[] = [];

  const bgLayer = resolveLayerName(layerMapping, 'background');
  if (bgLayer) modifications.push({ name: bgLayer, image_url: backgroundImageUrl });

  const productLayer = resolveLayerName(layerMapping, 'product_image');
  if (productLayer) modifications.push({ name: productLayer, image_url: productRenderUrl });

  const logoLayer = resolveLayerName(layerMapping, 'logo');
  if (logoLayer) modifications.push({ name: logoLayer, image_url: logoUrl });

  const headlineLayer = resolveLayerName(layerMapping, 'headline');
  if (headlineLayer) modifications.push({ name: headlineLayer, text: headline });

  const subLayer = resolveLayerName(layerMapping, 'subheadline');
  if (subLayer) modifications.push({ name: subLayer, text: subheadline });

  const benefitLayer = resolveLayerName(layerMapping, 'benefit_callout');
  if (benefitLayer) modifications.push({ name: benefitLayer, text: benefitCallout });

  // Validate using the mapped names
  const validation = await validateModifications(params.templateUid, modifications);

  // Generate the image
  const imageUrl = await createBannerbearImage(params.templateUid, modifications);

  return { imageUrl, validation, layerMapping };
}

// ============================================================
// LIST TEMPLATES
// ============================================================

export async function listBannerbearTemplates(): Promise<Array<{
  uid: string;
  name: string;
  width: number;
  height: number;
  layers: string[];
  previewUrl?: string;
  tags?: string[];
  layerMapping?: TemplateLayerMapping;
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
      layers: (t.current_defaults || t.available_modifications || []).map((m: any) => m.name),
      previewUrl: t.preview_url,
      tags: t.tags,
      layerMapping: TEMPLATE_LAYER_MAPPINGS[t.uid] || undefined,
    }));
  } catch (error: any) {
    console.error(`[Bannerbear] Failed to list templates:`, error.message);
    throw error;
  }
}

// ============================================================
// EXPORTS for backwards compatibility
// ============================================================

// Keep the old BANNERBEAR_TEMPLATES export but update it
export const BANNERBEAR_TEMPLATES = {
  staticAd1: 'E9YaWrZMqPrNZnRd74',
} as const;

export type BannerbearTemplateId = keyof typeof BANNERBEAR_TEMPLATES;
