# HomeMatch — Buyer Self-Discovery Platform

> **Cline, read this entire document before starting.** Then begin Milestone 0. Ask clarifying questions when ambiguous. Do not skip ahead.

---

## 1. What we're building

A web app that helps homebuyers **discover what kind of home actually fits them** through a guided questionnaire and structured feedback after each home tour. Most first-time buyers don't know what they want — they say one thing, react to another. This system surfaces those mismatches and helps them converge on real preferences.

Two roles:
- **Agent** (the product owner, "me"): enters listings, schedules showings, reviews buyer profiles, generates recommendations.
- **Buyer**: completes intake, views recommended listings, gives post-showing feedback, sees their evolving Self Portrait.

**Scope:** v1 is for self-use by a single agent (me) with 1-3 invited buyers. Not multi-tenant. Not public. Not polished for sale.

---

## 2. Why this exists (the differentiation)

Buyers can already chat with ChatGPT about what they want. **This system must be obviously better than that, or it has no reason to exist.** The differentiation:

| Source of edge | Why ChatGPT can't match it |
|---|---|
| Behavioral data — reactions to real listings | ChatGPT can only hear what users *say*, not see what they *do* |
| Real listings as stimuli | ChatGPT chats abstractly; we let buyers react to concrete homes |
| Forced comparative judgment (A vs B) | ChatGPT can't make buyers choose between real options |
| Agent's expert observations | An embodied human watching reactions catches signal a chatbot cannot |
| Time-series evolution | ChatGPT is stateless; we track how preferences shift over weeks |
| Multi-source triangulation | We combine 7 signal types, weighted by reliability |

**Every feature must reinforce at least one of these.** If a feature could be replicated by a generic chatbot, it's table stakes — not the point.

---

## 3. Core product principles (apply to every UI/code decision)

1. **Buyer is the primary user.** Agent dashboard exists to support buyer self-discovery, not the other way around.
2. **Behavior > stated preference.** When stated and revealed conflict, surface the conflict. Never silently average.
3. **Mobile-first for buyer flows.** Every buyer page must work flawlessly at 375px width.
4. **Confidence-aware always.** Never claim certainty the data doesn't support. Show "high confidence" vs. "still learning" honestly.
5. **Transparency over magic.** Every system insight has a "Why we know this" expandable showing evidence.
6. **Speed of feedback is sacred.** Post-showing feedback completes in <90s. Anything slower kills the data flywheel.
7. **Self-discovery is invitation, not declaration.** Insights are framed as "we noticed something interesting — what do you think?" Never "you said X but actually Y." Buyers must always be able to override.
8. **Agent stays in the loop.** System proposes, agent reviews. No autonomous buyer communications.

---

## 4. The 7 signal sources (CRITICAL — the scoring math depends on this hierarchy)

Every piece of preference data has a **signal strength**. The scorer must respect this. Do NOT treat all feedback equally.

| # | Source | Signal strength | Notes |
|---|---|---|---|
| 1 | Intake stated preference (sliders, free text) | **0.1** | Self-report is unreliable |
| 2 | Forced ranking (intake Q7) | **0.3** | Trade-off forces some honesty |
| 3 | Scenario answers (intake Q8-Q10), pain points | **0.4** | Indirect probes; pain points especially high |
| 4 | Post-showing chip selection | **0.7** | Active reaction to specific listing |
| 5 | Comparative judgment (A vs B) | **0.8** | Forced choice between concrete options |
| 6 | Agent structured observation | **0.9** | Expert + embodied + present at moment |
| 7 | Pure behavior (revisit, budget stretch) | **1.0** | Action without filter |

This hierarchy is the soul of the product. Memorize it.

---

## 5. Tech stack (do not deviate)

- Next.js 14+ (App Router, TypeScript)
- PostgreSQL via Prisma ORM
- Tailwind CSS + shadcn/ui (use shadcn primitives, don't build basic components)
- React Hook Form + Zod for forms/validation
- Hosted on Render (Web Service + Render Postgres)
- Auth for v1: simple `?as=user_id` URL parameter (real auth deferred to v2)

Do not add dependencies without asking. Do not propose alternative stacks.

---

## 6. Data model (Prisma schema)

Implement exactly this. Don't add or remove fields without asking.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role { AGENT BUYER }
enum BuyerStatus { ACTIVE PAUSED CLOSED }
enum PropertyType { SFH CONDO TOWNHOUSE COOP MULTIFAMILY }
enum ListingStatus { ACTIVE PENDING SOLD WITHDRAWN }
enum ShowingMode { IN_PERSON VIRTUAL DRIVE_BY }
enum GutReaction { LOVE LIKE MEH DISLIKE HATE }
enum ComparativeResult { BETTER SAME WORSE DIFFERENT }
enum InsightKind { STATED_VS_REVEALED_MISMATCH BUDGET_DRIFT PREFERENCE_CONVERGED LOW_CONFIDENCE NEW_PATTERN }
enum SnapshotTrigger { INTAKE FEEDBACK RE_INTAKE MANUAL_OVERRIDE OBSERVATION }

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String
  role      Role
  phone     String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  buyerProfile     BuyerProfile?
  managedBuyers    BuyerProfile[] @relation("AgentBuyers")
  enteredListings  Listing[]
  observations     AgentObservation[]
}

