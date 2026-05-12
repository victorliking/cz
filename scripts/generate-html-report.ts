/**
 * Generate professional HTML buyer report with real MLS recommendations.
 * English version, no emoji, detailed explanations.
 */

import { generatePortrait, ARCHETYPES } from '../lib/portrait/generate-portrait'
import { matchListings, ListingForMatch } from '../lib/scoring/match-engine'
import { batchCommuteForTopListings, ListingCommute } from '../lib/geo/commute'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

const BUYER_ANSWERS = {
  budget: {
    budgetRange: [1000000, 1200000],
    cityBreakdown: [
      { city: 'Cambridge', maxPrice: 1200000, taxRate: 1.2 },
      { city: 'Somerville', maxPrice: 1100000, taxRate: 1.3 },
      { city: 'Arlington', maxPrice: 1000000, taxRate: 1.1 },
      { city: 'Medford', maxPrice: 950000, taxRate: 1.2 },
    ],
  },
  target_areas: ['Cambridge', 'Somerville', 'Arlington', 'Medford'],
  commute_anchors: ['Kendall Square, Cambridge', 'Boston University'],
  bedrooms_min: '3',
  bathrooms_min: '1.5',
  property_types: ['SFH', 'CONDO', 'TOWNHOUSE'],
  priority_ranking: [
    'Location & commute',
    'Natural light & views',
    'Space & square footage',
    'Schools & family-friendliness',
    'Outdoor space & yard',
    'Kitchen & entertaining',
    'Privacy & quiet',
    'Finishes & move-in ready',
  ],
  saturday_morning: ['farmers market', 'playground with kids', 'bike ride'],
  hosting_scenario: 'dinner parties for 6-8 friends monthly',
  renovation_appetite: 'minor cosmetic only',
  home_style: ['Colonial', 'Victorian', 'Contemporary'],
  home_era: 'pre-war charm with updates',
  home_features: ['hardwood floors', 'fireplace', 'updated kitchen'],
  light_preference: 'lots of natural light, south-facing preferred',
  pain_points: ['busy road', 'no parking', 'dark rooms', 'long commute'],
  move_timeline: '3-6 months',
  budget_flexibility: 'Could stretch 10-15% for the right home',
  open_text: {
    threeWords: 'bright, spacious, walkable',
    anythingElse: 'We want a home where our toddler can play safely and we can bike to work. Community feel is important.',
  },
}

async function main() {
  const portrait = generatePortrait(BUYER_ANSWERS)
  const archetypeInfo = Object.values(ARCHETYPES).find(a => a.type === portrait.archetype.type)

  // Fetch and score listings
  const maxPrice = Math.round(portrait.budget.stretch * 1.15)
  const dbListings = await prisma.listing.findMany({
    where: {
      status: 'ACTIVE',
      listPrice: { lte: maxPrice },
      city: { in: portrait.hardFilters.targetCities, mode: 'insensitive' },
      bedrooms: { gte: portrait.hardFilters.minBedrooms },
    },
    orderBy: { listPrice: 'asc' },
  })

  const listings: ListingForMatch[] = dbListings.map(listing => {
    const vector = listing.vector as any || {}
    return {
      id: listing.id,
      address: listing.address,
      city: listing.city,
      price: listing.listPrice,
      bedrooms: listing.bedrooms,
      bathrooms: listing.bathroomsFull + listing.bathroomsHalf * 0.5,
      sqft: listing.interiorSqft || 0,
      yearBuilt: listing.yearBuilt || 0,
      propertyType: listing.propertyType,
      dimensions: {
        style: vector.style || vector._mls?.style || undefined,
        natural_light: vector.natural_light || undefined,
        noise_level: vector.noise_level || undefined,
        openness: vector.openness || undefined,
        yard_usability: vector.yard_usability || undefined,
        move_in_readiness: vector.move_in_readiness || undefined,
        privacy: vector.privacy_from_neighbors || undefined,
      },
      imageUrl: listing.photos?.[0] || undefined,
      photos: (listing.photos || []).slice(0, 5) as string[],
      description: listing.agentNotes || undefined,
    }
  })

  const matches = matchListings(portrait, listings)
  const top5 = matches.slice(0, 5)
  const totalDB = await prisma.listing.count()

  // Calculate real commute times for top 5 only (saves API calls)
  console.log('Calculating commute times for top 5 listings...')
  const commuteMap = await batchCommuteForTopListings(
    top5.map(m => ({ address: m.listing.address, city: m.listing.city })),
    portrait.hardFilters.commuteAnchors,
    ['bicycling', 'driving']
  )

  // Attach commute data to matches
  for (const match of top5) {
    const key = `${match.listing.address}, ${match.listing.city}, MA`
    ;(match as any).commute = commuteMap.get(key) || null
  }

  console.log('Commute data calculated. Generating report...')

  // Generate HTML
  const html = buildHTML(portrait, archetypeInfo, top5, {
    totalDB,
    matchedFilters: dbListings.length,
    scored: matches.length,
    recommended: matches.filter(m => m.score >= 50).length,
  })

  const outPath = path.join(process.cwd(), 'reports', 'buyer-report.html')
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, html)
  console.log(`Report saved to: ${outPath}`)

  await prisma.$disconnect()
}

