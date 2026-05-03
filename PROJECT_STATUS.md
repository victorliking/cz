# HomeMatch — Project Status & Launch Tracker

**Last updated:** 2025-05-03  
**Target:** MVP launch ready for first real buyer

---

## Phase 1: Core Engine (COMPLETE)

- [x] Buyer intake questionnaire (18 questions, EN/ZH)
- [x] Deterministic portrait engine (archetype + weights)
- [x] AI narrative generation (Claude Opus, consulting tone)
- [x] Match engine (hard filter + weighted scoring)
- [x] 6 mock listings for demo
- [x] Agent dashboard (buyer list, search briefs)
- [x] Viewing feedback / evolution log
- [x] Role switching (buyer/agent)
- [x] i18n (English + Chinese)

---

## Phase 2: Report Quality & UX (IN PROGRESS)

- [x] Neutral consulting tone (no sales language)
- [x] Decision points with A/B/C options (not blame)
- [x] Priority dimensions with "适配房源定义"
- [x] Buyer archetype as tag (not hero)
- [ ] Report UI component — render the full report as designed in the frontend
- [ ] Decision point interactivity — buyer can select A/B/C, system updates weights
- [ ] PDF/share export of report

---

## Phase 3: Real Data Integration

- [ ] MLS/real listing data source (Zillow API, MLS IDX, or manual entry)
- [ ] Geocoding + commute time calculation (Google Maps / Mapbox API)
- [ ] School district data integration (GreatSchools API or static dataset)
- [ ] Walk Score / noise level data
- [ ] Real-time mortgage rate integration (already stubbed)

---

## Phase 4: Multi-Buyer & Agent Workflow

- [ ] Agent can manage multiple buyers simultaneously
- [ ] Agent adds listings and system auto-matches to all buyers
- [ ] Buyer comparison view (side-by-side house comparison)
- [ ] Shared viewing calendar
- [ ] Agent notes per buyer per showing

---

## Phase 5: Production Infrastructure

- [ ] Deploy to Vercel (or AWS)
- [ ] PostgreSQL on cloud (Supabase / RDS)
- [ ] Auth system (email magic link or OAuth)
- [ ] Rate limiting on AI calls
- [ ] Error monitoring (Sentry)
- [ ] Analytics (who finishes questionnaire, drop-off points)

---

## Phase 6: Growth & Polish

- [ ] Landing page / marketing site
- [ ] Mobile responsive (currently desktop-first)
- [ ] Email notifications (new match, report ready)
- [ ] Buyer can re-take questionnaire / update preferences
- [ ] A/B test different questionnaire flows
- [ ] Agent onboarding flow
- [ ] Testimonials / social proof

---

## Known Issues / Tech Debt

- [ ] AI JSON parsing sometimes fails on long responses (workaround in place)
- [ ] Mock listings are hardcoded — need real data pipeline
- [ ] No auth — cookie-based user switching only
- [ ] Opus model deprecated warning (still works, need to update when new model available)
- [ ] No unit tests

---

## Quick Reference

| What | Where |
|------|-------|
| App URL (local) | http://localhost:3000 |
| GitHub | https://github.com/victorliking/cz |
| AI Model | claude-opus-4-20250514 |
| DB | SQLite (local) → PostgreSQL (prod) |
| Framework | Next.js 14 + Prisma + Tailwind |
| Test script | `npx tsx scripts/test-ai-portrait.ts` |

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2025-05-03 | Switched from Bedrock to direct Anthropic API | Simpler auth, no AWS dependency for MVP |
| 2025-05-03 | Upgraded Sonnet → Opus | Higher quality report output |
| 2025-05-03 | Report tone: consulting, not sales | User feedback — neutral, data-driven |
| 2025-05-03 | "Blind spots" → "Decision points" | Avoid blame; offer actionable options instead |
| 2025-05-03 | Archetype = tag, not hero section | Keep focus on data analysis |