model BuyerProfile {
  id                  String         @id @default(cuid())
  userId              String         @unique
  user                User           @relation(fields: [userId], references: [id])
  agentId             String
  agent               User           @relation("AgentBuyers", fields: [agentId], references: [id])
  status              BuyerStatus    @default(ACTIVE)
  intakeCompletedAt   DateTime?

  budgetMin           Int?
  budgetMax           Int?
  minBedrooms         Int?
  minBathrooms        Float?
  propertyTypes       PropertyType[]
  targetCities        String[]
  targetZipCodes      String[]
  commuteAnchors      Json?
  mustHaves           String[]
  dealBreakers        String[]

  preferenceWeights   Json?  // { [dimKey]: { weight: number, confidence: number } }
  weightsUpdatedAt    DateTime?

  notes               String?  @db.Text

  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  intakeResponse      IntakeResponse?
  showings            Showing[]
  feedbacks           Feedback[]
  comparativeFeedbacks ComparativeFeedback[]
  recommendations     RecommendationBatch[]
  insights            InsightLog[]
  snapshots           PreferenceSnapshot[]
  summary             PreferenceSummary?
}

model Listing {
  id                  String        @id @default(cuid())
  agentId             String
  agent               User          @relation(fields: [agentId], references: [id])

  address             String
  city                String
  state               String
  zipCode             String
  lat                 Float?
  lng                 Float?
  listPrice           Int
  propertyType        PropertyType
  bedrooms            Int
  bathroomsFull       Int
  bathroomsHalf       Int           @default(0)
  interiorSqft        Int?
  lotSqft             Int?
  yearBuilt           Int?
  yearRenovated       Int?
  hoaFeeMonthly       Int?
  propertyTaxAnnual   Int?
  listingUrl          String?
  status              ListingStatus @default(ACTIVE)

  vector              Json   // { [dimKey]: value | null }

  agentNotes          String?       @db.Text
  photos              String[]

  createdAt           DateTime      @default(now())
  updatedAt           DateTime      @updatedAt

  showings            Showing[]
  feedbacks           Feedback[]
  recommendations     Recommendation[]
}

model Showing {
  id                String              @id @default(cuid())
  buyerProfileId    String
  buyerProfile      BuyerProfile        @relation(fields: [buyerProfileId], references: [id])
  listingId         String
  listing           Listing             @relation(fields: [listingId], references: [id])
  scheduledAt       DateTime
  attendedAt        DateTime?
  mode              ShowingMode
  agentObservations String?             @db.Text
  createdAt         DateTime            @default(now())
  updatedAt         DateTime            @updatedAt

  feedbacks         Feedback[]
  observations      AgentObservation[]
}

// Structured agent observations — high signal source #6
model AgentObservation {
  id                  String    @id @default(cuid())
  showingId           String
  showing             Showing   @relation(fields: [showingId], references: [id])
  agentId             String
  agent               User      @relation(fields: [agentId], references: [id])

  lingeredOn          String[]  // dimension keys buyer paid attention to
  reactedNegativelyTo String[]  // dimension keys that caused flinch / frown / "hmm"
  unpromptedQuotes    String?   @db.Text  // "she said: 'this kitchen is too dark'"
  durationVsAverage   String?   // SHORTER | NORMAL | LONGER
  agentConfidence     Int       // 1-5, how confident in their read

  createdAt           DateTime  @default(now())
}

model Feedback {
  id                  String      @id @default(cuid())
  buyerProfileId      String
  buyerProfile        BuyerProfile @relation(fields: [buyerProfileId], references: [id])
  listingId           String
  listing             Listing      @relation(fields: [listingId], references: [id])
  showingId           String?
  showing             Showing?     @relation(fields: [showingId], references: [id])

  submittedAt         DateTime    @default(now())
  gutReaction         GutReaction
  oneLineReaction     String?
  shownChips          Json        // [{ key, label, polarity }] — what was offered
  likedDimensions     String[]
  dislikedDimensions  String[]
  comparativeToPrevious ComparativeResult?
  previousListingId   String?
  wouldRevisit        Boolean?
  wouldBringPartner   Boolean?
  freeFormNotes       String?     @db.Text
  durationSeconds     Int?
}

model ComparativeFeedback {
  id                String       @id @default(cuid())
  buyerProfileId    String
  buyerProfile      BuyerProfile @relation(fields: [buyerProfileId], references: [id])
  listingAId        String
  listingBId        String
  preferredListingId String?
  reasonDimensions  String[]
  submittedAt       DateTime     @default(now())
}

