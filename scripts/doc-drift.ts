/**
 * Doc Drift Auto-Sync
 *
 * Reads every docs/*.md, parses the "Code pointers" section to find which
 * source files each doc references, cross-references against files touched
 * in the current PR (vs origin/<base>), and asks Claude to update each
 * affected doc to reflect the code changes.
 *
 * Writes updated docs back to disk; the GitHub Action commits + pushes.
 *
 * Run via: pnpm tsx scripts/doc-drift.ts
 *
 * Required env:
 *   ANTHROPIC_API_KEY — Claude API key
 *   BASE_REF          — base branch name (e.g. "main"), defaults to "main"
 *   PR_NUMBER         — PR number for log context (optional)
 *
 * Design choices:
 *   - Two-call pattern: first ask "is this diff relevant to this doc?"
 *     before paying for a full rewrite. Saves ~80% of Claude calls in the
 *     common case where most PRs touch one area of the system.
 *   - Soft validation on the rewritten doc (must still have key headings
 *     and "Code pointers" section). Bail if Claude returns garbage.
 *   - One Claude call per doc, sequential. Throughput isn't the constraint.
 */

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import axios from "axios";

const DOCS_DIR = "docs";
const BASE_REF = process.env.BASE_REF ?? "main";
const PR_NUMBER = process.env.PR_NUMBER ?? "?";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const CLAUDE_MODEL = "claude-sonnet-4-20250514";

if (!ANTHROPIC_API_KEY) {
  console.error("[doc-drift] ANTHROPIC_API_KEY not set, skipping.");
  process.exit(0);
}

// ─────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────

function sh(cmd: string): string {
  return execSync(cmd, { encoding: "utf-8" }).trim();
}

function changedFiles(): string[] {
  // Files changed in this PR vs base branch. We use ...HEAD so we get
  // only what the PR adds, not unrelated commits on main.
  const out = sh(`git diff --name-only origin/${BASE_REF}...HEAD`);
  return out.split("\n").filter(Boolean);
}

function fileDiff(path: string): string {
  // Diff for a specific file. Cap at 8000 chars to avoid blowing up the
  // Claude context — most file changes fit easily; massive refactors get
  // truncated with a note so the model doesn't try to digest 50KB of diff.
  try {
    const out = sh(`git diff origin/${BASE_REF}...HEAD -- ${JSON.stringify(path)}`);
    if (out.length > 8000) {
      return out.slice(0, 8000) + "\n\n[... diff truncated, " + (out.length - 8000) + " more chars ...]";
    }
    return out;
  } catch {
    return "(no diff available)";
  }
}

// Parse the "Code pointers" section of a doc to extract file paths it
// references. Pointers are written as markdown links like
// `[server/services/foo.ts](../server/services/foo.ts)` — we pull the
// path from the link target and normalise (strip leading `../`).
function pointersIn(docContent: string): string[] {
  const codePointersIdx = docContent.indexOf("## Code pointers");
  if (codePointersIdx === -1) return [];
  const section = docContent.slice(codePointersIdx);
  const linkRe = /\]\((\.\.\/)?([^)]+)\)/g;
  const paths = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(section)) !== null) {
    const path = m[2].split("#")[0].trim();
    if (path && !path.startsWith("http") && (path.endsWith(".ts") || path.endsWith(".tsx") || path.endsWith(".js") || path.endsWith(".jsx") || path.endsWith(".sql"))) {
      paths.add(path);
    }
  }
  return [...paths];
}

function listDocs(): { path: string; content: string }[] {
  return readdirSync(DOCS_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      const path = join(DOCS_DIR, f);
      return { path, content: readFileSync(path, "utf-8") };
    });
}

// ─────────────────────────────────────────────────────────────────────
// Claude API
// ─────────────────────────────────────────────────────────────────────

async function callClaude(system: string, user: string, maxTokens = 4096): Promise<string> {
  const res = await axios.post(
    "https://api.anthropic.com/v1/messages",
    {
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
    },
    {
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      timeout: 120_000,
    },
  );
  const content = res.data?.content;
  return Array.isArray(content)
    ? content.map((c: any) => c.text || "").join("")
    : (content?.text ?? "");
}

// Cheap relevance check before paying for a full rewrite. Returns "yes"
// if the diff actually changes behaviour the doc describes, "no" otherwise.
async function isRelevant(docPath: string, doc: string, diffs: { file: string; diff: string }[]): Promise<boolean> {
  const system = `You are a doc-drift detector for a software project. You decide whether a code diff requires updating a reference doc.

Return ONLY "yes" or "no" with no other text. "yes" means the diff changes behaviour the doc describes (e.g., new rule, changed text, removed feature). "no" means the diff is unrelated polish, internal refactor, comment-only change, or otherwise doesn't affect what the doc says.`;
  const user = `DOC (${docPath}):
\`\`\`markdown
${doc.slice(0, 8000)}
\`\`\`

DIFFS (files this doc references that changed in this PR):
${diffs.map(({ file, diff }) => `--- ${file} ---\n${diff}`).join("\n\n")}

Does the doc need updating to reflect these changes? Answer "yes" or "no".`;
  const reply = await callClaude(system, user, 16);
  return /^\s*yes/i.test(reply);
}

