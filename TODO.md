# HomeMatch — Development Roadmap

**Last updated:** 2026-06-30  
**Current state:** Auth + agent-managed workflow live, learning loop closed (killer demo working), P0 security blockers fixed, tests landed. UX/data-quality wave shipped (photos everywhere, identity bug fixed, shared MLS inventory visible, match-scoring honesty, buyer chip-feedback loop). Now heading toward enterprise/brokerage SaaS.

### Shipped 2026-06-30 (UX + data quality wave)
- [x] Fixed dashboard-count-vs-empty-list identity bug (token.id ??= token.sub)
- [x] Property photos render across match cards, listing detail, listings list (graceful placeholders)
- [x] Real listingUrl external links (honest Redfin-search fallback)
- [x] School rating + natural light promoted to Key Facts; "Agent Notes" relabeled MLS description
- [x] Shared MLS inventory now visible to all agents (was empty page)
- [x] Match scoring no longer bluffs confident scores on missing data
- [x] Buyer guided chip-feedback flow feeds the learner (was unparseable free-text)
- [x] Decision points (blindSpots) rendered; deterministic portrait fallback no longer looks broken
- [x] MLS cron data bugs (PCG/EXT status, TOWN_NUM resolution) fixed earlier same day

### Known follow-ups (non-blocking)
- [ ] `victorboyuli@gmail.com` is role BUYER — visit /switch to become AGENT (on allowlist)
- [ ] Multi-tenancy: shared inventory is currently "any AGENT-role user" not a real Brokerage/Org boundary
- [ ] Add scoped Bedrock IAM key to light up AI portrait narrative
- [ ] /switch BUYER path creates a self-managed buyerProfile (minor orphan)
- [ ] Trim/optimize 18-question intake to reduce mid-funnel drop-off

---

## Completed

- [x] Buyer intake questionnaire (18 questions, EN/ZH)
- [x] Deterministic portrait engine (archetype + weights + insights)
- [x] MLS PIN data pipeline (SF, Condo, Multi-Family); ~3,200 real listings, 17 Greater Boston towns
- [x] Match engine scoring real MLS listings
- [x] Professional HTML buyer report with detailed recommendations
- [x] Agent dashboard (buyer list, search briefs)
- [x] Viewing feedback / evolution log
- [x] Role switching (buyer/agent)
- [x] i18n (English + Chinese)
- [x] **Auth** — NextAuth + Google OAuth (Prisma adapter)
- [x] **Agent-managed buyer workflow** — agent creates/manages multiple buyers
- [x] **Public intake links** — signed, expiring HMAC tokens; owner-gated minting
- [x] **Agent observations** — soft-dimension scoring per showing
- [x] **MA school district ratings** integration
- [x] **AI listing style classification** — Sonnet 4.6 on Bedrock → `vector.style_tags`
- [x] **AI buyer portrait** migrated to Sonnet 4.6 on Bedrock
- [x] **Feedback loop → weight adjustment** — Bayesian learner re-weights priority dimensions
- [x] **Learning loop closed** — `/api/matches` ranks with evolved `_preferenceState` weights and
      explains the re-rank (`rankBoost` + `learning` object); visual style scoring wired through;
      budget-drift detection fixed; buyer-side re-rank banner + shift chips + "Moved up N spots"
- [x] **First unit tests** — Vitest suites for Bayesian learner, match engine, affordability, MLS field map

---

## Tier 1: Enterprise Readiness (Now)

- [ ] **Multi-tenancy / Brokerage tenant boundary** — add a `Brokerage` model and enforce the
      tenant boundary on every query. The north star is selling to brokerages; today all data is flat.
- [ ] **Rate-limit the paid-AI + matches routes** — `/api/classify`, `/api/portrait`, `/api/matches`
      are still unthrottled. Reuse `lib/rate-limit.ts` (`rateLimit` + `getClientIp`).
- [ ] **Distributed rate limiter** — current limiter is in-memory (per serverless instance, resets on
      cold start). Move to Upstash/Redis for real per-tenant quotas.
- [ ] **Rotate leaked MLS PIN credentials** — they were committed to git history; env removal does not
      invalidate already-exposed secrets.
- [ ] **Re-validate against ARCC governance** — credential/PII/network-exposure changes shipped without
      ARCC (the `search_arcc` MCP tool was unavailable); re-check when reachable.

---

## Tier 2: Data Correctness & Reliability

- [ ] **Fix MLS `STATUS_MAP` mismatch** — real feed codes are `PCG`/`EXT` but the map only has
      `PCH`/`EXP`, so they fall through to `undefined`. Add `STATUS_MAP['PCG'] = 'ACTIVE'` and
      `STATUS_MAP['EXT']`. Tracked by `it.todo` tests in `lib/mls/field-map.test.ts`.
