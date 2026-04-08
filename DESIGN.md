# Design System — PerformCreative

Source of truth for all visual decisions. Every new UI must conform to this. Existing drift (e.g., `#191B1F` cards in Dashboard vs `#0D0F12` in PeopleLibrary) is documented in the Drift section and should be migrated incrementally.

## Product Context
- **What this is:** ONEST Creative Pipeline — an internal AI-powered ad creative tool for generating, testing, and varying performance ad creatives at scale. Integrates with Foreplay, Meta Ads, Gemini, ClickUp.
- **Who it's for:** Ryan (founder) and the ONEST creative/ops team. Internal workspace tool, not a public SaaS.
- **Space/industry:** Performance marketing, AI ad creative, ad ops.
- **Project type:** Internal dashboard / workspace app (dark-native utility, not marketing site).

## Visual Thesis
A dark, dense workspace that gets out of the way. Type and data do the work. No decoration. Feels like Linear merged with a Bloomberg terminal, adapted for ad creative. The tool respects your time.

## Aesthetic Direction
- **Direction:** Brutally minimal, dark-native, utility-first
- **Decoration level:** Minimal — no textures, no blobs, no gradients, no background patterns. Borders do the hierarchy work. Only "decoration" is functional (status dots, spinners, progress bars).
- **Mood:** Fast, professional, confident. Feels like engineering-grade tooling.
- **Reference tools:** Linear, Vercel dashboard, Raycast, Bloomberg terminal (spiritually)

## Typography

Fonts are loaded from Google Fonts via `<link>` tags in `client/index.html`.

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet" />
```

- **Display/Headings:** Geist (500, 600)
- **Body/UI:** Geist (400, 500)
- **Data/Numbers:** Geist Mono (400, 500) with `font-variant-numeric: tabular-nums`
- **Code:** Geist Mono

**Why Geist:** Vercel's typeface, built for dark UIs, reads fast, free/open source, has tabular figures, not overused like Inter. Pairs naturally with Geist Mono for data tables, prompts, and code.

**Fonts blacklisted for this project:** Inter, Roboto, Arial, Helvetica, Open Sans, Poppins, Montserrat (too generic, AI-slop signal).

### Scale (Perfect Fourth 1.333, rounded)

| Token | px | rem | Use |
|-------|-----|-----|-----|
| xs | 11 | 0.6875 | Captions, badges, helper text |
| sm | 13 | 0.8125 | Body small, secondary text |
| **base** | **14** | **0.875** | **Default body (dense UI default)** |
| lg | 16 | 1 | Emphasis, large inputs |
| xl | 20 | 1.25 | h3, subsection headers |
| 2xl | 24 | 1.5 | h2, card titles |
| 3xl | 32 | 2 | h1, page titles |

**Note:** `base = 14px`, not the typical 16px. This is intentional — utility dashboards are denser. Linear, Notion, Vercel all use 14px. If a user has vision needs they can zoom.

### Font weights
- 400 — body, data
- 500 — emphasis, labels, buttons
- 600 — headings, strong labels
- 700 — page titles only

## Color

All colors defined as CSS custom properties in `client/src/index.css`. Update there, not inline.

### Background layers (dark-native)

| Token | Hex | Use |
|-------|-----|-----|
| `--bg-page` | `#0A0B0D` | Page background (near-black, warm) |
| `--bg-surface` | `#15171B` | Cards, modals, panels |
| `--bg-surface-elevated` | `#1E2126` | Hover states, selected rows, elevated surfaces |
| `--bg-input` | `#0A0B0D` | Form inputs (matches page — inset feel) |

### Borders

| Token | Value | Use |
|-------|-------|-----|
| `--border-subtle` | `rgba(255,255,255,0.06)` | Card-on-card, subtle dividers |
| `--border-default` | `rgba(255,255,255,0.10)` | Cards, inputs, buttons |
| `--border-strong` | `rgba(255,255,255,0.16)` | Hover states, emphasized borders |