async function rewriteDoc(docPath: string, doc: string, diffs: { file: string; diff: string }[]): Promise<string | null> {
  const system = `You are a careful technical doc maintainer. You update a reference doc to reflect a code diff. The doc is the canonical reference for users — accuracy is critical, drift is unacceptable.

Rules:
1. Output ONLY the updated doc as markdown. No preamble, no commentary, no code fences around the whole output.
2. Preserve the doc's existing structure (H1, H2 headings, table format, "Code pointers" section, "History" section if present).
3. Only change content that the diff actually changes. Do NOT rewrite, rephrase, or "improve" sections that are unaffected by the diff.
4. If the diff adds new behaviour the doc didn't describe, add a new entry in the appropriate section.
5. If the diff changes existing rule wording, update the doc to match the NEW wording exactly. Mirror code wording verbatim — don't paraphrase.
6. If the doc has a "## History" section, append a new bullet describing this change with the PR-level effect (not a code-level diff summary).
7. Update line numbers / symbol names in "Code pointers" if they shifted.
8. If you're unsure whether something needs updating, leave it alone. Conservatism beats hallucination.`;
  const user = `Current doc (${docPath}):
\`\`\`markdown
${doc}
\`\`\`

Diffs of files this doc references:
${diffs.map(({ file, diff }) => `--- ${file} ---\n${diff}`).join("\n\n")}

Output the full updated doc as markdown. Do not include any wrapper code fences or commentary.`;
  const updated = await callClaude(system, user, 8192);
  if (!validateUpdated(doc, updated)) {
    console.warn(`[doc-drift] Rewrite of ${docPath} failed validation, skipping.`);
    return null;
  }
  return updated;
}

// Sanity checks on the rewritten doc. Bail if Claude returned something
// catastrophically wrong (truncated, empty, missing key sections, way
// shorter than original). Better to skip a sync than commit garbage.
function validateUpdated(original: string, updated: string): boolean {
  if (!updated || updated.length < 100) return false;
  if (updated.length < original.length * 0.5) return false;
  // Must still have at least one H1 and one H2.
  if (!/^# /m.test(updated)) return false;
  if (!/^## /m.test(updated)) return false;
  // If original had Code pointers section, updated must too.
  if (original.includes("## Code pointers") && !updated.includes("## Code pointers")) return false;
  return true;
}

// ─────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`[doc-drift] PR #${PR_NUMBER} — checking for doc drift vs origin/${BASE_REF}`);

  const changed = changedFiles();
  console.log(`[doc-drift] Changed files (${changed.length}):`, changed);

  // Skip if PR didn't touch any source files (just docs / config / etc.)
  const sourceFiles = changed.filter((f) => /\.(ts|tsx|js|jsx|sql)$/.test(f) && !f.startsWith("docs/") && !f.startsWith("scripts/doc-drift"));
  if (sourceFiles.length === 0) {
    console.log("[doc-drift] No source files changed, exiting.");
    return;
  }

  const docs = listDocs();
  console.log(`[doc-drift] Found ${docs.length} doc(s) in ${DOCS_DIR}/`);

  for (const doc of docs) {
    const pointers = pointersIn(doc.content);
    if (pointers.length === 0) continue;

    // Find which of this doc's pointers are in the PR's changed files.
    const hits = pointers.filter((p) => sourceFiles.some((f) => f === p || f.endsWith("/" + p) || p.endsWith("/" + f)));
    if (hits.length === 0) continue;

    console.log(`[doc-drift] ${doc.path} references ${hits.length} changed file(s):`, hits);

    const diffs = hits.map((file) => ({ file, diff: fileDiff(file) }));

    // Cheap relevance check before paying for a rewrite.
    const relevant = await isRelevant(doc.path, doc.content, diffs);
    if (!relevant) {
      console.log(`[doc-drift] ${doc.path} — Claude says diff is not behaviour-changing, skipping.`);
      continue;
    }

    console.log(`[doc-drift] ${doc.path} — rewriting...`);
    const updated = await rewriteDoc(doc.path, doc.content, diffs);
    if (!updated) {
      console.warn(`[doc-drift] ${doc.path} — rewrite failed, leaving unchanged.`);
      continue;
    }
    if (updated.trim() === doc.content.trim()) {
      console.log(`[doc-drift] ${doc.path} — Claude returned identical content, skipping.`);
      continue;
    }
    writeFileSync(doc.path, updated);
    console.log(`[doc-drift] ${doc.path} — updated.`);
  }

  console.log("[doc-drift] Done.");
}

main().catch((err) => {
  console.error("[doc-drift] Fatal error:", err?.message || err);
  // Exit 0 so the workflow doesn't fail PRs over doc-sync hiccups —
  // a missed sync is annoying, a blocked PR is worse.
  process.exit(0);
});