- [ ] **Fix MLS `TOWN_NUM` / town-name mapping** in `sync-mls` (city is resolved from TOWN/NEIGHBORHOOD
      fields incorrectly) — needs a dedicated data-mapping fix.
- [ ] **MLS data auto-refresh** — daily automated pull; mark SOLD/WITHDRAWN listings.
- [ ] **Shape-validate `_preferenceState`** — the matches route reads it as untrusted JSON; add a
      defensive length/shape guard before `matchListingsEvolved` / `getSignificantChanges`.
- [ ] **Broaden test coverage** — mock-`fetch` test for `fetchCurrentMortgageRate`; cover
      `style-matcher`, `generate-portrait` archetype/blind-spot logic, and pure `feedback/*` modules.
- [ ] **CI** — GitHub Action running `npm run test` on PRs.

---

## Tier 3: Client Experience

- [ ] **Photo carousel in report** — 3-5 MLS photos per listing (URLs already in DB).
- [ ] **Google Maps commute integration** — real drive/bike/transit times from each listing to anchors.
- [ ] **Walk Score integration** — walkability/transit scores per listing.
- [ ] **Side-by-side comparison** — buyers compare 2-3 listings dimension-by-dimension.
- [ ] **Friendlier shift labels** — surface `learning.shifts` / `rankBoost` using the
      `DIMENSION_SHORT_LABELS` map (in match-engine) instead of long dimension names.
- [ ] **New listing alerts** — auto-notify agent when fresh listings hit 70%+ for active buyers.
- [ ] **Email delivery + PDF export** — auto-email the report after the questionnaire.
- [ ] **Geocoding + map view** — geocode listings, show on interactive map with score color coding.

---

## Tier 4: Growth & Polish

- [ ] **Deploy to Vercel** with cloud PostgreSQL.
- [ ] **Broker analytics dashboard** — portfolio-level match/conversion insight for brokerages.
- [ ] **Error monitoring** — Sentry or similar.
- [ ] **Landing page** — marketing site for buyer/brokerage acquisition.
- [ ] **Mobile responsive** — currently desktop-first.
- [ ] **Agent onboarding flow** — self-serve signup for agents.
- [ ] **Analytics** — questionnaire completion, drop-off, report engagement.

---

## Technical Debt

- [ ] Remove dead `lib/scoring/mock-listings.ts` — real data is live
- [ ] Remove dead `BuyerProfile.preferenceWeights` column — superseded by `_preferenceState` JSON
- [ ] Remove unused `@anthropic-ai/sdk` dependency — migrated to Bedrock (`@aws-sdk/client-bedrock-runtime`)
- [ ] Add `rankBoost?: { movedUp: number; reason: string }` to the `MatchResult` interface so the
      local augmentation in `MatchList.tsx` can be dropped
- [ ] Export Bayesian constants (`BASE_LEARNING_RATE`, `MIN_WEIGHT`, `MAX_WEIGHT`, `CONFIDENCE_GROWTH`)
      from `bayesian-learner.ts` so tests assert against the source of truth instead of re-declaring them
- [ ] Database indexes on `city`, `listPrice`, `bedrooms` for query performance
- [ ] Add `mlsNumber` field to `Listing` schema for dedup tracking
- [ ] Type safety — remove `as any` casts in match engine
- [ ] Remove pre-existing dead `router` variable in `app/intake/[profileId]/page.tsx`
- [ ] Revisit `era_feel` handling if buyer intake later adds an explicit `home_era` question
      (currently `skipInV1`, guarded but inactive)

---

## Quick Reference

| What | Command |
|------|---------|
| Run app | `npm run dev` |
| Run tests | `npm run test` (Vitest; needs reachable npm registry to install) |
| Import MLS data | `npx tsx scripts/import-mls.ts --agent-id <id> --types sf,cc,mf --towns Cambridge,Somerville` |
| Generate HTML report | `npx tsx scripts/generate-html-report.ts` |
| Test AI portrait | `npx tsx scripts/test-ai-portrait.ts` |

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2025-05-05 | MLS PIN IDX flat files over RETS API | Faster to prototype; RETS for automation later |
| 2025-05-05 | Pre-filter in DB before scoring | Performance: 3000+ listings → score only relevant subset |
| 2025-05-05 | 115% budget flex in queries | Allow slightly over-budget gems to surface |
| 2025-05-05 | Towns-based import filter | Agent controls service area; avoids irrelevant inventory |
| 2026-06-30 | Learned weights in `_preferenceState` JSON, not `preferenceWeights` | Zero migrations; ship the loop fast |
| 2026-06-30 | Anthropic API → Bedrock (Sonnet 4.6) | Enterprise auth; consistent infra |
| 2026-06-30 | Security via env vars + stateless HMAC + in-memory rate limit | Close P0 blockers with zero schema migrations |
| 2026-06-30 | Vitest test runner | Cheapest pre-enterprise regression coverage |