### Text

| Token | Hex | Use |
|-------|-----|-----|
| `--text-primary` | `#FAFAFA` | Headings, primary body |
| `--text-secondary` | `#A1A1AA` | Secondary body, labels |
| `--text-tertiary` | `#71717A` | Helper text, metadata |
| `--text-disabled` | `#52525B` | Disabled states |

### Accent

| Token | Hex | Use |
|-------|-----|-----|
| `--accent` | `#FF3838` | Primary CTAs, selected state, brand accent (ONEST red) |
| `--accent-muted-bg` | `rgba(255,56,56,0.10)` | Soft-selected backgrounds |
| `--accent-muted-border` | `#FF3838` | Soft-selected borders |
| `--accent-hover` | `#FF5555` | Accent hover state |

**There is exactly ONE accent color.** Do not introduce blues, purples, or greens as brand accents. Use semantic colors below for meaning (success/error/warning/info), not decoration.

### Semantic

| Token | Hex | Use |
|-------|-----|-----|
| `--success` | `#10B981` | Success states, completed runs |
| `--warning` | `#F59E0B` | Warning states, pending, attention |
| `--error` | `#EF4444` | Error states, failed runs, destructive actions |
| `--info` | `#3B82F6` | Informational, in-progress states |

### Data visualization (charts)

Use muted saturations for chart series. Primary: emerald `#10B981`. Secondary: amber `#F59E0B`. Tertiary: blue `#3B82F6`. Quaternary: violet `#8B5CF6`. Grid lines: `rgba(255,255,255,0.06)`.

## Spacing

Base unit: **4px**. Scale (tailwind-compatible):

| Token | px | Use |
|-------|-----|-----|
| 0 | 0 | — |
| 1 | 4 | Tightest inline spacing |
| 2 | 8 | Inline groups, badge padding |
| 3 | 12 | Button padding, small gaps |
| 4 | 16 | Default gaps, card padding small |
| 5 | 20 | Medium gaps |
| 6 | 24 | Card padding default, section gaps |
| 8 | 32 | Section spacing |
| 10 | 40 | Large section spacing |
| 12 | 48 | Page section spacing |
| 16 | 64 | Top-level page padding |

**Density:** compact-to-comfortable. Default card padding: `p-6`. Page padding: `p-6`. Form field spacing: `space-y-4`.

## Border Radius

| Token | px | Use |
|-------|-----|-----|
| sm | 4 | Buttons, inputs, badges, pills |
| md | 8 | Inner cards, nested elements |
| lg | 12 | Main cards, panels |
| xl | 16 | Modals, major sidepanels |
| full | 9999 | Avatars, dot indicators, chip/tag pills |

**Rule:** `rounded-2xl` (16px) is reserved for modals and major panels only. Do not use for inline form cards (current drift). Inline cards use `rounded-lg` (12px).

## Layout

- **Approach:** Grid-disciplined. Strict 4px base unit. Left sidebar nav (fixed), main workspace, occasional right context panel.
- **Max content width:** 1440px for content-heavy pages, full-width for data tables
- **Breakpoints:** `sm` 640px, `md` 768px, `lg` 1024px, `xl` 1280px, `2xl` 1536px
- **Grid:** 12-column for content regions; flex for toolbars and nav

## Motion

- **Approach:** Minimal-functional. Only transitions that aid comprehension. No decorative animation.
- **Duration:** micro 100ms | short 150ms (default) | medium 250ms | long 400ms (rare)
- **Easing:** `ease-out` for enter/appear, `ease-in` for exit/dismiss, `ease-in-out` for position change
- **Hover states:** 150ms `ease-out`
- **Modal open:** 250ms `ease-out`
- **No:** scroll-driven animation, parallax, bounce easing, spring physics, decorative entrance animation

## Components (conventions)

