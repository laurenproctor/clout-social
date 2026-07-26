# Clout — Architecture & Development Guidelines

## Project Overview
Clout is an AI-driven trend intelligence and automated social publishing platform for brands and creators.
It converts real-time global news volume and sentiment (via GDELT) into Opportunity Scores, crafts platform-optimized content hooks, and distributes posts across 15+ networks using the Zernio API.

## Core Tech Stack
- **Framework:** Next.js 15 (App Router, TypeScript, React Server Components)
- **Styling:** Tailwind CSS, Lucide Icons, Framer Motion
- **UI Components:** Radix UI / Shadcn UI primitives
- **Trend Intelligence:** GDELT DOC 2.0 API
- **Multi-Channel Publishing:** Zernio API (`https://zernio.com/api/v1`)
- **AI Generation:** Anthropic Claude SDK (`@anthropic-ai/sdk`)

## Core Commands
- `npm run dev`: Launch local development server
- `npm run build`: Type-check and build production bundle
- `npm run lint`: Execute ESLint checks
- `npx tsc --noEmit`: Run full TypeScript validation

## UI/UX Rules & Data Mapping
1. **Theme:** Premium B2B SaaS dark/light UI with Mint Green (`#10B981`) primary accents and Slate backgrounds.
2. **Heatmap Rules:**
   - **Tile Size** = Global Attention / News Volume Share.
   - **Tile Color** = Lifecycle Stage (`emerging` = Mint Green, `rising` = Light Green, `peaking` = Gold/Yellow, `declining` = Orange).
   - **Sentiment Tone:** GDELT sentiment (-10 to +10) MUST be displayed as a numeric badge/gauge, NEVER as the tile background color.
3. **Detail Modal (Dual-Zone Design):**
   - **Left Zone (Strategic Why):** Displays GDELT metrics, *Why it moves*, *Why it matters*, and *Strategic Whitespace*.
   - **Right Zone (Channel Creation):** Platform tabs (`LinkedIn`, `TikTok`, `Instagram`, `YouTube`, `Blog`), AI-generated hooks, post previews, and direct Zernio publish controls.

## Zernio API Rules
- Use `ZERNIO_API_KEY` for header authorization (`Authorization: Bearer <KEY>`).
- Endpoint target: `POST /api/v1/posts` for single or multi-channel distribution.
- Always support immediate publishing and scheduled posting via `scheduledAt` (ISO 8601).
- Validate character limits per platform before calling the publish endpoint.
