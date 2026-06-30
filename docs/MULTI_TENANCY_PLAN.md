# Multi-Tenancy Migration Plan (Brokerage boundary)

**Status:** DESIGN ONLY — not implemented. Do not run against prod until reviewed and a real second tenant is near.
**Author:** prepared 2026-06-30. **Owner decision required before execution.**

---

## 1. Why / when

HomeMatch's north star is selling to brokerages. Today there is **no tenant boundary**:
every query scopes by `agentId`, and the "shared MLS inventory" feature is faked with
`agent.role === "AGENT"` (i.e. *every* agent sees *every* agent's listings). That is fine
for a single-agent deployment but **fails the moment a second brokerage exists** — Brokerage
B's agent would see Brokerage A's listings, and the shared-inventory query would mix tenants.

**Only execute this when a real second brokerage is imminent.** Until then it adds risk and
maintenance for no user-visible benefit. The single-tenant app works correctly today.

## 2. The core risk (why this needs sign-off)

A tenant-isolation bug is the **worst** failure mode for an enterprise sale: one mis-scoped
query silently leaks one brokerage's buyers/listings/insights to another. This is also a
**live-DB schema migration with a data backfill**. Both facts mean: explicit owner approval,
a tested backfill, and a rollback path are mandatory. Treat every `agentId` filter as a
potential leak until proven re-scoped.

## 3. Schema changes

Add a tenant model and a nullable FK on the three owner-bearing models. Nullable first so the
migration is non-breaking; backfill; then (optionally, later) make non-null.

```prisma
model Brokerage {
  id        String   @id @default(cuid())
  name      String
  slug      String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  users         User[]
  listings      Listing[]
  buyerProfiles BuyerProfile[]
}

// User       += brokerageId String?  + relation; @@index([brokerageId])
// Listing    += brokerageId String?  + relation; @@index([brokerageId, status])
// BuyerProfile += brokerageId String? + relation; @@index([brokerageId])
```

Derived models (`Showing`, `AgentObservation`, `Feedback`, `InsightLog`, `IntakeResponse`,
`PreferenceSnapshot`, `PreferenceSummary`, `Recommendation*`) do **not** need their own
`brokerageId` — they reach a tenant transitively via `BuyerProfile`/`Listing`. Scope them
through their parent relation, not a duplicated column (avoids backfill drift).

## 4. Backfill (safe — no data moves between owners)

1. Create one default brokerage (e.g. `{ name: "HomeMatch", slug: "default" }`).
2. `UPDATE "User" SET brokerageId = <default> WHERE brokerageId IS NULL;`
3. Same for `Listing` and `BuyerProfile`.
This assigns *everything currently in prod* to a single tenant — it does not reassign any
row's `agentId`/owner, so it cannot leak or lose data. Verify counts before/after match.

Run order: `prisma migrate` (additive, nullable columns) → backfill script in a transaction →
verify → deploy code that reads `brokerageId`.

## 5. The 18 query sites to re-scope (the leak surface)

Every file below filters by `agentId` today. Each must change to scope by the **acting
user's `brokerageId`** (resolve once from the session/token → user → brokerageId). The
dangerous ones are the **read/list** queries (they decide what a user can SEE):

| File | Current scope | Change to |
|---|---|---|
| `app/api/listings/route.ts` (GET) | `OR: [agentId, agent.role==="AGENT"]` ← the fake-shared hack | `brokerageId: me.brokerageId` (real shared inventory within tenant) |
| `app/(agent)/agent/page.tsx` | `agentId` counts | `brokerageId` counts (keep buyers per-agent or per-tenant — product call) |
| `app/(agent)/agent/listings/page.tsx` | listings page | `brokerageId` |
| `app/api/buyers/list/route.ts` | `agentId` | `brokerageId` (or keep per-agent — decide) |
| `app/(agent)/agent/buyers/[id]/page.tsx` | `profile.agentId !== userId` guard | `profile.brokerageId !== me.brokerageId` |
| `app/api/buyers/route.ts` (create) | sets `agentId` | also set `brokerageId` |
| `app/api/matches/route.ts` | listings pool | `brokerageId`-scoped active listings |
| `app/api/feedback/route.ts` | `profile.agentId` guard | tenant guard |
| `app/api/observations/route.ts` | `agentId` create + guards | tenant guard + set brokerageId |
| `app/api/observations/showing-info/route.ts` | guard | tenant guard |
| `app/api/insights/route.ts` | `agentId` | `brokerageId` |
| `app/api/intake/profile/route.ts` | guard | tenant guard |
| `app/api/intake/validate/route.ts` | owner mint | tenant-aware |
| `app/api/cron/sync-mls/route.ts` | `getSystemAgentId()` | assign synced listings a `brokerageId` (system tenant or per-market) |
| `lib/mls/sync.ts` (CLI import) | system agent | brokerageId on import |
| `lib/auth.ts` / `lib/auth-options.ts` | id resolution | also resolve + cache `brokerageId` on token/session |
| `app/(buyer)/buyer/page.tsx` | buyer's own data | unchanged (buyer sees self) — verify |
| `app/api/auth/set-role/route.ts` | self-managed profile | assign brokerageId on agent creation |

**Method:** add a `getTenantId(request)` helper next to `getApiUser` that resolves
`user.brokerageId`. Replace `where: { agentId: userId }` with `where: { brokerageId }` on the
**list/read** paths; keep `agentId` as the *within-tenant* owner for "my buyers vs the
brokerage's buyers" distinctions. Decide per screen whether the unit is the agent or the
brokerage (e.g. listings = brokerage-wide; a buyer's private notes = agent-only).

## 6. Test plan (must pass before deploy)

- **Isolation test (the critical one):** seed two brokerages, each with an agent + buyer +
  listing. Assert agent A's every list/read endpoint returns ONLY brokerage A rows, and a
  direct-id fetch of a brokerage-B resource 404s. This is the test that proves no leak.
- Backfill test: all pre-existing rows land in the default brokerage; counts preserved.
- Regression: the existing 88 tests stay green; the learning loop, photos, identity fix,
  rate limits all still work.
- Add isolation assertions to the vitest suite so a future query can't silently drop the
  `brokerageId` filter without failing CI.

## 7. Rollback

- The migration is additive (nullable columns + a table) → safe to leave in place.
- Code rollback: revert the query-scoping commit; the nullable `brokerageId` columns are
  ignored by the old code. No data loss.
- Keep the backfill script idempotent (only touches `brokerageId IS NULL`).

## 8. Recommended sequence

1. Land schema + backfill on a branch; run migration against a **copy/staging** DB first.
2. Re-scope queries behind `getTenantId`; add the isolation test; get it green locally.
3. Owner review of the PR (especially every read-path scope change).
4. Run migration + backfill on prod in a maintenance window; verify counts.
5. Deploy the re-scoped code.
6. Follow-ups: SSO/SAML per brokerage, brokerage admin/analytics dashboard, per-brokerage
   branding on buyer reports.

## 9. What this unblocks

Per-brokerage dashboards (conversion, time-to-match, preference-drift), white-label buyer
reports, SSO, and the "$15-50K/mo for 500+ agents" enterprise pricing — none of which are
safe to build before the tenant boundary exists.
