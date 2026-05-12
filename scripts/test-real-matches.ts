/**
 * 完整买家报告：侧写分析 + TOP 5 真实房源推荐
 */

import { generatePortrait, ARCHETYPES } from '../lib/portrait/generate-portrait'
import { matchListings, ListingForMatch } from '../lib/scoring/match-engine'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// 模拟买家问卷答案
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

  // ═══════════════════════════════════════════════════
  // PART 1: 买家侧写报告
  // ═══════════════════════════════════════════════════
  console.log(`
╔═══════════════════════════════════════════════════════════════════════════╗
║                                                                         ║
║          HomeMatch 买家侧写报告 / Buyer Portrait Report                  ║
║                                                                         ║
╚═══════════════════════════════════════════════════════════════════════════╝

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  📋 基本信息 / Basic Profile
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  💰 预算范围: $${portrait.budget.comfortable.toLocaleString()} – $${portrait.budget.stretch.toLocaleString()}
     灵活度: ${portrait.budget.flexibility || 'N/A'}
  📍 目标城市: ${portrait.hardFilters.targetCities.join(', ')}
  🏠 房型: ${portrait.hardFilters.propertyTypes.join(', ') || 'All'}
  🛏️  最低: ${portrait.hardFilters.minBedrooms} 卧 / ${portrait.hardFilters.minBathrooms} 卫
  🚗 通勤锚点: ${portrait.hardFilters.commuteAnchors.join(' ← → ')}
  ⏰ 时间线: ${portrait.timeline || 'Flexible'}
  🎨 风格偏好: ${portrait.homePreferences.styles.join(', ') || 'Open'}
  💡 光线偏好: ${portrait.homePreferences.lightPreference || 'N/A'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  🧬 买家画像 / Buyer Archetype
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  类型: ${portrait.archetype.type}${archetypeInfo ? ` (${archetypeInfo.typeZh})` : ''}
  一句话: ${portrait.archetype.headline}
${archetypeInfo ? `\n${archetypeInfo.description.split('\n').map(l => '  ' + l).join('\n')}` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  🎯 优先级排序 / Priority Ranking
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`)

  for (const p of portrait.priorities) {
    const bar = '█'.repeat(Math.round(p.weight * 40))
    const pct = Math.round(p.weight * 100)
    console.log(`  #${p.rank} ${p.item.padEnd(30)} ${bar} ${pct}%`)
  }

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  💡 洞察分析 / Insights
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`)
  for (const insight of portrait.prose) {
    console.log(`  📌 ${insight}`)
  }

  if (portrait.blindSpots.length > 0) {
    console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ⚠️  盲点提醒 / Blind Spots
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`)
    for (const spot of portrait.blindSpots) {
      console.log(`  ⚡ ${spot}`)
    }
  }

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  🧭 搜索策略建议 / Search Strategy
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  ${portrait.searchStrategy}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  🚫 Deal Breakers
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  ${portrait.dealbreakers.map(d => `❌ ${d}`).join('\n  ')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  🌅 生活方式 / Lifestyle
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  周六早晨: ${portrait.lifestyle.saturdayMorning.join(', ')}
  待客风格: ${portrait.lifestyle.hostingStyle || 'N/A'}
  装修意愿: ${portrait.lifestyle.renovationAppetite || 'N/A'}
  三个关键词: ${portrait.freeText.threeWords || 'N/A'}
  补充说明: ${portrait.freeText.notes || 'N/A'}
`)

  // ═══════════════════════════════════════════════════
  // PART 2: 真实房源推荐
  // ═══════════════════════════════════════════════════

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
      description: listing.agentNotes || undefined,
    }
  })

  const matches = matchListings(portrait, listings)
  const top5 = matches.slice(0, 5)

  console.log(`
╔═══════════════════════════════════════════════════════════════════════════╗
║                                                                         ║
║          TOP 5 房源推荐 / Listing Recommendations                        ║
║                                                                         ║
╚═══════════════════════════════════════════════════════════════════════════╝

  📊 数据总览:
     数据库总房源: ${await prisma.listing.count()}
     符合硬性条件: ${dbListings.length} 套
     评分并排序: ${matches.length} 套
     推荐 (≥50分): ${matches.filter(m => m.score >= 50).length} 套
`)

  for (let i = 0; i < top5.length; i++) {
    const match = top5[i]
    const listing = match.listing
    const matchPct = match.score
    
    // Generate personalized recommendation reason based on buyer's priorities
    const whyRecommend = generateWhyRecommend(portrait, match)
    
    const budgetPosition = listing.price <= portrait.budget.comfortable 
      ? '✅ 舒适预算内' 
      : listing.price <= portrait.budget.stretch 
        ? '🟡 需要拉伸预算' 
        : '🔴 超出预算'

    const bar = '█'.repeat(Math.round(matchPct / 5)) + '░'.repeat(20 - Math.round(matchPct / 5))

    console.log(`
  ┌─────────────────────────────────────────────────────────────────────┐
  │  #${i + 1}  匹配度: ${matchPct}% [${bar}]
  │      ${match.verdict === 'strong' ? '🏆 强烈推荐' : match.verdict === 'good' ? '✅ 推荐' : match.verdict === 'fair' ? '🔶 值得考虑' : '⚪ 一般'}
  ├─────────────────────────────────────────────────────────────────────┤
  │
  │  📍 ${listing.address}, ${listing.city}
  │  💰 $${listing.price.toLocaleString()}  ${budgetPosition}
  │  🏠 ${listing.bedrooms}卧 / ${listing.bathrooms}卫 | ${listing.sqft.toLocaleString()} sqft
  │  🏗️  建于${listing.yearBuilt}年 | ${listing.propertyType} | ${listing.dimensions.style || '未知风格'}
  │${listing.imageUrl ? `\n  │  📸 ${listing.imageUrl}` : ''}
  │
  │  ─── 为什么推荐这套给你 ───
  │
${whyRecommend.map(r => `  │  ${r}`).join('\n')}
  │`)

    if (match.concerns.length > 0) {
      console.log(`  │\n  │  ─── 需要注意 ───\n  │`)
      match.concerns.forEach(c => console.log(`  │  ⚠️  ${c}`))
    }

    if (listing.description) {
      const desc = listing.description.substring(0, 200).trim()
      console.log(`  │\n  │  ─── 房源描述 ───\n  │\n  │  "${desc}..."`)
    }

    console.log(`  │`)
    console.log(`  └─────────────────────────────────────────────────────────────────────┘`)
  }

  // Summary
  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  📋 总结 / Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  根据您的买家画像（${portrait.archetype.type}），在${portrait.hardFilters.targetCities.join('、')}
  范围内，预算 $${portrait.budget.comfortable.toLocaleString()}–$${portrait.budget.stretch.toLocaleString()}，
  我们从 ${dbListings.length} 套符合条件的房源中为您精选了以上 5 套。

  您最看重的是「${portrait.priorities[0].item}」和「${portrait.priorities[1].item}」，
  这些推荐主要基于：面积、风格匹配度、预算适配性进行排序。

  💡 下一步建议:
     1. 预约看房 #1 和 #2（匹配度最高）
     2. 关注 #5 的价格变动（性价比优势）
     3. 如有时间可以 drive-by #3 和 #4 感受社区氛围

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  报告生成时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'America/New_York' })}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`)

  await prisma.$disconnect()
}

