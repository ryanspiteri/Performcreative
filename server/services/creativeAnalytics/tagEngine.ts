/**
 * AI-powered creative tagging engine.
 *
 * Tags each creative asset with structured labels from a controlled
 * vocabulary so the pattern miner can aggregate "what works" across
 * winning creatives without string-matching fragmentation.
 *
 * Three dimensions per creative:
 *   - messagingAngle: the strategic angle (transformation, social_proof, etc.)
 *   - hookTactic: the hook execution style (before_after, question, bold_claim, etc.)
 *   - visualFormat: the visual treatment (talking_head, product_demo, etc.)
 *   - hookText: the actual extracted hook text for reference
 *
 * Inputs (per creative):
 *   - adCopyBody (the primary text in the feed — usually contains the hook)
 *   - adCopyTitle (the headline below the creative)
 *   - creative name (often contains the hook concept in the naming convention)
 *   - thumbnailUrl (for image creatives, this IS the creative)
 *   - creativeType (video vs image affects confidence and approach)
 *
 * Batch mode: processes up to 10 creatives per Claude call to control cost.
 * Each call returns structured JSON with per-creative tags.
 *
 * Codex finding #3 mitigation: for video creatives where we only have a
 * thumbnail + copy text, the confidence is lower (50-70) vs image creatives
 * where the thumbnail IS the creative (confidence 80-95).
 *
 * Called as an async pass AFTER Meta sync (not inline, per codex #9), via
 * the admin UI or as a scheduled step after scoreRecompute.
 */
import Anthropic from "@anthropic-ai/sdk";
import { ENV } from "../../_core/env";
import * as db from "../../db";
import type { InsertCreativeAiTag } from "../../../drizzle/schema";

const TAG = "[TagEngine]";
const CURRENT_TAG_VERSION = 1;

// Controlled vocabulary — only these values are accepted. Anything else
// from Claude is mapped to the closest match or 'other'.
export const MESSAGING_ANGLES = [
  "transformation", "social_proof", "ingredient_science", "urgency",
  "lifestyle", "problem_agitate", "authority", "emotional_appeal", "other",
] as const;

export const HOOK_TACTICS = [
  "before_after", "question", "bold_claim", "ugc_testimonial",
  "product_demo", "storytelling", "controversy", "listicle", "other",
] as const;

export const VISUAL_FORMATS = [
  "talking_head", "product_demo", "lifestyle_broll", "text_overlay",
  "split_screen", "unboxing", "comparison", "mashup", "static_image", "other",
] as const;

export type MessagingAngle = typeof MESSAGING_ANGLES[number];
export type HookTactic = typeof HOOK_TACTICS[number];
export type VisualFormat = typeof VISUAL_FORMATS[number];

interface CreativeForTagging {
  id: number;
  name: string | null;
  creativeType: string;
  thumbnailUrl: string | null;
  adCopyBody: string | null;
  adCopyTitle: string | null;
}

interface TagResult {
  creativeAssetId: number;
  messagingAngle: MessagingAngle;
  hookTactic: HookTactic;
  visualFormat: VisualFormat;
  hookText: string;
  confidence: number;
}

/**
 * Tag a batch of creatives via a single Claude call. Returns structured
 * tags for each creative in the batch.
 *
 * Batch size should be 10 or fewer to keep the prompt manageable and
 * reduce the blast radius of a single malformed response.
 */
