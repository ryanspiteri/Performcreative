/**
 * Child Variation Generation Service
 * 
 * Generates tactical child variations from completed parent runs.
 * Each child maintains the parent's strategic direction but varies tactical elements.
 */

import * as db from "../db";
import { generateProductAdWithNanoBananaPro } from "./nanoBananaPro";
import { buildChildVariationPrompt, getDiverseVariationTypes, type ChildVariationType } from "./childVariationPrompts";
import { withTimeout, VARIATION_TIMEOUT } from "./_shared";

/**
 * Generate child variations for multiple parent runs
 */
export async function generateChildVariationsForParents(
  parentRunIds: number[],
  childCountPerParent: number
): Promise<void> {
  console.log(`[ChildGen] Starting child generation for ${parentRunIds.length} parents, ${childCountPerParent} children each`);

  for (const parentRunId of parentRunIds) {
    try {
      await generateChildVariationsForSingleParent(parentRunId, childCountPerParent);
    } catch (err: any) {
      console.error(`[ChildGen] Failed to generate children for parent #${parentRunId}:`, err);
      // Continue with other parents even if one fails
    }
  }

  console.log(`[ChildGen] Completed child generation for all parents`);
}

/**
 * Generate child variations for a single parent run
 */
async function generateChildVariationsForSingleParent(
  parentRunId: number,
  childCount: number
): Promise<void> {
  console.log(`[ChildGen] Generating ${childCount} children for parent #${parentRunId}`);

  // Get parent run
  const parent = await db.getPipelineRun(parentRunId);
  if (!parent) {
    throw new Error(`Parent run #${parentRunId} not found`);
  }

  // Extract parent data
  const product = parent.product;
  const aspectRatio = parent.aspectRatio || "1:1";
  const iterationVariations = parent.iterationVariations as any;
  
  if (!iterationVariations || !Array.isArray(iterationVariations) || iterationVariations.length === 0) {
    throw new Error(`Parent run #${parentRunId} has no variations to use as base`);
  }

  // Use the first variation as the parent image
  const parentVariation = iterationVariations[0];
  const parentImageUrl = parentVariation.url;
  const headline = parentVariation.headline || `${product.toUpperCase()} VARIATION`;
  const subheadline = parentVariation.subheadline || undefined;

  // Get diverse variation types for children
  const variationTypes = getDiverseVariationTypes(childCount);

  // Get default product render
  const productRender = await db.getDefaultProductRender(product);
  if (!productRender) {
    throw new Error(`No product render found for ${product}`);
  }

  // Generate each child
  for (let i = 0; i < childCount; i++) {
    const variationType = variationTypes[i];
    
    try {
      console.log(`[ChildGen] Generating child ${i + 1}/${childCount} for parent #${parentRunId} (type: ${variationType})`);

      // Create child run in database
      const childRunId = await db.createPipelineRun({
        pipelineType: "iteration",
        status: "running",
        product,
        priority: parent.priority,
        triggerSource: "child_generation",
        iterationSourceUrl: parentImageUrl,
        creativityLevel: parent.creativityLevel,
        aspectRatio,
        parentRunId: parentRunId,
        variationLayer: "child",
        variationType: variationType,
        iterationStage: "generating_child",
      });

      // Build child variation prompt
      const prompt = buildChildVariationPrompt({
        parentImageUrl,
        variationType,
        productName: `ONEST Health ${product}`,
        headline,
        subheadline,
        aspectRatio,
      });

      console.log(`[ChildGen] Prompt for child #${childRunId}: ${prompt.substring(0, 150)}...`);

      // Generate image with Nano Banana Pro (same model as parent pipeline)
      const result = await withTimeout(
        generateProductAdWithNanoBananaPro({
          prompt,
          controlImageUrl: parentImageUrl,
          productRenderUrl: productRender.url,
          aspectRatio: aspectRatio as any,
          useCompositing: false,
          productPosition: "center",
          productScale: 0.45,
        }),
        VARIATION_TIMEOUT,
        `Child ${i + 1}/${childCount} for parent #${parentRunId}`
      );

      const childImageUrl = result.imageUrl;
      const childImageS3Key = result.s3Key;

      // Update child run with result
      await db.updatePipelineRun(childRunId, {
        status: "completed",
        iterationStage: "child_complete",
        iterationVariations: [
          {
            url: childImageUrl,
            s3Key: childImageS3Key,
            headline,
            subheadline,
            variationType,
            parentRunId,
          }
        ],
        completedAt: new Date(),
      });

      console.log(`[ChildGen] Child #${childRunId} completed: ${childImageUrl}`);
    } catch (err: any) {
      console.error(`[ChildGen] Failed to generate child ${i + 1} for parent #${parentRunId}:`, err);
      // Continue with next child even if one fails
    }
  }

  console.log(`[ChildGen] Completed ${childCount} children for parent #${parentRunId}`);
}

/**
 * Get all children for a parent run
 */
export async function getChildrenForParent(parentRunId: number) {
  return db.getChildRunsByParentId(parentRunId);
}

/**
 * Example usage:
 * 
 * // Generate 5 children for parent runs #123, #124, #125
 * await generateChildVariationsForParents([123, 124, 125], 5);
 * 
 * // Result: 15 total child variations (5 per parent)
 * // Each child has a different tactical variation (color, lighting, typography, etc.)
 */
