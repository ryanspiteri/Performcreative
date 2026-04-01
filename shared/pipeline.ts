/** Pipeline configuration constants shared between client and server */

export const PRIORITIES = ["Low", "Medium", "High", "Urgent"] as const;
export type Priority = typeof PRIORITIES[number];

export const SCRIPT_STYLES = [
  { id: "DR", label: "Direct Response", shortLabel: "DR", description: "Hard-sell with clear offer, urgency, and direct CTA", color: "bg-red-500/20 text-red-300 border-red-500/30" },
  { id: "UGC", label: "UGC / Testimonial", shortLabel: "UGC", description: "Authentic personal experience, soft-sell recommendation", color: "bg-green-500/20 text-green-300 border-green-500/30" },
  { id: "FOUNDER", label: "Founder-Led", shortLabel: "Founder", description: "Brand founder speaking with authority and passion", color: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
  { id: "EDUCATION", label: "Education / Myth-Busting", shortLabel: "Education", description: "Teach something surprising, position product as answer", color: "bg-purple-500/20 text-purple-300 border-purple-500/30" },
  { id: "LIFESTYLE", label: "Lifestyle / Aspiration", shortLabel: "Lifestyle", description: "Aspirational day-in-the-life with product woven in", color: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
  { id: "DEMO", label: "Problem / Solution Demo", shortLabel: "Demo", description: "Show the problem, demonstrate the product solving it", color: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30" },
] as const;
export type ScriptStyleId = typeof SCRIPT_STYLES[number]["id"];

export const DURATIONS = [
  { value: 45, label: "45s" },
  { value: 60, label: "60s" },
  { value: 90, label: "90s" },
] as const;

export const FUNNEL_STAGES = [
  { id: "cold" as const, label: "Cold", description: "New audiences, problem-aware", color: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
  { id: "warm" as const, label: "Warm", description: "Engaged, solution-aware", color: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
  { id: "retargeting" as const, label: "Retargeting", description: "Visited site, product-aware", color: "bg-orange-500/20 text-orange-300 border-orange-500/30" },
  { id: "retention" as const, label: "Retention", description: "Existing customers", color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
] as const;
export type FunnelStage = typeof FUNNEL_STAGES[number]["id"];

export const ACTOR_ARCHETYPES = [
  { id: "FitnessEnthusiast" as const, label: "Fitness Enthusiast", description: "Gym-goer, tracks macros, performance-driven" },
  { id: "BusyMum" as const, label: "Busy Mum", description: "Time-poor, health-conscious, family-focused" },
  { id: "Athlete" as const, label: "Athlete", description: "Competitive, recovery-focused, data-driven" },
  { id: "Biohacker" as const, label: "Biohacker", description: "Ingredient-obsessed, optimisation-focused" },
  { id: "WellnessAdvocate" as const, label: "Wellness Advocate", description: "Holistic health, clean ingredients, mindful" },
] as const;
export type ActorArchetype = typeof ACTOR_ARCHETYPES[number]["id"];

export type StyleConfig = { styleId: ScriptStyleId; quantity: number };

export type Creative = {
  id: string;
  dbId?: number;
  type: "VIDEO" | "STATIC";
  title: string;
  brandName: string;
  thumbnailUrl?: string;
  imageUrl?: string;
  mediaUrl?: string;
  isNew?: boolean;
  summary?: string | null;
  qualityScore?: number | null;
  suggestedConfig?: any | null;
};

/** Cost estimation constants */
export const COST_BASE = 0.35;       // Transcription + analysis + brief
export const COST_PER_SCRIPT = 0.60; // Generation + review
