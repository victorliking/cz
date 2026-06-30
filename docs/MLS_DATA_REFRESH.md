# MLS Data Refresh — How It Actually Works

**TL;DR:** MLS PIN IDX is a **manual portal download**, not an API. The reliable
refresh flow is: download the IDX files from mlspin.com → drop them in
`data/mls/` → run the import script. The in-app "Sync now" button attempts an
auto-download but MLS PIN exposes no documented programmatic endpoint, so it
will report that and point you here.

---

## The reliable flow (proven — this is how the 3,215 listings got loaded)

1. **Download from MLS PIN** (every ~12-24h for freshness):
   - Log into https://www.mlspin.com with agent credentials
   - Quick Links → **IDX Downloads**
   - Download (pipe-delimited `.txt`): the Single Family / Condo / Multi-Family
     active data files. Save them into `data/mls/` as `idx_sf.txt`, `idx_cc.txt`,
     `idx_mf.txt` (matching the names the importer expects). Also grab `towns.txt`
     if the reference table changed.

2. **Import into the database:**
   ```bash
   # Preview first (no DB writes):
   npx tsx scripts/import-mls.ts --dry-run --preview 5

   # Real import (writes to the DB in DATABASE_URL):
   npx tsx scripts/import-mls.ts --agent-id <your-agent-user-id>

   # Optional: limit to a service area
   npx tsx scripts/import-mls.ts --agent-id <id> --towns Arlington,Belmont,Watertown
   ```
   The importer resolves town names, derives scoring dimensions, looks up school
   ratings, builds photo URLs, and upserts (dedup on address+zip).

3. **Verify:** the agent dashboard's "MLS listing data" card shows the new
   "last updated" time and active count.

> To refresh **production** data, run the import with the production
> `DATABASE_URL` (from Neon/Vercel): `DATABASE_URL="postgres://…" npx tsx scripts/import-mls.ts --agent-id <prod-agent-id>`.

## The "Sync now" button (in-app)

`POST /api/listings/sync-now` (dashboard button) attempts the auto-download leg.
Because MLS PIN has no documented IDX API, it currently reports:
*"No files downloaded… use the manual refresh flow."* That is expected, not a
bug — it's an honest signal, and it never touches your data (test-safe mode).

## The scheduled cron

`vercel.json` schedules `GET /api/cron/sync-mls` daily. It runs the same
auto-download and will no-op (with the same hint) until a working feed exists.
The **parsing, town resolution, status mapping, vector derivation, and
stale-withdraw guard are all correct and tested** — only the download leg is
unproven. When you obtain a real automated feed (e.g. an MLS PIN **RETS/RESO
Web API** endpoint with credentials), implement it in `downloadIdxFile()` /
`getMlsPinSession()` and the rest of the pipeline works as-is.

## Future: true automation

To make the daily cron actually pull data without manual steps, you need one of:
- **MLS PIN RETS or RESO Web API** access (ask MLS PIN for credentials + the
  endpoint) — replace the guessed `downloadIdxFile` with a RETS/RESO client.
- A scheduled job on a machine that has the files (e.g. a box that runs the
  manual download via browser automation, then calls the import) — heavier.

Until then, the manual flow above is the supported path and takes ~2 minutes.
