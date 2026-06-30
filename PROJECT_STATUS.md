# HomeMatch — Project Status & Launch Tracker

**Last updated:** 2026-06-30  
**Target:** Enterprise-ready — selling the behavior-driven match engine to brokerages

> **Core thesis:** behavior > stated. Buyers can't reliably articulate what they want;
> their showing reactions reveal it. The Bayesian learner treats intake answers as a weak
> prior and showing feedback / agent observations as strong evidence, re-weighting priority
> dimensions over time. Learned weights live in `IntakeResponse.answers._preferenceState`
> (a JSON sub-key), **not** the dead `BuyerProfile.preferenceWeights` column.

---

## Phase 1: Core Engine (COMPLETE)

- [x] Buyer intake questionnaire (18 questions, EN/ZH)
- [x] Deterministic portrait engine (archetype + weights)
- [x] AI narrative generation (consulting tone)
- [x] Match engine (hard filter + weighted scoring)
- [x] Agent dashboard (buyer list, search briefs)
- [x] Viewing feedback / evolution log
- [x] Role switching (buyer/agent)
- [x] i18n (English + Chinese)

---

## Phase 2: Real Data & Intelligence (COMPLETE)

- [x] MLS PIN data pipeline (SF, Condo, Multi-Family); ~3,200 real listings, Greater Boston
- [x] Match engine scoring real MLS listings
- [x] MA school district ratings integration
- [x] Real-time mortgage rate integration (live fetch in affordability calc)
- [x] AI listing style classification (Sonnet 4.6 on Bedrock → `vector.style_tags`)
- [x] AI buyer portrait generation migrated to Sonnet 4.6 on Bedrock

---

## Phase 3: The Learning Loop (COMPLETE — killer demo)

- [x] Bayesian learner: intake = weak prior, showing feedback/observations = strong evidence
- [x] `/api/matches` ranks with evolved `_preferenceState` weights once showing evidence exists
- [x] Re-rank explanation: diff vs static intake ranking → `rankBoost` (positions climbed +
      plain-language reason naming the dimensions whose weight rose)
- [x] API carries `learning` object (active / evidenceCount / summary / top-3 shifts vs prior)
- [x] Visual style scoring wired end to end (listing `style_tags` copied into match dims;
      buyer style ids normalized to the taxonomy, e.g. `cape` → `cape_cod`)
- [x] Budget-drift detection fixed (`listPrice` threaded through `FeedbackHistory`)
- [x] Buyer-side demo: MatchList learning banner + ↑/↓ shift chips + per-card "Moved up N spots"
- [x] Buyer-side visual home-style preference grid (PortraitCard)
- All learning lands with **zero schema migrations** (state stored in `_preferenceState` JSON)

---

## Phase 4: Multi-Buyer & Agent Workflow (COMPLETE)

- [x] Agent-managed buyer workflow — agent creates/manages multiple buyers
- [x] Public intake links — signed, expiring HMAC tokens (no profile-id enumeration)
- [x] Agent observations per showing (soft-dimension scoring)
- [x] Agents route to `/agent` even if they hold a buyerProfile record

---

## Phase 5: Production Infrastructure (PARTIAL)

- [x] Auth system — NextAuth + Google OAuth (Prisma adapter; `User`/`Account`/`Session`)
- [x] Role escalation locked down — only `AGENT_ALLOWLIST` emails can become agents
      (BUYER stays self-serve; fail-closed when allowlist empty)
- [x] MLS sync cron secured — fails closed (500) without env creds or `CRON_SECRET`;
      leaked MLS PIN credentials removed from source
- [x] IP rate limiting (`lib/rate-limit.ts`) on public intake routes + MLS sync cron
- [ ] Rate limiting on paid-AI / matches routes (`/api/classify`, `/api/portrait`, `/api/matches`)
- [ ] Deploy to Vercel (or AWS) with cloud PostgreSQL
- [ ] Error monitoring (Sentry)
- [ ] Analytics (questionnaire completion, drop-off)

---

## Phase 6: Enterprise / Brokerage SaaS (NOT STARTED — north star)

- [ ] Multi-tenancy — `Brokerage` tenant model + tenant-boundary enforcement on every query
- [ ] Broker analytics dashboard (portfolio-level match/conversion insight)
- [ ] Distributed rate limiting (Upstash/Redis) for real per-tenant quotas
- [ ] DB indexes (`city`, `listPrice`, `bedrooms`) for query performance at scale
- [ ] Landing page / marketing site
- [ ] Agent self-serve onboarding flow

---

## Known Issues / Tech Debt

- [ ] Paid-AI and `/api/matches` routes still unthrottled — reuse `lib/rate-limit.ts`
- [ ] In-memory rate limiter is per serverless instance, resets on cold start — needs a
      distributed store for enterprise quotas
- [ ] MLS `TOWN_NUM` / town-name mapping bug in `sync-mls` (city resolved from TOWN/NEIGHBORHOOD)
- [ ] `STATUS_MAP` mismatch — real feed codes are `PCG`/`EXT`, map only has `PCH`/`EXP`
      (both fall through to `undefined`); tracked by `it.todo` tests in `field-map.test.ts`
- [ ] Dead `BuyerProfile.preferenceWeights` column — superseded by `_preferenceState` JSON
- [ ] Dead `lib/scoring/mock-listings.ts` — real data is live
- [ ] No `mlsNumber` field on `Listing` for dedup tracking
- [ ] `matchListings` MatchResult type does not declare `rankBoost` (augmented locally in MatchList.tsx)
- [ ] `_preferenceState` is read as untrusted JSON without shape validation in the matches route
- [ ] `@anthropic-ai/sdk` dependency now unused (migrated to Bedrock) — harmless dead weight
- [ ] Rotate previously-committed MLS PIN credentials (in git history; env removal does not
      invalidate already-exposed secrets)
- [ ] ARCC governance not consulted this round (`search_arcc` MCP unavailable) — re-validate
      credential/PII/network-exposure changes when reachable

---

## Quick Reference

| What | Where |
|------|-------|
| App URL (local) | http://localhost:3000 |
| GitHub | https://github.com/victorliking/cz |
| AI Model | Claude Sonnet 4.6 on Bedrock (`anthropic.claude-sonnet-4-6`) |
| DB | SQLite (local) → PostgreSQL (prod) |
| Framework | Next.js 14 + Prisma + Tailwind + NextAuth |
| Run tests | `npm run test` (Vitest) |
| Test AI portrait | `npx tsx scripts/test-ai-portrait.ts` |

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2025-05-03 | Report tone: consulting, not sales | User feedback — neutral, data-driven |
| 2025-05-03 | "Blind spots" → "Decision points" | Avoid blame; offer actionable options |
| 2025-05-03 | Archetype = tag, not hero section | Keep focus on data analysis |
| 2026-06-30 | AI moved Anthropic API → Bedrock (Sonnet 4.6) | Enterprise-grade auth; consistent infra |
| 2026-06-30 | Learned weights in `_preferenceState` JSON, not `preferenceWeights` col | Zero migrations; ship the loop fast |
| 2026-06-30 | Security via env vars + stateless HMAC + in-memory rate limit | Close P0 blockers with zero schema migrations |
| 2026-06-30 | Vitest as test runner | Cheapest pre-enterprise regression coverage on pure functions |