model RecommendationBatch {
  id              String        @id @default(cuid())
  buyerProfileId  String
  buyerProfile    BuyerProfile  @relation(fields: [buyerProfileId], references: [id])
  createdAt       DateTime      @default(now())
  agentReviewedAt DateTime?
  notes           String?       @db.Text

  recommendations Recommendation[]
}

model Recommendation {
  id              String        @id @default(cuid())
  batchId         String
  batch           RecommendationBatch @relation(fields: [batchId], references: [id])
  listingId       String
  listing         Listing       @relation(fields: [listingId], references: [id])
  score           Float
  rationale       Json
  purpose         String        // MATCH | EXPLORE
  probedDimension String?       // for EXPLORE: which dim this listing tests
  agentApproved   Boolean       @default(false)
  shownToBuyerAt  DateTime?
}

model InsightLog {
  id              String       @id @default(cuid())
  buyerProfileId  String
  buyerProfile    BuyerProfile @relation(fields: [buyerProfileId], references: [id])
  kind            InsightKind
  message         String       @db.Text
  data            Json
  evidence        Json         // for "Why we know this" — citations to feedback ids, intake answers, observations
  createdAt       DateTime     @default(now())
  dismissedAt     DateTime?
  buyerResolution String?      // when buyer chooses A/B/C/D in mismatch resolution UI
}

model IntakeResponse {
  id              String       @id @default(cuid())
  buyerProfileId  String       @unique
  buyerProfile    BuyerProfile @relation(fields: [buyerProfileId], references: [id])
  answers         Json
  priorityRanking String[]
  intakeFreeText  String?      @db.Text
  startedAt       DateTime     @default(now())
  completedAt     DateTime?
  durationSeconds Int?
}

model PreferenceSnapshot {
  id              String       @id @default(cuid())
  buyerProfileId  String
  buyerProfile    BuyerProfile @relation(fields: [buyerProfileId], references: [id])
  triggerType     SnapshotTrigger
  triggerSourceId String?
  weightsBefore   Json
  weightsAfter    Json
  delta           Json
  createdAt       DateTime     @default(now())
}

model PreferenceSummary {
  id                    String       @id @default(cuid())
  buyerProfileId        String       @unique
  buyerProfile          BuyerProfile @relation(fields: [buyerProfileId], references: [id])
  headline              String       @db.Text  // agent-facing
  topPriorities         Json
  patterns              Json
  mismatches            Json
  buyerFacingText       String?      @db.Text
  archetype             String?      // e.g., "Light Chaser", "Space Maximizer"
  generatedAt           DateTime     @default(now())
  basedOnFeedbackCount  Int          @default(0)
}
```

---

## 7. The vector schema (the spine of the product)

Create `lib/vector-schema.ts` as the **single source of truth** for all dimensions. Every form, scoring function, chip generator, and summary template reads from this file.

```ts
export type DataType = 'number' | 'enum' | 'bool' | 'score_1_5'
export type Source = 'mls' | 'agent' | 'derived'
export type Group =
  | 'facts' | 'location' | 'building' | 'layout'
  | 'sensory' | 'outdoor' | 'neighborhood' | 'derived'

export interface Dimension {
  key: string
  label: string
  group: Group
  dataType: DataType
  source: Source
  enumValues?: string[]
  description?: string
}

