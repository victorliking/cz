export const MA_TOWNS = [
  "Abington", "Acton", "Acushnet", "Adams", "Agawam", "Amesbury", "Amherst",
  "Andover", "Arlington", "Ashburnham", "Ashby", "Ashland", "Athol", "Attleboro",
  "Auburn", "Avon", "Ayer", "Barnstable", "Barre", "Bedford", "Belchertown",
  "Bellingham", "Belmont", "Berkley", "Berlin", "Beverly", "Billerica",
  "Blackstone", "Bolton", "Boston", "Bourne", "Boxborough", "Boxford",
  "Boylston", "Braintree", "Brewster", "Bridgewater", "Brockton", "Brookline",
  "Burlington", "Cambridge", "Canton", "Carlisle", "Carver", "Charlton",
  "Chatham", "Chelmsford", "Chelsea", "Chicopee", "Clinton", "Cohasset",
  "Concord", "Danvers", "Dartmouth", "Dedham", "Dennis", "Dighton", "Douglas",
  "Dover", "Dracut", "Dunstable", "Duxbury", "East Bridgewater", "Easthampton",
  "Easton", "Essex", "Everett", "Fairhaven", "Fall River", "Falmouth",
  "Fitchburg", "Foxboro", "Framingham", "Franklin", "Freetown", "Gardner",
  "Georgetown", "Gloucester", "Grafton", "Granby", "Great Barrington",
  "Greenfield", "Groton", "Groveland", "Halifax", "Hamilton", "Hanover",
  "Hanson", "Harvard", "Harwich", "Haverhill", "Hingham", "Holbrook",
  "Holden", "Holliston", "Holyoke", "Hopedale", "Hopkinton", "Hudson",
  "Hull", "Ipswich", "Kingston", "Lakeville", "Lancaster", "Lawrence", "Lee",
  "Leicester", "Lenox", "Leominster", "Lexington", "Lincoln", "Littleton",
  "Longmeadow", "Lowell", "Ludlow", "Lunenburg", "Lynn", "Lynnfield",
  "Malden", "Manchester", "Mansfield", "Marblehead", "Marlborough",
  "Marshfield", "Mashpee", "Mattapoisett", "Maynard", "Medfield", "Medford",
  "Medway", "Melrose", "Mendon", "Merrimac", "Methuen", "Middleboro",
  "Middleton", "Milford", "Millbury", "Millis", "Milton", "Monson",
  "Nahant", "Nantucket", "Natick", "Needham", "New Bedford", "Newbury",
  "Newburyport", "Newton", "Norfolk", "North Adams", "North Andover",
  "North Attleboro", "North Reading", "Northampton", "Northborough",
  "Northbridge", "Norton", "Norwell", "Norwood", "Orange", "Orleans",
  "Oxford", "Palmer", "Paxton", "Peabody", "Pembroke", "Pepperell",
  "Pittsfield", "Plainville", "Plymouth", "Princeton", "Provincetown",
  "Quincy", "Randolph", "Raynham", "Reading", "Rehoboth", "Revere",
  "Rochester", "Rockland", "Rockport", "Rowley", "Rutland", "Salem",
  "Salisbury", "Sandwich", "Saugus", "Scituate", "Seekonk", "Sharon",
  "Shelburne", "Sherborn", "Shirley", "Shrewsbury", "Somerset", "Somerville",
  "South Hadley", "Southborough", "Southbridge", "Spencer", "Springfield",
  "Sterling", "Stockbridge", "Stoneham", "Stoughton", "Stow", "Sturbridge",
  "Sudbury", "Sutton", "Swampscott", "Swansea", "Taunton", "Templeton",
  "Tewksbury", "Topsfield", "Townsend", "Tyngsborough", "Upton", "Uxbridge",
  "Wakefield", "Walpole", "Waltham", "Ware", "Wareham", "Watertown",
  "Wayland", "Webster", "Wellesley", "Wenham", "West Boylston",
  "West Bridgewater", "West Newbury", "West Springfield", "Westborough",
  "Westfield", "Westford", "Westminster", "Weston", "Westport", "Westwood",
  "Weymouth", "Whitman", "Wilbraham", "Wilmington", "Winchester", "Winthrop",
  "Woburn", "Worcester", "Wrentham", "Yarmouth",
]

export const COMMON_COMMUTE_DESTINATIONS = [
  "Boston, MA",
  "Cambridge, MA",
  "Kendall Square, Cambridge",
  "Harvard Square, Cambridge",
  "Back Bay, Boston",
  "Financial District, Boston",
  "Seaport District, Boston",
  "Longwood Medical Area, Boston",
  "MIT, Cambridge",
  "Boston University",
  "Northeastern University",
  "Waltham, MA",
  "Burlington, MA",
  "Framingham, MA",
  "Woburn, MA",
  "Newton, MA",
  "Quincy, MA",
  "Somerville, MA",
  "Brookline, MA",
]

const MA_TOWN_LOOKUP = new Map(MA_TOWNS.map((t) => [t.toLowerCase(), t]))

/**
 * Normalize submitted target areas to canonical MA town names.
 *
 * Server-side backstop against unvalidated intake input (e.g. a buyer typing
 * "1", "Bostn", or "downtown"): unrecognized entries are dropped so they never
 * become an impossible `city IN (...)` hard filter. Returns the canonical-cased
 * subset; an empty array means "no usable town filter" (the matcher then falls
 * back to no city filter rather than matching nothing).
 */
export function normalizeTargetCities(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  const out: string[] = []
  for (const raw of input) {
    if (typeof raw !== "string") continue
    const hit = MA_TOWN_LOOKUP.get(raw.trim().toLowerCase())
    if (hit && !out.includes(hit)) out.push(hit)
  }
  return out
}