/**
 * 基于买家画像生成个性化推荐理由
 */
function generateWhyRecommend(portrait: any, match: any): string[] {
  const reasons: string[] = []
  const listing = match.listing

  // 1. Budget fit
  const budgetPct = Math.round((listing.price / portrait.budget.stretch) * 100)
  if (budgetPct <= 85) {
    reasons.push(`💰 价格 $${listing.price.toLocaleString()} 在您舒适预算内，有议价空间或装修余裕`)
  } else if (budgetPct <= 100) {
    reasons.push(`💰 价格 $${listing.price.toLocaleString()} 在预算范围内 (占stretch预算${budgetPct}%)`)
  } else {
    reasons.push(`💰 价格 $${listing.price.toLocaleString()} 略超预算 (${budgetPct - 100}%)，但综合品质突出`)
  }

  // 2. Space (priority #3)
  if (listing.sqft >= 2000) {
    reasons.push(`📐 面积 ${listing.sqft.toLocaleString()} sqft，满足您对「Space & square footage」的重视`)
  } else if (listing.sqft >= 1500) {
    reasons.push(`📐 面积 ${listing.sqft.toLocaleString()} sqft，空间适中`)
  }

  // 3. Bedrooms
  if (listing.bedrooms >= portrait.hardFilters.minBedrooms + 1) {
    reasons.push(`🛏️  ${listing.bedrooms}卧超出最低要求，未来有成长空间（办公/客房）`)
  } else {
    reasons.push(`🛏️  ${listing.bedrooms}卧满足基本需求`)
  }

  // 4. Style match
  if (listing.dimensions.style && portrait.homePreferences.styles.length > 0) {
    const styleMatch = portrait.homePreferences.styles.some(
      (s: string) => listing.dimensions.style?.toLowerCase().includes(s.toLowerCase())
    )
    if (styleMatch) {
      reasons.push(`🎨 ${listing.dimensions.style} 风格与您偏好完全匹配`)
    }
  }

  // 5. Year built + era preference
  if (listing.yearBuilt && listing.yearBuilt < 1950 && portrait.homePreferences.era?.includes('pre-war')) {
    reasons.push(`🏛️  建于${listing.yearBuilt}年，符合您的「pre-war charm」偏好`)
  }

  // 6. Location
  reasons.push(`📍 位于${listing.city}，是您指定的目标区域之一`)

  // 7. Commute relevance
  if (listing.city === 'Cambridge') {
    reasons.push(`🚴 在Cambridge内，距离Kendall Square通勤便利`)
  } else if (listing.city === 'Somerville') {
    reasons.push(`🚴 Somerville紧邻Cambridge，骑行通勤可行`)
  }

  // 8. From existing match engine reasons
  for (const r of match.reasons) {
    if (!reasons.some(existing => existing.includes(r.substring(0, 15)))) {
      reasons.push(`✨ ${r}`)
    }
  }

  return reasons.slice(0, 6) // Max 6 reasons
}

main().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