export const DIMENSIONS: Dimension[] = [
  // facts
  { key: 'price', label: 'Price', group: 'facts', dataType: 'number', source: 'mls' },
  { key: 'price_per_sqft', label: 'Price/sqft', group: 'facts', dataType: 'number', source: 'derived' },
  { key: 'bedrooms', label: 'Bedrooms', group: 'facts', dataType: 'number', source: 'mls' },
  { key: 'bathrooms', label: 'Bathrooms', group: 'facts', dataType: 'number', source: 'mls' },
  { key: 'interior_sqft', label: 'Interior sqft', group: 'facts', dataType: 'number', source: 'mls' },
  { key: 'lot_sqft', label: 'Lot sqft', group: 'facts', dataType: 'number', source: 'mls' },
  { key: 'year_built', label: 'Year built', group: 'facts', dataType: 'number', source: 'mls' },

  // location
  { key: 'walk_score', label: 'Walkability', group: 'location', dataType: 'number', source: 'derived' },
  { key: 'commute_minutes_primary', label: 'Commute (primary)', group: 'location', dataType: 'number', source: 'derived' },
  { key: 'school_rating', label: 'School rating', group: 'location', dataType: 'number', source: 'mls' },
  { key: 'noise_level', label: 'Quietness', group: 'location', dataType: 'score_1_5', source: 'agent' },
  { key: 'street_type', label: 'Street type', group: 'location', dataType: 'enum', source: 'agent',
    enumValues: ['quiet_residential', 'busy_residential', 'arterial', 'cul_de_sac'] },

  // building
  { key: 'roof_age_years', label: 'Roof age', group: 'building', dataType: 'number', source: 'agent' },
  { key: 'hvac_age_years', label: 'HVAC age', group: 'building', dataType: 'number', source: 'agent' },
  { key: 'has_solar', label: 'Solar panels', group: 'building', dataType: 'bool', source: 'mls' },
  { key: 'heating_type', label: 'Heating', group: 'building', dataType: 'enum', source: 'mls',
    enumValues: ['gas', 'electric', 'heat_pump', 'oil', 'radiant'] },

  // layout
  { key: 'openness', label: 'Open layout', group: 'layout', dataType: 'score_1_5', source: 'agent' },
  { key: 'kitchen_layout', label: 'Kitchen layout', group: 'layout', dataType: 'enum', source: 'agent',
    enumValues: ['galley', 'u_shape', 'l_shape', 'island', 'peninsula', 'open_great_room'] },
  { key: 'has_dining_room', label: 'Formal dining', group: 'layout', dataType: 'bool', source: 'agent' },
  { key: 'home_office_count', label: 'Home offices', group: 'layout', dataType: 'number', source: 'agent' },
  { key: 'storage_abundance', label: 'Storage', group: 'layout', dataType: 'score_1_5', source: 'agent' },
  { key: 'ceiling_height_feet', label: 'Ceiling height', group: 'layout', dataType: 'number', source: 'agent' },

  // sensory — high-value agent input
  { key: 'natural_light', label: 'Natural light', group: 'sensory', dataType: 'score_1_5', source: 'agent' },
  { key: 'view_quality', label: 'View quality', group: 'sensory', dataType: 'score_1_5', source: 'agent' },
  { key: 'privacy_from_neighbors', label: 'Privacy', group: 'sensory', dataType: 'score_1_5', source: 'agent' },
  { key: 'finish_quality', label: 'Finish quality', group: 'sensory', dataType: 'enum', source: 'agent',
    enumValues: ['builder_grade', 'mid', 'high_end', 'luxury'] },
  { key: 'move_in_readiness', label: 'Move-in ready', group: 'sensory', dataType: 'score_1_5', source: 'agent' },

  // outdoor
  { key: 'yard_size_category', label: 'Yard size', group: 'outdoor', dataType: 'enum', source: 'agent',
    enumValues: ['none', 'small', 'medium', 'large'] },
  { key: 'yard_usability', label: 'Yard usability', group: 'outdoor', dataType: 'score_1_5', source: 'agent' },
  { key: 'is_fenced', label: 'Fenced', group: 'outdoor', dataType: 'bool', source: 'agent' },
  { key: 'has_outdoor_space', label: 'Has outdoor space', group: 'outdoor', dataType: 'bool', source: 'agent' },

  // neighborhood
  { key: 'vibe', label: 'Neighborhood vibe', group: 'neighborhood', dataType: 'enum', source: 'agent',
    enumValues: ['quiet', 'lively', 'sleepy', 'up_and_coming', 'established'] },
  { key: 'street_parking_ease', label: 'Parking ease', group: 'neighborhood', dataType: 'score_1_5', source: 'agent' },

  // derived
  { key: 'commute_weighted_score', label: 'Commute fit', group: 'derived', dataType: 'number', source: 'derived' },
  { key: 'stretch_pct', label: 'Budget stretch', group: 'derived', dataType: 'number', source: 'derived' },
]
```

**Rules:**
- Missing data is `null`, never `0`. Null = unknown.
- Scoring must skip null dimensions (not treat as 0).
- Don't reference dimension keys as string literals elsewhere — always import from this file.

---

## 8. File structure

```
app/
  (agent)/agent/
    page.tsx                               # dashboard
    listings/{ new, [id], page.tsx }
    buyers/{ new, [id], page.tsx }
    showings/{ new, [id]/observe }/page.tsx
    insights/page.tsx
  (buyer)/buyer/
    page.tsx                               # Self Portrait home
    intake/page.tsx
    feedback/[showingId]/page.tsx
    recommendations/page.tsx
    listings/[id]/page.tsx
    journey/page.tsx                       # time-series view
  api/
    intake/{ submit, answer }/route.ts
    feedback/{ submit, chips/[listingId] }/route.ts
    observations/submit/route.ts
    recommendations/generate/route.ts
    summary/[buyerId]/route.ts
    insights/[id]/resolve/route.ts
  switch/page.tsx                          # dev role switcher

lib/
  vector-schema.ts                         # ⭐ source of truth
  questionnaire/
    intake-schema.ts
    feedback-schema.ts
    chip-generator.ts
    chip-phrasing.ts
  scoring/
    intake-scorer.ts
    feedback-scorer.ts
    observation-scorer.ts
    recommend.ts
    market-stats.ts
    signal-strengths.ts                    # the 7-source hierarchy
  preferences/
    update.ts
    pattern-detector.ts
  summary/
    generate.ts
    templates.ts
    why-we-know.ts                         # evidence chain builder
    archetypes.ts
  prisma.ts
  auth.ts