export async function tagBatch(creatives: CreativeForTagging[]): Promise<TagResult[]> {
  if (creatives.length === 0) return [];

  const client = new Anthropic({ apiKey: ENV.anthropicApiKey });

  const creativeSummaries = creatives.map((c, i) => {
    const parts = [`Creative #${i + 1} (id=${c.id}, type=${c.creativeType}):`];
    if (c.name) parts.push(`Name: "${c.name}"`);
    if (c.adCopyBody) parts.push(`Ad copy (body): "${c.adCopyBody.slice(0, 500)}"`);
    if (c.adCopyTitle) parts.push(`Headline: "${c.adCopyTitle.slice(0, 200)}"`);
    if (!c.adCopyBody && !c.adCopyTitle && !c.name) {
      parts.push("(No copy or name available — skip this creative)");
    }
    return parts.join("\n  ");
  }).join("\n\n");

  const systemPrompt = `You are an ad creative analyst for ONEST Health, an Australian DTC supplement brand.

Your job: classify each ad creative into three dimensions using ONLY the values from the controlled vocabulary below. Return valid JSON.

MESSAGING ANGLES (pick one per creative):
${MESSAGING_ANGLES.join(", ")}

HOOK TACTICS (pick one per creative):
${HOOK_TACTICS.join(", ")}

VISUAL FORMATS (pick one per creative):
${VISUAL_FORMATS.join(", ")}

For each creative, also extract the "hook text" — the first sentence or phrase that grabs attention. If no clear hook exists, use the strongest benefit statement from the copy.

Return a JSON array with one object per creative:
[
  {
    "id": <creative id>,
    "messagingAngle": "<value from list>",
    "hookTactic": "<value from list>",
    "visualFormat": "<value from list>",
    "hookText": "<extracted hook text>",
    "confidence": <0-100 integer>
  }
]

Confidence guidance:
- 85-95: Image creative with clear copy and visual — high confidence
- 65-80: Video creative where you only have the copy text — moderate confidence
- 40-60: Creative with minimal copy or ambiguous angle — low confidence
- Below 40: Skip and use "other" for all dimensions`;

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Classify these ${creatives.length} ONEST Health ad creatives:\n\n${creativeSummaries}`,
        },
      ],
    });

    const text = response.content[0]?.type === "text" ? response.content[0].text : "";
    // Extract JSON from the response (Claude sometimes wraps in markdown code blocks)
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.warn(`${TAG} Claude returned no JSON array. Raw response: ${text.slice(0, 200)}`);
      return [];
    }

    const parsed: any[] = JSON.parse(jsonMatch[0]);
    const results: TagResult[] = [];

    for (const item of parsed) {
      const creative = creatives.find((c) => c.id === item.id);
      if (!creative) continue;

      results.push({
        creativeAssetId: item.id,
        messagingAngle: MESSAGING_ANGLES.includes(item.messagingAngle) ? item.messagingAngle : "other",
        hookTactic: HOOK_TACTICS.includes(item.hookTactic) ? item.hookTactic : "other",
        visualFormat: VISUAL_FORMATS.includes(item.visualFormat) ? item.visualFormat : "other",
        hookText: String(item.hookText ?? "").slice(0, 500),
        confidence: Math.max(0, Math.min(100, Number(item.confidence) || 50)),
      });
    }

    return results;
  } catch (err: any) {
    console.error(`${TAG} Batch tagging failed:`, err?.message ?? err);
    return [];
  }
}

/**
 * Run a tagging pass on all untagged creatives. Called after Meta sync
 * as an async post-processing step (NOT inline with sync).
 *
 * Finds creatives that have ad copy but no tag row for the current
 * tagVersion, batches them in groups of 10, tags via Claude, upserts.
 *
 * Returns the count of newly tagged creatives.
 */
export async function runTaggingPass(): Promise<{ tagged: number; errors: number }> {
  const dbConn = await db.getDb();
  if (!dbConn) return { tagged: 0, errors: 0 };

  const { sql } = await import("drizzle-orm");

  // Find creatives that have copy but no tag for the current version.
  // Limit to 100 per pass to control Claude cost + runtime.
  const untaggedRows: any = await dbConn.execute(sql`
    SELECT ca.id, ca.name, ca.creativeType, ca.thumbnailUrl, ca.adCopyBody, ca.adCopyTitle
    FROM creativeAssets ca
    LEFT JOIN creativeAiTags t ON t.creativeAssetId = ca.id AND t.tagVersion = ${CURRENT_TAG_VERSION}
    WHERE t.id IS NULL
      AND (ca.adCopyBody IS NOT NULL OR ca.adCopyTitle IS NOT NULL OR ca.name IS NOT NULL)
    ORDER BY ca.lastSeenAt DESC
    LIMIT 100
  `);
  const untagged: CreativeForTagging[] = (Array.isArray(untaggedRows[0]) ? untaggedRows[0] : untaggedRows).map(
    (r: any) => ({
      id: Number(r.id),
      name: r.name,
      creativeType: r.creativeType,
      thumbnailUrl: r.thumbnailUrl,
      adCopyBody: r.adCopyBody,
      adCopyTitle: r.adCopyTitle,
    }),
  );

  if (untagged.length === 0) {
    console.log(`${TAG} No untagged creatives found`);
    return { tagged: 0, errors: 0 };
  }

  console.log(`${TAG} Found ${untagged.length} untagged creatives, processing in batches of 10`);

  let tagged = 0;
  let errors = 0;
  const BATCH_SIZE = 10;

  for (let i = 0; i < untagged.length; i += BATCH_SIZE) {
    const batch = untagged.slice(i, i + BATCH_SIZE);
    try {
      const results = await tagBatch(batch);
      for (const result of results) {
        try {
          const row: InsertCreativeAiTag = {
            creativeAssetId: result.creativeAssetId,
            messagingAngle: result.messagingAngle,
            hookTactic: result.hookTactic,
            visualFormat: result.visualFormat,
            hookText: result.hookText,
            confidence: result.confidence,
            taggedAt: new Date(),
            tagVersion: CURRENT_TAG_VERSION,
          };
          await db.upsertCreativeAiTag(row);
          tagged++;
        } catch (upsertErr: any) {
          errors++;
          console.warn(`${TAG} Upsert failed for creative ${result.creativeAssetId}:`, upsertErr?.message ?? upsertErr);
        }
      }
    } catch (batchErr: any) {
      errors += batch.length;
      console.error(`${TAG} Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, batchErr?.message ?? batchErr);
    }
  }

  console.log(`${TAG} Tagging pass complete: ${tagged} tagged, ${errors} errors out of ${untagged.length} candidates`);
  return { tagged, errors };
}