function buildHTML(portrait: any, archetypeInfo: any, top5: any[], stats: any): string {
  const date = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
    timeZone: 'America/New_York',
  })

  const priorityRows = portrait.priorities.map((p: any) => `
    <tr>
      <td class="rank">${p.rank}</td>
      <td class="priority-name">${p.item}</td>
      <td class="priority-bar">
        <div class="bar-container">
          <div class="bar-fill" style="width: ${Math.round(p.weight * 100 * 4)}%"></div>
        </div>
      </td>
      <td class="priority-pct">${Math.round(p.weight * 100)}%</td>
    </tr>
  `).join('')

  const listingCards = top5.map((match, i) => {
    const listing = match.listing
    const reasons = generateDetailedReasons(portrait, match)
    const concerns = generateDetailedConcerns(portrait, match)
    const budgetLabel = listing.price <= portrait.budget.comfortable
      ? '<span class="badge badge-green">Within Comfortable Budget</span>'
      : listing.price <= portrait.budget.stretch
        ? '<span class="badge badge-yellow">Within Stretch Budget</span>'
        : '<span class="badge badge-red">Above Stretch Budget</span>'

    const verdictLabel = match.verdict === 'strong' ? 'Strong Match'
      : match.verdict === 'good' ? 'Recommended'
      : match.verdict === 'fair' ? 'Worth Considering' : 'Marginal'

    const verdictClass = match.verdict === 'strong' ? 'verdict-strong'
      : match.verdict === 'good' ? 'verdict-good'
      : match.verdict === 'fair' ? 'verdict-fair' : 'verdict-weak'

    return `
    <div class="listing-card">
      <div class="listing-header">
        <div class="listing-rank">#${i + 1}</div>
        <div class="listing-score">
          <div class="score-circle ${verdictClass}">${match.score}%</div>
          <div class="score-label">${verdictLabel}</div>
        </div>
      </div>

      <div class="listing-details">
        <h3>${listing.address}, ${listing.city}</h3>
        <div class="listing-meta">
          <div class="meta-item"><strong>List Price:</strong> $${listing.price.toLocaleString()} ${budgetLabel}</div>
          <div class="meta-item"><strong>Bedrooms / Bathrooms:</strong> ${listing.bedrooms} BR / ${listing.bathrooms} BA</div>
          <div class="meta-item"><strong>Interior Size:</strong> ${listing.sqft.toLocaleString()} sq ft</div>
          <div class="meta-item"><strong>Year Built:</strong> ${listing.yearBuilt || 'Unknown'}</div>
          <div class="meta-item"><strong>Property Type:</strong> ${listing.propertyType}</div>
          <div class="meta-item"><strong>Architectural Style:</strong> ${listing.dimensions.style || 'Not specified'}</div>
        </div>
        ${listing.photos && listing.photos.length > 0 ? `
        <div class="photo-gallery">
          ${listing.photos.map((url: string, idx: number) => `<img src="${url}" alt="${listing.address} - Photo ${idx + 1}" />`).join('')}
        </div>` : ''}
      </div>

      ${match.commute && match.commute.commutes.length > 0 ? `
      <div class="commute-section">
        <h4>Commute Analysis</h4>
        <div class="commute-grid">
          ${match.commute.commutes.map((c: any) => `
          <div class="commute-item">
            <div class="commute-dest">${c.destination}</div>
            <div class="commute-time">${c.durationText}</div>
            <div class="commute-mode">${c.mode === 'bicycling' ? 'By Bike' : 'By Car'} &middot; ${c.distanceText}</div>
          </div>`).join('')}
        </div>
      </div>` : ''}

      <div class="listing-analysis">
        <div class="analysis-section reasons">
          <h4>Why We Recommend This Property</h4>
          <ul>
            ${reasons.map(r => `<li>${r}</li>`).join('')}
          </ul>
        </div>

        <div class="analysis-section concerns">
          <h4>Considerations &amp; Trade-offs</h4>
          <ul>
            ${concerns.map(c => `<li>${c}</li>`).join('')}
          </ul>
        </div>
      </div>

      ${listing.description ? `
      <div class="listing-description">
        <h4>Listing Description</h4>
        <p>${listing.description.substring(0, 300)}${listing.description.length > 300 ? '...' : ''}</p>
      </div>` : ''}
    </div>`
  }).join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Buyer Search Report | HomeMatch</title>
  <style>
    :root {
      --primary: #1a365d;
      --secondary: #2d5a87;
      --accent: #c9a961;
      --text: #2d3748;
      --text-light: #4a5568;
      --bg: #ffffff;
      --bg-alt: #f7fafc;
      --border: #e2e8f0;
      --green: #276749;
      --green-bg: #f0fff4;
      --yellow: #975a16;
      --yellow-bg: #fffff0;
      --red: #9b2c2c;
      --red-bg: #fff5f5;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Georgia', 'Times New Roman', serif;
      color: var(--text);
      line-height: 1.7;
      background: var(--bg);
      max-width: 900px;
      margin: 0 auto;
      padding: 60px 40px;
    }

    h1, h2, h3, h4 {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      color: var(--primary);
    }

    /* Header */
    .report-header {
      text-align: center;
      border-bottom: 3px solid var(--primary);
      padding-bottom: 30px;
      margin-bottom: 50px;
    }
    .report-header h1 {
      font-size: 28px;
      letter-spacing: 1px;
      margin-bottom: 8px;
    }
    .report-header .subtitle {
      font-size: 14px;
      color: var(--text-light);
      text-transform: uppercase;
      letter-spacing: 2px;
    }
    .report-header .date {
      margin-top: 12px;
      font-size: 13px;
      color: var(--text-light);
    }

    /* Sections */
    .section {
      margin-bottom: 45px;
    }
    .section h2 {
      font-size: 18px;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      border-bottom: 1px solid var(--border);
      padding-bottom: 10px;
      margin-bottom: 20px;
    }

    /* Profile Grid */
    .profile-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px 30px;
    }
    .profile-item {
      font-size: 14px;
    }
    .profile-item strong {
      color: var(--primary);
    }

    /* Archetype */
    .archetype-box {
      background: var(--bg-alt);
      border-left: 4px solid var(--accent);
      padding: 24px 28px;
      margin-bottom: 20px;
    }
    .archetype-box h3 {
      font-size: 20px;
      margin-bottom: 4px;
    }
    .archetype-box .headline {
      font-style: italic;
      color: var(--text-light);
      margin-bottom: 16px;
    }
    .archetype-box p {
      font-size: 14px;
      margin-bottom: 12px;
    }

    /* Priority Table */
    .priority-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }
    .priority-table th {
      text-align: left;
      padding: 8px;
      border-bottom: 2px solid var(--primary);
      font-family: 'Helvetica Neue', Arial, sans-serif;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--text-light);
    }
    .priority-table td {
      padding: 8px;
      border-bottom: 1px solid var(--border);
    }
    .rank { width: 40px; text-align: center; font-weight: bold; color: var(--primary); }
    .priority-name { width: 240px; }
    .priority-bar { width: 200px; }
    .priority-pct { width: 50px; text-align: right; font-weight: bold; }
    .bar-container {
      background: #edf2f7;
      height: 12px;
      border-radius: 6px;
      overflow: hidden;
    }
    .bar-fill {
      background: var(--secondary);
      height: 100%;
      border-radius: 6px;
    }

    /* Insights */
    .insight-list {
      list-style: none;
      padding: 0;
    }
    .insight-list li {
      padding: 10px 0;
      border-bottom: 1px solid var(--border);
      font-size: 14px;
    }
    .insight-list li:last-child { border-bottom: none; }

    /* Listing Cards */
    .listing-card {
      border: 1px solid var(--border);
      margin-bottom: 35px;
      page-break-inside: avoid;
    }
    .listing-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: var(--primary);
      color: white;
      padding: 16px 24px;
    }
    .listing-rank {
      font-size: 24px;
      font-weight: bold;
      font-family: 'Helvetica Neue', Arial, sans-serif;
    }
    .listing-score {
      text-align: right;
    }
    .score-circle {
      font-size: 28px;
      font-weight: bold;
      font-family: 'Helvetica Neue', Arial, sans-serif;
    }
    .verdict-strong { color: #48bb78; }
    .verdict-good { color: #68d391; }
    .verdict-fair { color: #f6e05e; }
    .verdict-weak { color: #fc8181; }
    .score-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1px;
      opacity: 0.8;
    }

    .listing-details {
      padding: 24px;
      background: var(--bg-alt);
      border-bottom: 1px solid var(--border);
    }
    .listing-details h3 {
      font-size: 18px;
      margin-bottom: 12px;
    }
    .listing-meta {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      font-size: 13px;
    }
    .meta-item strong {
      color: var(--primary);
    }
    .photo-gallery {
      margin-top: 16px;
      display: grid;
      grid-template-columns: 2fr 1fr 1fr;
      grid-template-rows: 180px 180px;
      gap: 4px;
      border-radius: 4px;
      overflow: hidden;
    }
    .photo-gallery img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .photo-gallery img:first-child {
      grid-row: 1 / 3;
    }

    .listing-analysis {
      padding: 24px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
    }
    .analysis-section h4 {
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 12px;
      color: var(--secondary);
    }
    .analysis-section ul {
      list-style: none;
      padding: 0;
    }
    .analysis-section li {
      font-size: 13px;
      padding: 6px 0;
      border-bottom: 1px solid var(--border);
      line-height: 1.5;
    }
    .analysis-section li:last-child { border-bottom: none; }
    .reasons li::before { content: "+  "; color: var(--green); font-weight: bold; }
    .concerns li::before { content: "~  "; color: var(--yellow); font-weight: bold; }

    /* Commute Section */
    .commute-section {
      padding: 16px 24px;
      border-bottom: 1px solid var(--border);
      background: #f0f7ff;
    }
    .commute-section h4 {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--secondary);
      margin-bottom: 12px;
    }
    .commute-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .commute-item {
      padding: 10px 14px;
      background: white;
      border: 1px solid var(--border);
      border-radius: 4px;
    }
    .commute-dest {
      font-size: 11px;
      color: var(--text-light);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    .commute-time {
      font-size: 20px;
      font-weight: bold;
      color: var(--primary);
      font-family: 'Helvetica Neue', Arial, sans-serif;
    }
    .commute-mode {
      font-size: 12px;
      color: var(--text-light);
      margin-top: 2px;
    }

    .listing-description {
      padding: 16px 24px 24px;
      border-top: 1px solid var(--border);
    }
    .listing-description h4 {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--text-light);
      margin-bottom: 8px;
    }
    .listing-description p {
      font-size: 13px;
      color: var(--text-light);
      font-style: italic;
    }

    /* Badges */
    .badge {
      display: inline-block;
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 3px;
      font-family: 'Helvetica Neue', Arial, sans-serif;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-left: 8px;
    }
    .badge-green { background: var(--green-bg); color: var(--green); border: 1px solid var(--green); }
    .badge-yellow { background: var(--yellow-bg); color: var(--yellow); border: 1px solid var(--yellow); }
    .badge-red { background: var(--red-bg); color: var(--red); border: 1px solid var(--red); }

    /* Stats */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 30px;
    }
    .stat-box {
      text-align: center;
      padding: 16px;
      background: var(--bg-alt);
      border: 1px solid var(--border);
    }
    .stat-box .stat-number {
      font-size: 28px;
      font-weight: bold;
      color: var(--primary);
      font-family: 'Helvetica Neue', Arial, sans-serif;
    }
    .stat-box .stat-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--text-light);
      margin-top: 4px;
    }

    /* Summary */
    .summary-box {
      background: var(--bg-alt);
      border: 1px solid var(--border);
      padding: 24px 28px;
    }
    .summary-box h4 {
      margin-bottom: 12px;
    }
    .summary-box p {
      font-size: 14px;
      margin-bottom: 10px;
    }
    .next-steps {
      list-style: decimal;
      padding-left: 20px;
      font-size: 14px;
    }
    .next-steps li {
      padding: 4px 0;
    }

    /* Footer */
    .report-footer {
      margin-top: 50px;
      padding-top: 20px;
      border-top: 1px solid var(--border);
      font-size: 12px;
      color: var(--text-light);
      text-align: center;
    }

    @media print {
      body { padding: 30px; }
      .listing-card { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <header class="report-header">
    <h1>Buyer Search Report</h1>
    <div class="subtitle">HomeMatch &mdash; Personalized Property Matching</div>
    <div class="date">Prepared on ${date}</div>
  </header>

  <!-- SECTION 1: BUYER PROFILE -->
  <div class="section">
    <h2>Client Profile</h2>
    <div class="profile-grid">
      <div class="profile-item"><strong>Budget Range:</strong> $${portrait.budget.comfortable.toLocaleString()} &ndash; $${portrait.budget.stretch.toLocaleString()}</div>
      <div class="profile-item"><strong>Flexibility:</strong> ${portrait.budget.flexibility || 'Standard'}</div>
      <div class="profile-item"><strong>Target Areas:</strong> ${portrait.hardFilters.targetCities.join(', ')}</div>
      <div class="profile-item"><strong>Property Types:</strong> ${portrait.hardFilters.propertyTypes.join(', ') || 'All'}</div>
      <div class="profile-item"><strong>Minimum Bedrooms:</strong> ${portrait.hardFilters.minBedrooms}</div>
      <div class="profile-item"><strong>Minimum Bathrooms:</strong> ${portrait.hardFilters.minBathrooms}</div>
      <div class="profile-item"><strong>Commute Anchors:</strong> ${portrait.hardFilters.commuteAnchors.join('; ')}</div>
      <div class="profile-item"><strong>Timeline:</strong> ${portrait.timeline || 'Flexible'}</div>
      <div class="profile-item"><strong>Style Preferences:</strong> ${portrait.homePreferences.styles.join(', ') || 'Open'}</div>
      <div class="profile-item"><strong>Light Preference:</strong> ${portrait.homePreferences.lightPreference || 'No specific preference'}</div>
    </div>
  </div>

  <!-- SECTION 2: BUYER ARCHETYPE -->
  <div class="section">
    <h2>Buyer Archetype</h2>
    <div class="archetype-box">
      <h3>${portrait.archetype.type}</h3>
      <div class="headline">${portrait.archetype.headline}</div>
      ${archetypeInfo ? archetypeInfo.description.split('\n\n').map((p: string) => `<p>${p.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</p>`).join('') : ''}
    </div>
  </div>

  <!-- SECTION 3: PRIORITY RANKING -->
  <div class="section">
    <h2>Priority Ranking</h2>
    <table class="priority-table">
      <thead>
        <tr><th>Rank</th><th>Dimension</th><th>Weight</th><th></th></tr>
      </thead>
      <tbody>
        ${priorityRows}
      </tbody>
    </table>
  </div>

  <!-- SECTION 4: KEY INSIGHTS -->
  <div class="section">
    <h2>Key Insights</h2>
    <ul class="insight-list">
      ${portrait.prose.map((p: string) => `<li>${p}</li>`).join('')}
    </ul>
  </div>

  ${portrait.blindSpots.length > 0 ? `
  <!-- SECTION 5: BLIND SPOTS -->
  <div class="section">
    <h2>Blind Spots &amp; Considerations</h2>
    <ul class="insight-list">
      ${portrait.blindSpots.map((s: string) => `<li>${s}</li>`).join('')}
    </ul>
  </div>` : ''}

  <!-- SECTION 6: SEARCH STRATEGY -->
  <div class="section">
    <h2>Recommended Search Strategy</h2>
    <p style="font-size: 14px;">${portrait.searchStrategy}</p>
  </div>

  <!-- SECTION 7: DEAL BREAKERS -->
  <div class="section">
    <h2>Deal Breakers</h2>
    <ul class="insight-list">
      ${portrait.dealbreakers.map((d: string) => `<li>${d}</li>`).join('')}
    </ul>
  </div>

  <!-- SECTION 8: MARKET RECOMMENDATIONS -->
  <div class="section">
    <h2>Top 5 Property Recommendations</h2>

    <div class="stats-grid">
      <div class="stat-box">
        <div class="stat-number">${stats.totalDB.toLocaleString()}</div>
        <div class="stat-label">Total Inventory</div>
      </div>
      <div class="stat-box">
        <div class="stat-number">${stats.matchedFilters}</div>
        <div class="stat-label">Met Hard Filters</div>
      </div>
      <div class="stat-box">
        <div class="stat-number">${stats.scored}</div>
        <div class="stat-label">Scored &amp; Ranked</div>
      </div>
      <div class="stat-box">
        <div class="stat-number">${stats.recommended}</div>
        <div class="stat-label">Recommended</div>
      </div>
    </div>

    ${listingCards}
  </div>

  <!-- SUMMARY -->
  <div class="section">
    <h2>Summary &amp; Next Steps</h2>
    <div class="summary-box">
      <p>Based on your profile as <strong>${portrait.archetype.type}</strong>, we searched ${stats.matchedFilters} properties in ${portrait.hardFilters.targetCities.join(', ')} within your budget range of $${portrait.budget.comfortable.toLocaleString()}&ndash;$${portrait.budget.stretch.toLocaleString()}. The above five represent the strongest alignment with your stated priorities of <em>${portrait.priorities[0].item}</em> and <em>${portrait.priorities[1].item}</em>.</p>
      <h4>Recommended Next Steps</h4>
      <ol class="next-steps">
        <li>Schedule viewings for properties #1 and #2 (highest overall match scores).</li>
        <li>Consider a drive-by of #3 and #4 to evaluate neighborhood feel in person.</li>
        <li>Monitor #5 for price adjustments &mdash; it offers strong value at its current price point.</li>
        <li>Revisit priority weights after your first viewing to refine future recommendations.</li>
      </ol>
    </div>
  </div>

  <footer class="report-footer">
    <p>HomeMatch Buyer Search Report &mdash; Generated ${date}</p>
    <p>Data sourced from MLS PIN. Information deemed reliable but not guaranteed.</p>
  </footer>
</body>
</html>`
}

function generateDetailedReasons(portrait: any, match: any): string[] {
  const reasons: string[] = []
  const listing = match.listing

  // Budget analysis
  const budgetPct = Math.round((listing.price / portrait.budget.stretch) * 100)
  if (budgetPct <= 85) {
    reasons.push(`Priced at $${listing.price.toLocaleString()}, this property falls well within your comfortable budget, leaving approximately $${(portrait.budget.comfortable - listing.price).toLocaleString()} in headroom for closing costs, immediate repairs, or furnishing.`)
  } else if (budgetPct <= 100) {
    reasons.push(`At $${listing.price.toLocaleString()}, this property is within your stretch budget (${budgetPct}% of maximum). Given current market conditions in ${listing.city}, this represents fair market value for the size and location.`)
  } else {
    reasons.push(`Listed at $${listing.price.toLocaleString()} (${budgetPct - 100}% above your stretch budget). We include it because the combination of location, size, and condition scores significantly above other options. With your stated flexibility of 10-15%, this remains achievable.`)
  }

  // Space analysis
  if (listing.sqft >= 2000) {
    reasons.push(`At ${listing.sqft.toLocaleString()} sq ft, this property exceeds the typical family threshold and directly addresses your #3 priority (Space & square footage). This size comfortably accommodates your hosting needs for 6-8 guests while providing dedicated workspace.`)
  } else if (listing.sqft >= 1500) {
    reasons.push(`The ${listing.sqft.toLocaleString()} sq ft interior provides adequate living space, though you may need to be strategic about dual-purpose rooms for hosting and home office needs.`)
  }

  // Bedrooms
  if (listing.bedrooms >= portrait.hardFilters.minBedrooms + 1) {
    reasons.push(`With ${listing.bedrooms} bedrooms (exceeding your minimum of ${portrait.hardFilters.minBedrooms}), you gain flexibility for a dedicated home office, guest room, or future family growth without needing to move again within 5-7 years.`)
  }

  // Style match
  if (listing.dimensions.style && portrait.homePreferences.styles.length > 0) {
    const styleMatch = portrait.homePreferences.styles.some(
      (s: string) => listing.dimensions.style?.toLowerCase().includes(s.toLowerCase())
    )
    if (styleMatch) {
      reasons.push(`The ${listing.dimensions.style} architecture aligns directly with your stated style preferences. These homes typically feature the character elements you value: hardwood floors, detailed moldings, and established landscaping.`)
    }
  }

  // Year built
  if (listing.yearBuilt && listing.yearBuilt < 1950 && portrait.homePreferences.era?.includes('pre-war')) {
    reasons.push(`Built in ${listing.yearBuilt}, this home embodies the "pre-war charm with updates" aesthetic you described. Properties of this era in ${listing.city} typically feature solid construction, higher ceilings, and mature neighborhood plantings.`)
  }

  // Location / commute
  if (listing.city === 'Cambridge') {
    reasons.push(`Located in Cambridge, your primary commute to Kendall Square would be minimal. This directly serves your #1 priority (Location & commute) and supports the bike-friendly lifestyle you described.`)
  } else if (listing.city === 'Somerville') {
    reasons.push(`Somerville's proximity to Cambridge makes your Kendall Square commute highly manageable by bike or transit. The city also offers the walkable, community-oriented atmosphere you described wanting.`)
  } else if (listing.city === 'Medford') {
    reasons.push(`Located in Medford, which offers significantly more space for the dollar compared to Cambridge proper. The trade-off is a slightly longer commute, but the neighborhood character and lot sizes often appeal to growing families.`)
  } else if (listing.city === 'Arlington') {
    reasons.push(`Arlington combines suburban lot sizes with reasonable transit access. The town center provides the walkability you value, and the school system is well-regarded for families.`)
  }

  return reasons
}

