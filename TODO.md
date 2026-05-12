# HomeMatch — Development Roadmap

**Last updated:** 2026-05-05  
**Current state:** MLS data integrated, match engine live, professional HTML report generating

---

## Completed

- [x] Buyer intake questionnaire (18 questions, EN/ZH)
- [x] Deterministic portrait engine (archetype + weights + insights)
- [x] AI narrative generation (Claude Opus)
- [x] MLS PIN data pipeline (SF, Condo, Multi-Family)
- [x] 3,215 real listings imported (17 towns in Greater Boston)
- [x] Match engine scoring real MLS listings
- [x] Professional HTML buyer report with detailed recommendations
- [x] Agent dashboard (buyer list, search briefs)
- [x] Viewing feedback / evolution log
- [x] Role switching (buyer/agent)
- [x] i18n (English + Chinese)

---

## Tier 1: High Impact (This Week)

- [ ] **Photo carousel in report** — Show 3-5 MLS photos per listing instead of just 1. All photo URLs are already in the database.
- [ ] **Google Maps commute integration** — Calculate real commute times (drive/bike/transit) from each listing to buyer's commute anchors. Replace hardcoded defaults with actual data. API: Google Directions API or Mapbox.
- [ ] **MLS data auto-refresh** — Set up daily automated pull from MLS PIN RETS endpoint. Mark SOLD/WITHDRAWN listings. Currently requires manual file download.
- [ ] **School district data** — Pull real school ratings by address/zip. API: GreatSchools or static dataset. Fills a major scoring gap for family buyers.

---

## Tier 2: Client Experience (Next Week)

- [ ] **Interactive web report** — Convert static HTML report to a Next.js page at `/buyer/report`. Features: expandable listings, "Schedule Viewing" button, like/dislike rating, mobile responsive.
- [ ] **Walk Score integration** — Add walkability/transit scores per listing. Free API. Critical for "Urbanist" archetype scoring.
- [ ] **Side-by-side comparison** — Let buyers select 2-3 listings and compare head-to-head on every dimension.
- [ ] **Agent scoring dashboard** — Quick form for agent to rate soft dimensions (natural light, noise, openness, yard, kitchen quality) per listing after viewings. Improves match accuracy over time.
- [ ] **Report UI in frontend** — Render the portrait + matches directly in the web app (not just CLI/HTML export).

---

## Tier 3: Automation & Intelligence (Week 3)

- [ ] **New listing alerts** — When fresh MLS listings match active buyer profiles at 70%+, auto-notify agent via email/SMS.
- [ ] **Feedback loop → weight adjustment** — When buyer rates a listing (love/hate/meh), automatically adjust their priority weights. System learns over time.
- [ ] **AI-powered listing analysis** — Use Claude to read MLS descriptions and infer soft dimensions (e.g., "sun-drenched" → natural_light: 5, "quiet cul-de-sac" → noise_level: 5).
- [ ] **Email delivery + PDF export** — Auto-email the report to buyers as a PDF after questionnaire. Professional touch.
- [ ] **Geocoding + map view** — Geocode all listings, show on interactive map with match score color coding.

---

## Tier 4: Production & Growth (Month 2)

- [ ] **Deploy to Vercel** — Push app to production with cloud PostgreSQL (Supabase free tier).
- [ ] **Auth system** — Email magic link or Google OAuth so buyers can return to their report.
- [ ] **Rate limiting on AI calls** — Prevent abuse of Claude API endpoints.
- [ ] **Error monitoring** — Sentry or similar for production error tracking.
- [ ] **Landing page** — Marketing site explaining the service for buyer acquisition.
- [ ] **Mobile responsive** — Currently desktop-first; optimize for phone viewing.
- [ ] **Agent onboarding flow** — Self-serve signup for other agents who want to use the system.
- [ ] **Analytics** — Track questionnaire completion rates, drop-off points, report engagement.

---

## Technical Debt

- [ ] Remove `mock-listings.ts` — No longer needed (real data is live)
- [ ] Unit tests for match engine
- [ ] Unit tests for portrait generator
- [ ] Type safety improvements (remove `as any` casts in match engine)
- [ ] Add `mlsNumber` field to Listing schema for dedup tracking
- [ ] Database indexes on `city`, `listPrice`, `bedrooms` for query performance
- [ ] AI JSON parsing error handling (sometimes fails on long responses)

---

## Quick Reference

| What | Command |
|------|---------|
| Import MLS data | `npx tsx scripts/import-mls.ts --agent-id cmop2wajb0000xf82ntq5uf8s --types sf,cc,mf --towns Cambridge,Somerville` |
| Generate HTML report | `npx tsx scripts/generate-html-report.ts` |
| Generate CLI report | `npx tsx scripts/test-real-matches.ts` |
| Run app | `npm run dev` |
| View report | `open reports/buyer-report.html` |

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2025-05-03 | Direct Anthropic API over Bedrock | Simpler auth, no AWS dependency for MVP |
| 2025-05-03 | Opus model for reports | Higher quality narrative output |
| 2025-05-05 | MLS PIN IDX flat files over RETS API | Faster to prototype; RETS for automation later |
| 2025-05-05 | Pre-filter in DB before scoring | Performance: 3000+ listings → only score relevant subset |
| 2025-05-05 | 115% budget flex in queries | Allow slightly over-budget gems to surface |
| 2025-05-05 | Towns-based import filter | Agent controls service area; avoids irrelevant inventory |