components/
  ui/                                      # shadcn primitives
  forms/
    DimensionInput.tsx
    ListingForm.tsx
  intake/
    IntakeQuestionRenderer.tsx
    questions/{ DualSlider, ChipSelect, Ranking, Repeater }.tsx
  feedback/
    FeedbackFlow.tsx
    GutReactionPicker.tsx
    ChipFeedback.tsx
  observation/
    ObservationForm.tsx                    # structured agent input
  portrait/
    SelfPortrait.tsx
    LearningMoment.tsx                     # with mismatch resolution UI
    PriorityBars.tsx
    WhyWeKnowThis.tsx                      # evidence-rich expandable
    ConfidenceBadge.tsx
    JourneyTimeline.tsx                    # time-series visualization

prisma/
  schema.prisma
  seed.ts
```

---

## 9. Build order (10-12 days of focused work)

Hand tasks to me one at a time. After each task, I review the diff before you continue.

### MILESTONE 0 — Read, plan, scaffold (Day 1, 2-3 hours)

**Task 0.1** Read this entire document. Summarize back to me in 5-7 bullets:
- What we're building
- The differentiation (why we're not a ChatGPT wrapper)
- The 7 signal sources hierarchy
- The 8 product principles
- The build order at high level

I'll confirm alignment before you write code.

**Task 0.2** Initialize Next.js 14 project, install deps (Prisma, shadcn/ui, RHF, Zod). Set up Tailwind. Configure shadcn. Push to GitHub.

**Task 0.3** Create empty Prisma schema, set up `.env.example`, verify connection to Render Postgres works locally with a `HealthCheck` model + migration.

---

### MILESTONE 1 — Schema, vector, auth (Day 2)

**Task 1.1** Implement full Prisma schema (Section 6). Run migration. Verify all tables exist via Prisma Studio.

**Task 1.2** Create `lib/vector-schema.ts` per Section 7. Add helpers: `getDimension(key)`, `getByGroup(group)`, `validateVector(obj)`.

**Task 1.3** Create `lib/scoring/signal-strengths.ts` codifying the 7-source hierarchy:
```ts
export const SIGNAL_STRENGTHS = {
  INTAKE_STATED: 0.1,
  INTAKE_FORCED_RANKING: 0.3,
  INTAKE_SCENARIO: 0.4,
  INTAKE_PAIN_POINTS: 0.4,
  FEEDBACK_CHIPS: 0.7,
  FEEDBACK_GUT: 0.3,           // gut reaction is broad, not specific
  FEEDBACK_COMPARATIVE: 0.8,
  AGENT_OBSERVATION: 0.9,
  PURE_BEHAVIOR: 1.0,
} as const
```
All scoring functions import from this. Never hardcode strengths inline.

**Task 1.4** Implement simple auth at `lib/auth.ts`:
- `getSession()` reads `?as=user_<id>` from URL
- Middleware redirects buyers to `/buyer`, agents to `/agent`
- `/switch` page lists all users and lets me click to become any of them (dev only)

**Task 1.5** Seed script (`prisma/seed.ts`): 1 agent (use my email), 2 test buyers, 8 listings with realistic vectors. I'll provide real addresses if needed — ask me.

---

### MILESTONE 2 — Listing entry (Day 3-4)

**Task 2.1** Build `<DimensionInput>` component that switches input type based on `dimension.dataType`. Used in listing form.

**Task 2.2** Multi-step listing form at `/agent/listings/new`. Sections: Basics → Building → Layout → Sensory → Outdoor → Notes. Per-section auto-save (800ms debounce) to a draft Listing record. Show completeness % per section.

The Sensory section needs gentle prompts:
- "Stand in the living room — how would you rate the natural light?"
- "How does the privacy from neighbors feel — exposed or private?"

**Task 2.3** Listing index `/agent/listings` (filter by status, search by address) and detail `/agent/listings/[id]` (view + edit).

**After this milestone, I will manually enter 5-8 real listings to use as a real dataset.**

---

### MILESTONE 3 — Buyer onboarding + intake (Day 5-6)

**Task 3.1** `/agent/buyers/new` — create buyer (name, email). Generates buyer's "login link" (`?as=user_<id>` for now).

**Task 3.2** Build `lib/questionnaire/intake-schema.ts` — array of 14 question definitions:
1. Budget (dual slider) — REQUIRED
2. Bedrooms minimum (chip single) — REQUIRED
3. Bathrooms minimum (chip single) — REQUIRED
4. Property types (chip multi) — REQUIRED
5. Target cities/zips (multi-input) — REQUIRED
6. Commute anchors (repeater) — REQUIRED
7. Forced ranking — drag 8 priorities (location, size, schools, outdoor, kitchen, light, finishes, privacy)
8. Saturday morning scenario (chip multi, max 3)
9. Hosting scenario (chip single)
10. Current home pain points (chip multi, max 4)
11. Renovation appetite (chip single)
12. **(Skipped in v1 — placeholder for image A/B)**
13. **(Skipped in v1 — placeholder for image A/B)**
14. Open text — "three words for your dream home" + "anything else?"

Each question shows a tiny **immediate-value response** to the buyer:
- After Q1 budget → "In your area, that gets you roughly: 3BR/2BA homes around 1800sqft"
- After Q7 ranking → "Compared to most first-time buyers, you weight X higher than average"
- After Q10 pain points → "Got it — we'll avoid these in your recommendations"

This makes intake feel like value flowing back, not just data flowing out.

**Task 3.3** Build `<IntakeQuestionRenderer>` — dispatches to right input by type. Mobile-first, one question per screen, progress bar, back button, auto-save to `IntakeResponse.answers`.

**Task 3.4** Build `lib/scoring/intake-scorer.ts`:
- Initialize all DIMENSION_KEYS to `{ weight: 0, confidence: 0.1 }`
- Apply forced ranking → top 5 dims get positive weights with conf 0.3
- Apply pain points → boost related dimensions (signal strength 0.4)
- Apply scenario answers → small positive nudges (signal strength 0.4)
- Apply open text via simple keyword matching (skip LLM for v1)
- Cap weights to [-1, 1], confidence [0, 1]
- Create initial `PreferenceSnapshot` with trigger `INTAKE`

Mappings between intake answers and dimensions go in `lib/scoring/intake-mappings.ts`. Show me before implementing — these mappings are product-judgment-heavy.

**Task 3.5** `POST /api/intake/submit` — runs scorer, saves snapshot, generates first PreferenceSummary, redirects buyer to Self Portrait.

---

### MILESTONE 4 — Self Portrait v1 (Day 6-7)

**Task 4.1** `/buyer` home page:
- Welcome with archetype label (e.g., "You're a Light Chaser")
- Self Portrait card: top 3-5 priorities with priority bars + confidence badges
- Upcoming showings list
- Recent feedback feed (empty initially)
- "Your journey →" link to timeline (placeholder for now)

**Task 4.2** Template-based summary generator `lib/summary/generate.ts`:
- Sort dimensions by `weight * confidence`
- Top 3 → "What matters most to you so far"
- Bottom 3 negatives → "What you've ruled out"
- If feedback count < 3: lead with "We're still learning — these are early hunches"
- Headline tone: agent-facing version is data-rich; buyer-facing is warm

**Task 4.3** `lib/summary/templates.ts` — phrase templates for buyer-facing copy.
- Don't write generic buzzwordy copy. I'll write the actual phrases. You build the template engine that interpolates dimension data into my templates.
- I'll provide a list of phrasings for top dimensions (e.g., natural_light high → "you light up around bright, airy spaces").

**Task 4.4** `<ConfidenceBadge>` component:
- High (>0.7): solid dot + "We're confident"
- Medium (0.4-0.7): half dot + "We think"
- Low (<0.4): outlined dot + "Still learning"

Use everywhere a system claim appears.

**Task 4.5** `lib/summary/archetypes.ts` — assigns a label like "Light Chaser" / "Space Maximizer" / "Quiet Seeker" based on top weighted dimensions. Pure rule-based for v1. I'll provide the label list.

---

### MILESTONE 5 — Showings + structured agent observations (Day 8)

**Task 5.1** `/agent/showings/new` — pick buyer + listing + datetime + mode. Creates Showing record. Buyer's `/buyer` shows the upcoming showing.

**Task 5.2** `/agent/showings/[id]/observe` — **structured agent observation form** (this is signal source #6, do not skimp):

```
After the showing — what did you notice?

