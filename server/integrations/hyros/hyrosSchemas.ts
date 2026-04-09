/**
 * Zod schemas for Hyros API responses.
 *
 * Parsed at the client boundary (inside hyrosClient.ts). If Hyros changes a
 * field shape, the parse fails loudly with a named error instead of silently
 * producing NaN and tanking downstream aggregation.
 *
 * Background: a previous version of this integration assumed
 * `sale.usdPrice` was a number (e.g. 49.95). Hyros actually returns an
 * object: `{ price, discount, hardCost, refunded, currency }`. That mismatch
 * caused every upsert to write NaN, MySQL rejected every row, and the
 * catch-all `console.warn` made it invisible. Never again — parse at boundary.
 */
import { z } from "zod";

/** The price object Hyros returns on `sale.price` and `sale.usdPrice`. */
export const HyrosPriceSchema = z
  .object({
    price: z.number().nullish(),
    discount: z.number().nullish(),
    hardCost: z.number().nullish(),
    refunded: z.number().nullish(),
    currency: z.string().nullish(),
  })
  .passthrough();
export type HyrosPrice = z.infer<typeof HyrosPriceSchema>;

export const HyrosAdSourceSchema = z
  .object({
    adSourceId: z.string(),
    adAccountId: z.string().nullish(),
    platform: z.string().nullish(),
  })
  .passthrough();

export const HyrosSourceLinkAdSchema = z
  .object({
    name: z.string().nullish(),
    adSourceId: z.string(),
  })
  .passthrough();

export const HyrosSourceSchema = z
  .object({
    sourceLinkId: z.string().nullish(),
    name: z.string().nullish(),
    tag: z.string().nullish(),
    disregarded: z.boolean().nullish(),
    organic: z.boolean().nullish(),
    trafficSource: z
      .object({ id: z.string().nullish(), name: z.string().nullish() })
      .passthrough()
      .nullish(),
    goal: z
      .object({ id: z.string().nullish(), name: z.string().nullish() })
      .passthrough()
      .nullish(),
    category: z
      .object({ id: z.string().nullish(), name: z.string().nullish() })
      .passthrough()
      .nullish(),
    adSource: HyrosAdSourceSchema.nullish(),
    sourceLinkAd: HyrosSourceLinkAdSchema.nullish(),
    clickDate: z.string().nullish(),
  })
  .passthrough();

export const HyrosLeadSchema = z
  .object({
    id: z.string(),
    email: z.string().nullish(),
    creationDate: z.string().nullish(),
    firstName: z.string().nullish(),
    lastName: z.string().nullish(),
    ips: z.array(z.string()).nullish(),
    phoneNumbers: z.array(z.string()).nullish(),
    tags: z.array(z.string()).nullish(),
    firstSource: HyrosSourceSchema.nullish(),
    lastSource: HyrosSourceSchema.nullish(),
  })
  .passthrough();

export const HyrosSaleSchema = z
  .object({
    id: z.string(),
    orderId: z.string().nullish(),
    creationDate: z.string(),
    qualified: z.boolean().nullish(),
    score: z.number().nullish(),
    recurring: z.boolean().nullish(),
    quantity: z.number().nullish(),
    price: HyrosPriceSchema.nullish(),
    usdPrice: HyrosPriceSchema.nullish(),
    product: z.unknown().nullish(),
    provider: z.unknown().nullish(),
    lead: HyrosLeadSchema.nullish(),
    firstSource: HyrosSourceSchema.nullish(),
    lastSource: HyrosSourceSchema.nullish(),
  })
  .passthrough();
export type HyrosSale = z.infer<typeof HyrosSaleSchema>;

export const HyrosSaleResponseSchema = z
  .object({
    result: z.array(HyrosSaleSchema),
    nextPageId: z.string().nullish(),
    request_id: z.string().nullish(),
  })
  .passthrough();
export type HyrosSaleResponse = z.infer<typeof HyrosSaleResponseSchema>;

/**
 * Thrown when Hyros returns a response that doesn't match the expected shape.
 * Carries a short description so the sync error surfaces something actionable
 * in the admin UI instead of a generic "Zod validation failed".
 */
export class HyrosShapeError extends Error {
  readonly fieldPath?: string;
  constructor(message: string, fieldPath?: string) {
    super(message);
    this.name = "HyrosShapeError";
    this.fieldPath = fieldPath;
  }
}

/**
 * Parse a /sales response at the boundary. Throws HyrosShapeError on mismatch
 * with a human-readable summary of the first few field-path failures.
 */
export function parseHyrosSalesResponse(raw: unknown): HyrosSaleResponse {
  const result = HyrosSaleResponseSchema.safeParse(raw);
  if (!result.success) {
    const first = result.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new HyrosShapeError(`Hyros /sales response shape mismatch: ${first}`, result.error.issues[0]?.path.join("."));
  }
  return result.data;
}
