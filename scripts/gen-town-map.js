/**
 * Regenerate lib/mls/town-map.ts from data/mls/towns.txt.
 *
 * The cron sync (app/api/cron/sync-mls/route.ts) runs serverless on Vercel with
 * no filesystem access to data/ (towns.txt is gitignored), so the TOWN_NUM ->
 * town-name lookup must be committed as code. Run this whenever towns.txt changes:
 *
 *   node scripts/gen-town-map.js
 */
const fs = require("fs")
const path = require("path")

const SRC = path.join(__dirname, "..", "data", "mls", "towns.txt")
const OUT = path.join(__dirname, "..", "lib", "mls", "town-map.ts")

const lines = fs.readFileSync(SRC, "utf8").split(/\r?\n/)
const map = {}
for (let i = 1; i < lines.length; i++) {
  const l = lines[i].trim()
  if (!l) continue
  const p = l.split("|")
  const num = parseInt(p[0], 10)
  const name = (p[1] || "").trim()
  if (!Number.isFinite(num) || !name) continue
  map[num] = name
}

const entries = Object.keys(map)
  .map((n) => parseInt(n, 10))
  .sort((a, b) => a - b)
  .map((n) => `  ${n}: ${JSON.stringify(map[n])},`)
  .join("\n")

const out = `/**
 * MLS PIN TOWN_NUM -> town name lookup.
 *
 * Generated from data/mls/towns.txt (which is gitignored and NOT present on the
 * serverless filesystem). The cron sync runs on Vercel without filesystem access
 * to data/, so this map is committed as code to resolve a record's TOWN_NUM into
 * a city name. The CLI importer (lib/mls/sync.ts) still reads towns.txt directly.
 *
 * To regenerate: node scripts/gen-town-map.js
 */

export const TOWN_NUM_TO_NAME: Record<number, string> = {
${entries}
}

/** Resolve a raw TOWN_NUM (string|number|null) to a town name, or "" if unknown. */
export function resolveTownName(townNum: string | number | null | undefined): string {
  if (townNum === null || townNum === undefined || townNum === "") return ""
  const n = typeof townNum === "number" ? townNum : parseInt(String(townNum).replace(/[^0-9]/g, ""), 10)
  if (!Number.isFinite(n)) return ""
  return TOWN_NUM_TO_NAME[n] || ""
}
`

fs.writeFileSync(OUT, out)
console.log(`Wrote ${OUT} with ${Object.keys(map).length} towns.`)