🎯 What did the buyer linger on or react positively to?
   [chip multi-select of dimensions, including "Other: ___"]

⚠️ What did they react negatively to (verbal or non-verbal)?
   [chip multi-select]

💬 Anything they said unprompted?
   [free text]

⏱️ Showing length vs. average for this buyer:
   ( ) Shorter   (•) Normal   ( ) Longer

🎚️ How confident are you in your read?
   ⭐⭐⭐⭐⭐
```

Saves to `AgentObservation` table.

**Task 5.3** When agent submits observation, run `lib/scoring/observation-scorer.ts`:
- For each dimension in `lingeredOn`: positive update with signal strength 0.9 × agentConfidence/5
- For each in `reactedNegativelyTo`: negative update, same strength
- Create `PreferenceSnapshot` with trigger `OBSERVATION`

**This is critical to the differentiation.** Agent observations enter the system at higher signal strength than buyer's own self-report. Make sure this is wired correctly.

---

### MILESTONE 6 — Tailored chips + feedback flow (Day 9-10) ⭐ CROWN JEWEL

**Task 6.1** `lib/questionnaire/chip-generator.ts` (server-side only):
- For each dimension where `listing.vector[dim] !== null`:
  - Compute market average across all active listings (use `lib/scoring/market-stats.ts` helper)
  - Compute z-score
  - Salience = abs(z-score)
- Pick top 8-10 most salient dimensions
- Phrase positively if listing scores high, negatively if low
- Return `[{ key, label, polarity: 'positive' | 'negative' }]`

**Task 6.2** `lib/questionnaire/chip-phrasing.ts` — natural-language mappings for each dimension:
```ts
export const PHRASING: Record<string, { high: string; low: string }> = {
  natural_light: { high: 'Lots of natural light', low: 'Felt dark' },
  yard_size_category: { high: 'Big yard', low: 'No real outdoor space' },
  noise_level: { high: 'Nice and quiet', low: 'Noisy street' },
  // ... I will provide the full list. Don't auto-generate. Phrasing matters too much.
}
```
**Ask me to provide the phrasings.** Don't make them up.

**Task 6.3** `GET /api/feedback/chips/[listingId]?buyerId=...` — returns chips for the listing. Cache per listing for 1 hour.

**Task 6.4** Mobile feedback flow at `/buyer/feedback/[showingId]`. **Polish obsessively.** Test on actual phone at 375px width.

Top to bottom, single screen if possible:
1. Listing thumbnail + address (small, just for context)
2. **F1 Gut reaction:** 5 emoji buttons in a row, ~60px tall each
3. **F2 One-line:** single text input, placeholder "In a sentence, how was it?"
4. **F3 Chips:** "What stood out?" Two columns: ❤️ Loved / 👎 Didn't love. Tap to toggle. Wraps.
5. **F4 Comparative** (if previous showing exists): "Compared to [prev address]?" 4 chips.
6. **F5 Quick yes/no:** Two toggles. "Worth a second look?" "Bring partner?"
7. Sticky submit button at bottom.

Track `durationSeconds` from page load to submit. Goal: median <90s.

**Task 6.5** `POST /api/feedback/submit` — save Feedback, run feedback-scorer, create snapshot, run pattern detection, regenerate summary if threshold met.

**Task 6.6** `lib/scoring/feedback-scorer.ts`:
- For each `likedDimensions[]`: positive update, signal strength 0.7
- For each `dislikedDimensions[]`: negative update, signal strength 0.7
- For `gutReaction`: global signal across listing's salient dimensions, signal strength 0.3
- For `comparativeToPrevious === BETTER/WORSE`: pairwise update across dimensions where listings differ, signal strength 0.8

Update rule:
```ts
function updateDimension(current, signal, signalStrength) {
  const learningRate = (1 - current.confidence) * 0.3 + 0.05
  const newWeight = clamp(current.weight + signal * signalStrength * learningRate, -1, 1)
  const newConfidence = clamp(current.confidence + signalStrength * 0.1, 0, 1)
  return { weight: newWeight, confidence: newConfidence }
}
```

---

### MILESTONE 7 — Pattern detection + Learning Moments (Day 10-11)

**Task 7.1** `lib/preferences/pattern-detector.ts` — implement these 4 rules:

- **STATED_VS_REVEALED_MISMATCH**: top-3 stated priorities where revealed weight is < 0.2 with confidence > 0.4
- **BUDGET_DRIFT**: average price of LOVE/LIKE listings > 1.1 × budgetMax (need ≥3 such)
- **PREFERENCE_CONVERGED**: top 3 dimensions all confidence > 0.7
- **LOW_CONFIDENCE**: ≥6 feedbacks AND avg confidence < 0.4

Each detected pattern creates an `InsightLog` with `evidence` field populated (specific feedback IDs, intake answer quotes, observation IDs).

**Task 7.2** `<LearningMoment>` component for buyer-facing insights. **CRITICAL: Mismatch insights are invitations, not declarations.**

Example UI for STATED_VS_REVEALED_MISMATCH:

```
🤔 Something interesting