### Buttons
- **Primary:** `bg-[#FF3838] hover:bg-[#FF5555] text-white rounded-sm px-4 py-2 text-sm font-medium`
- **Secondary:** `bg-[var(--bg-surface-elevated)] hover:bg-[rgba(255,255,255,0.10)] text-white border border-[var(--border-default)] rounded-sm px-4 py-2 text-sm font-medium`
- **Ghost:** `text-[var(--text-secondary)] hover:text-white hover:bg-[rgba(255,255,255,0.05)] rounded-sm px-3 py-2 text-sm`
- **Destructive:** `bg-transparent hover:bg-[#EF4444]/10 text-[#EF4444] border border-[#EF4444]/30 rounded-sm px-4 py-2 text-sm`
- **No gradient buttons.** The current purple→pink generate button in PeopleLibrary.tsx is drift — migrate to primary (`#FF3838`).

### Cards
- Background: `bg-[var(--bg-surface)]`
- Border: `border border-[var(--border-subtle)]`
- Radius: `rounded-lg` (12px) for main cards, `rounded-md` (8px) for nested
- Padding: `p-6` default

### Inputs
- Background: `bg-[var(--bg-input)]`
- Border: `border border-[var(--border-default)]`
- Radius: `rounded-sm` (4px)
- Padding: `px-3 py-2`
- Text: `text-sm text-white placeholder:text-[var(--text-tertiary)]`
- Focus: `focus:border-[#FF3838] focus:outline-none`

### Badges / Pills
- Shape: `rounded-full`
- Size: `px-2.5 py-0.5 text-xs font-medium`
- Neutral: `bg-[rgba(255,255,255,0.05)] text-[var(--text-secondary)]`
- Accent: `bg-[rgba(255,56,56,0.10)] text-[#FF3838] border border-[#FF3838]/30`

### Data Display
- **All numeric values use `font-mono tabular-nums`** — counts, IDs, metrics, timestamps, durations, currency
- Table rows: alternating is optional — if used, `odd:bg-[rgba(255,255,255,0.02)]`
- Empty states: icon + heading + 1 sentence description + primary CTA (always warm, never just "No results")

## Accessibility
- Minimum touch target: 44px × 44px on mobile
- Focus rings: visible `focus:ring-2 focus:ring-[#FF3838] focus:ring-offset-2 focus:ring-offset-[var(--bg-page)]`
- Contrast: all body text must meet WCAG AA against its background
- Modals: ESC to close, focus trap, return focus on close (handled by Shadcn Dialog)
- Keyboard: all interactive elements reachable via Tab, logical order

## Drift to Migrate (existing inconsistencies)

These are known divergences from this design system. They should be migrated incrementally, not in a single refactor.

1. **Dashboard.tsx** uses `bg-[#191B1F]` for cards — should be `bg-[var(--bg-surface)]` (`#15171B`)
2. **PeopleLibrary.tsx** uses `bg-[#0D0F12]` for cards and `bg-[#01040A]` for page — should be `bg-[var(--bg-surface)]` (`#15171B`) and `bg-[var(--bg-page)]` (`#0A0B0D`)
3. **PeopleLibrary.tsx** generate button uses `bg-gradient-to-r from-purple-500 to-pink-500` — should be `bg-[#FF3838]`
4. **No custom fonts loaded** — `client/index.html` has commented-out Inter. Replace with Geist + Geist Mono (see Typography section for the link tags)
5. **Inline form cards use `rounded-2xl` (16px)** — should be `rounded-lg` (12px). Reserve `rounded-2xl` for modals and major panels.
6. **OKLCH color variables in `index.css`** — already well-structured but don't match this DESIGN.md hex values exactly. Align `--background`, `--card`, etc. to the values above.

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-09 | Initial design system created via `/design-consultation` | Project had drift across pages. Captured source of truth: dark utility dashboard, Geist font, 14px base, flat surfaces, one accent. |
