/**
 * ClickUp Integration for Iterate Winners Pipeline
 * Pushes completed ad variations to Graphic Ad Board for review
 */

import { ENV } from "../_core/env";

const CLICKUP_API_KEY = ENV.clickupApiKey;
const GRAPHIC_AD_BOARD_LIST_ID = "900302632860";
const LAUREN_ROW_USER_ID = "2772206";
const REVIEW_STATUS = "review";

interface IterationVariation {
  url: string;
  variation: {
    headline: string;
    subheadline?: string;
    benefits?: string[];
    cta?: string;
    angle?: string;
  };
}

/**
 * Push a single iteration variation to ClickUp Graphic Ad Board
 */
export async function pushIterationVariationToClickUp(params: {
  runId: number;
  variationIndex: number;
  variation: IterationVariation;
  product: string;
}): Promise<{ taskId: string; taskUrl: string }> {
  const { runId, variationIndex, variation, product } = params;

  // Create task name from headline
  const taskName = variation.variation.headline || `${product} - Variation ${variationIndex + 1}`;

  // Build task description with variation details
  const descriptionParts: string[] = [];
  
  if (variation.variation.subheadline) {
    descriptionParts.push(`**Subheadline:** ${variation.variation.subheadline}`);
  }
  
  if (variation.variation.angle) {
    descriptionParts.push(`**Angle:** ${variation.variation.angle}`);
  }
  
  if (variation.variation.benefits && variation.variation.benefits.length > 0) {
    descriptionParts.push(`**Benefits:**`);
    variation.variation.benefits.forEach(b => {
      descriptionParts.push(`• ${b}`);
    });
  }
  
  if (variation.variation.cta) {
    descriptionParts.push(`**CTA:** ${variation.variation.cta}`);
  }
  
  descriptionParts.push(`\n**Product:** ${product}`);
  descriptionParts.push(`**Pipeline Run:** #${runId}`);
  descriptionParts.push(`**Variation:** ${variationIndex + 1}`);
  descriptionParts.push(`\n**Image:** ${variation.url}`);

  const description = descriptionParts.join("\n");

  // Create task in ClickUp
  const response = await fetch(`https://api.clickup.com/api/v2/list/${GRAPHIC_AD_BOARD_LIST_ID}/task`, {
    method: "POST",
    headers: {
      "Authorization": CLICKUP_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: taskName,
      description,
      assignees: [LAUREN_ROW_USER_ID],
      status: REVIEW_STATUS,
      tags: ["iterate-winners", product.toLowerCase()],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create ClickUp task: ${response.status} ${errorText}`);
  }

  const task = await response.json();

  // Attach image to task
  try {
    await attachImageToTask(task.id, variation.url, `${taskName}.png`);
  } catch (err) {
    console.warn(`[ClickUp] Failed to attach image to task ${task.id}:`, err);
    // Don't fail the whole operation if attachment fails
  }

  return {
    taskId: task.id,
    taskUrl: task.url,
  };
}

/**
 * Attach image URL to ClickUp task
 */
async function attachImageToTask(taskId: string, imageUrl: string, fileName: string): Promise<void> {
  // Download image
  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error(`Failed to download image: ${imageResponse.statusText}`);
  }

  const imageBuffer = await imageResponse.arrayBuffer();
  const blob = new Blob([imageBuffer], { type: "image/png" });

  // Create form data
  const formData = new FormData();
  formData.append("attachment", blob, fileName);

  // Upload to ClickUp
  const response = await fetch(`https://api.clickup.com/api/v2/task/${taskId}/attachment`, {
    method: "POST",
    headers: {
      "Authorization": CLICKUP_API_KEY,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to attach image: ${response.status} ${errorText}`);
  }
}

/**
 * Push all variations from a completed iteration run to ClickUp
 */
export async function pushIterationRunToClickUp(params: {
  runId: number;
  variations: IterationVariation[];
  product: string;
}): Promise<{ taskIds: string[]; taskUrls: string[] }> {
  const { runId, variations, product } = params;

  console.log(`[ClickUp] Pushing ${variations.length} variations from run #${runId} to Graphic Ad Board`);

  const results = await Promise.allSettled(
    variations.map((variation, index) =>
      pushIterationVariationToClickUp({
        runId,
        variationIndex: index,
        variation,
        product,
      })
    )
  );

  const taskIds: string[] = [];
  const taskUrls: string[] = [];

  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      taskIds.push(result.value.taskId);
      taskUrls.push(result.value.taskUrl);
      console.log(`[ClickUp] ✓ Variation ${index + 1} pushed: ${result.value.taskUrl}`);
    } else {
      console.error(`[ClickUp] ✗ Failed to push variation ${index + 1}:`, result.reason);
    }
  });

  console.log(`[ClickUp] Successfully pushed ${taskIds.length}/${variations.length} variations`);

  return { taskIds, taskUrls };
}