You ranked "school district" as your top priority during intake.
But the homes you've reacted most strongly to have been chosen
without regard for school quality — your favorites have ratings
of 6, 5, and 8.

What's actually going on? Your call:

  🅐 Schools were never as important as I thought.
     I'll update my must-haves.

  🅑 Schools matter, but I'd rather have a great home in a
     decent district than a meh home in a great district.

  🅒 I haven't seen the right school-district homes yet.
     Keep showing me more.

  🅓 Something else: ___

[Why we think this →]
```

Buyer's selection saves to `InsightLog.buyerResolution` AND triggers a high-signal-strength weight update.

**Task 7.3** `<WhyWeKnowThis>` component. Expandable section showing structured evidence:

```
📋 What you said:
   [intake quote] — your intake answer to [question]
   You ranked [priority] #X in priority ranking

📊 What we observed (N independent signals):
   • [feedback event 1 with date and listing]
   • [feedback event 2]
   • Your agent noticed [observation quote]

🎯 What you did:
   [behavior — e.g., "You requested a second showing of 311 Oak St"]

💡 Confidence: X.X (high / medium / still learning)
```

Every claim has a citation. The data comes from `InsightLog.evidence`. Build `lib/summary/why-we-know.ts` to assemble evidence given a dimension.

**Task 7.4** Agent insights inbox at `/agent/insights` — feed of all InsightLog entries across all buyers. Action buttons: "Discuss with buyer", "Dismiss".

---

### MILESTONE 8 — Recommendations with explicit probes (Day 11)

**Task 8.1** `lib/scoring/recommend.ts` — score function:
```ts
function score(listing, buyer): number {
  if (violatesHardConstraints(listing, buyer)) return -Infinity
  let total = 0, totalWeight = 0
  for (const dim of DIMENSIONS) {
    const v = listing.vector[dim.key]
    if (v === null) continue
    const pref = buyer.preferenceWeights[dim.key]
    if (!pref || pref.confidence < 0.1) continue
    const normalized = normalizeValue(v, dim, marketStats[dim.key])
    total += pref.weight * pref.confidence * normalized
    totalWeight += pref.confidence
  }
  return totalWeight > 0 ? total / totalWeight : 0
}
```

**Task 8.2** Recommendation generation. For each batch:
- 60% MATCH picks: top scored
- 40% EXPLORE/PROBE picks: listings strong on dimensions where buyer's confidence is < 0.4. Each PROBE pick is tagged with `probedDimension`.

**Critical:** Agent UI shows the probe purpose:
```
🔬 PROBE — Tests whether quietness really matters as much as she said
   Stated importance: high. Revealed signal: still ambiguous.
   This listing is on a busier street than her others.
