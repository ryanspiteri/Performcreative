/**
 * Common ImageGenerator interface — lets the iteration pipeline route to
 * either Nano Banana (Gemini) or OpenAI gpt-image-1 based on the run's
 * imageModel setting. Both backends produce the same result shape so the
 * pipeline is model-agnostic downstream.
 */

export type ImageBackend = "nano_banana_pro" | "nano_banana_2" | "openai_gpt_image";

export interface ImageGenerateOptions {
  /** Gemini-style multi-paragraph prompt from buildReferenceBasedPrompt. */
  prompt: string;
  /** Reference ad (style). */
  controlImageUrl?: string;
  /** Product render — always used by both backends. */
  productRenderUrl?: string;
  /** Person type reference (optional). */
  personImageUrl?: string;
  aspectRatio?: "1:1" | "2:3" | "3:2" | "3:4" | "4:3" | "4:5" | "5:4" | "9:16" | "16:9";
  resolution?: "1K" | "2K" | "4K";
  useCompositing?: boolean;
  productPosition?: "center" | "left" | "right" | "bottom-center" | "bottom-left" | "bottom-right";
  productScale?: number;
}

export interface ImageGenerateResult {
  imageUrl: string;
  s3Key: string;
  /** Cost in USD if known, else 0. */
  cost?: number;
  /** End-to-end latency in ms. */
  latencyMs?: number;
  /** Which backend produced the image (for logging + A/B telemetry). */
  backend?: ImageBackend;
}

export interface ImageGenerator {
  generate(opts: ImageGenerateOptions): Promise<ImageGenerateResult>;
}