function generateDetailedConcerns(portrait: any, match: any): string[] {
  const concerns: string[] = []
  const listing = match.listing

  // Budget concern
  if (listing.price > portrait.budget.stretch) {
    const overPct = Math.round(((listing.price - portrait.budget.stretch) / portrait.budget.stretch) * 100)
    concerns.push(`This property exceeds your stretch budget by ${overPct}%. Before proceeding, confirm your pre-approval covers this amount and verify the monthly payment (estimated $${Math.round(listing.price * 0.006).toLocaleString()}/mo at current rates) aligns with your comfort level.`)
  } else if (listing.price > portrait.budget.comfortable) {
    concerns.push(`While within your stretch range, the price leaves less buffer for unexpected repairs. Pre-war homes often need updated electrical, plumbing, or HVAC systems. Budget an additional inspection contingency.`)
  }

  // Commute (if not Cambridge)
  if (listing.city !== 'Cambridge' && listing.city !== 'Somerville') {
    concerns.push(`Your primary commute destination (Kendall Square) is not within immediate biking distance from ${listing.city}. Verify the actual commute time via your preferred mode before committing &mdash; consider testing the route during rush hour.`)
  }

  // Schools default warning
  concerns.push(`School district data has not been verified for this specific address. If school quality is a decision factor, confirm the exact school assignments with the district before making an offer, as boundaries can shift.`)

  // Outdoor space
  if (listing.propertyType === 'CONDO') {
    concerns.push(`As a condominium, outdoor space is typically limited to a balcony or shared courtyard. Given your interest in outdoor space for your toddler, evaluate whether nearby parks adequately meet this need.`)
  } else if (listing.sqft && listing.sqft < 1800) {
    concerns.push(`The lot size may limit usable outdoor space. Visit in person to assess whether the yard meets your family's needs for safe outdoor play.`)
  }

  // Age-related
  if (listing.yearBuilt && listing.yearBuilt < 1940) {
    concerns.push(`Built in ${listing.yearBuilt}, be aware of potential age-related issues: lead paint remediation, knob-and-tube wiring, older plumbing, or foundation concerns. A thorough inspection is essential. Your stated appetite for "minor cosmetic only" renovation means significant systems work would be a mismatch.`)
  }

  return concerns
}

main().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