```

Agent reviews list, can drag to reorder, remove, annotate. Approve creates RecommendationBatch.

**Task 8.3** Buyer-side `/buyer/recommendations` shows approved listings as cards, links to `/buyer/listings/[id]` (photos + facts + "Schedule a tour" CTA).

---

### MILESTONE 9 — Journey timeline + polish (Day 12)

**Task 9.1** `/buyer/journey` page:
- Top-3-priorities chart over time (uses PreferenceSnapshot history)
- Each showing as a timeline node with key feedback
- "You at intake" vs. "You now" side-by-side

Use `recharts` (compatible with shadcn).

**Task 9.2** Empty states everywhere. No raw error messages reach buyers. Loading states for all async operations.

**Task 9.3** Mobile QA pass — open every buyer page on actual iPhone SE (375px). Fix anything cramped.

**Task 9.4** Agent dashboard `/agent`:
- List of active buyers with status indicators
- Recent feedback feed across all buyers
- Insight count badges
- Quick actions: new listing, new buyer, generate recommendations

---

## 10. Working agreement

- **Read this whole doc before starting.** Confirm understanding (Task 0.1).
- **One task at a time.** Don't batch ahead. After each commit, I review.
- **Ask before adding dependencies.** Default answer is no.
- **Never expose preference math to the browser.** All scoring is server-side.
- **Don't write copy that needs to be warm.** Surface the templates and ask me to fill in the actual phrases — for chip phrasings, archetype labels, Learning Moment language, buyer-facing summaries.
- **When stuck, surface 2-3 concrete options** with tradeoffs. Don't disappear into refactoring.
- **Never silently average stated vs revealed signals.** When they conflict, the conflict IS the value — surface it.
- **Confidence indicators everywhere.** Never make claims without showing confidence.
- **Test on a real phone.** "It works in the desktop browser dev tools" is not testing.

---

## 11. What I provide along the way

Ask me when you need:
- Real listing addresses for seed data (~8 listings)
- Chip phrasings for each dimension (positive + negative)
- Archetype labels and descriptions
- Buyer-facing summary templates
- Intake-answer-to-dimension mappings (the mappings are product judgment)
- Learning Moment phrasings for each pattern type
- Brand colors / tone preferences when we hit visible UI

---

## 12. Definition of done for v1

A friend (acting as real buyer) can:
1. Open a link I sent (no auth needed, URL has `?as=user_xxx`)
2. Complete intake on phone in 10-15 minutes, with immediate-value responses along the way
3. See first Self Portrait with archetype label
4. Have me schedule a showing
5. Visit a real listing
6. Complete feedback on phone in <90 seconds
7. After 3+ feedbacks, see at least one Learning Moment with multi-option resolution
8. Click "Why we know this" and see structured evidence chain
9. View their journey timeline showing how priorities evolved

I (agent) can:
1. Enter a listing in <10 minutes with full vector data
2. Create a buyer, send their link
3. Schedule showings
4. Submit structured agent observations after each showing (signal source #6 wired correctly)
5. See each buyer's profile, vector visualization, feedback timeline, insights
6. Generate recommendations with explicit MATCH and PROBE picks
7. See pattern alerts when stated and revealed diverge

Everything is on Render, deploys from main branch, accessible from my phone.

---

## 13. Start here

Begin Milestone 0, Task 0.1. Read this entire document, then summarize back to me in 5-7 bullets so I can confirm we're aligned. Do not write code yet.
