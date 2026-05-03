/**
 * Self Portrait Generator v2
 * Generates insight-driven buyer profile with contradiction detection,
 * hidden need inference, and natural language prose.
 */

export interface BuyerPortrait {
  archetype: {
    type: string
    headline: string
  }
  prose: string[]          // Natural language insight paragraphs
  blindSpots: string[]     // Things you didn't realize about yourself
  searchStrategy: string   // What type of home to actually look for
  budget: {
    comfortable: number
    stretch: number
    flexibility: string | null
    cities: { name: string; maxPrice: number; taxRate: number }[]
  }
  hardFilters: {
    minBedrooms: number
    minBathrooms: number
    propertyTypes: string[]
    targetCities: string[]
    commuteAnchors: string[]
  }
  homePreferences: {
    styles: string[]
    era: string | null
    features: string[]
    lightPreference: string | null
  }
  timeline: string | null
  priorities: { item: string; rank: number; weight: number }[]
  lifestyle: {
    saturdayMorning: string[]
    hostingStyle: string | null
    renovationAppetite: string | null
  }
  dealbreakers: string[]
  freeText: { threeWords: string | null; notes: string | null }
  // Legacy field for backwards compat
  insights: string[]
}

const RANK_WEIGHTS = [0.25, 0.20, 0.16, 0.13, 0.10, 0.07, 0.05, 0.04]

export function generatePortrait(answers: Record<string, any>): BuyerPortrait {
  // Parse raw answers
  const budgetData = answers.budget || {}
  const cityBreakdown = (budgetData.cityBreakdown || []).map((c: any) => ({
    name: c.city,
    maxPrice: c.maxPrice,
    taxRate: c.taxRate,
  }))

  const ranking = (answers.priority_ranking || []) as string[]
  const priorities = ranking.map((item, idx) => ({
    item,
    rank: idx + 1,
    weight: RANK_WEIGHTS[idx] || 0.03,
  }))

  const saturdayMorning = (answers.saturday_morning || []) as string[]
  const hostingStyle = (answers.hosting_scenario as string) || null
  const renovationAppetite = (answers.renovation_appetite as string) || null
  const dealbreakers = (answers.pain_points || []) as string[]
  const openText = answers.open_text as { threeWords?: string; anythingElse?: string } | undefined
  const freeText = {
    threeWords: openText?.threeWords || null,
    notes: openText?.anythingElse || null,
  }
  const bedroomsMin = parseInt(answers.bedrooms_min) || 1
  const targetCities = (answers.target_areas || []) as string[]
  const commuteAnchors = (answers.commute_anchors || []) as string[]

  // New dimensions
  const homeStyles = (answers.home_style || []) as string[]
  const homeEra = (answers.home_era as string) || null
  const homeFeatures = (answers.home_features || []) as string[]
  const lightPreference = (answers.light_preference as string) || null
  const moveTimeline = (answers.move_timeline as string) || null
  const budgetFlex = (answers.budget_flexibility as string) || null

  // --- Archetype ---
  const archetype = classifyArchetype(priorities, saturdayMorning, hostingStyle)

  // --- Generate prose insights ---
  const prose = generateProse(priorities, saturdayMorning, hostingStyle, dealbreakers, renovationAppetite, budgetData, bedroomsMin)

  // --- Detect blind spots / contradictions ---
  const blindSpots = detectBlindSpots(priorities, saturdayMorning, dealbreakers, renovationAppetite, bedroomsMin, budgetData, commuteAnchors, targetCities)

  // --- Search strategy ---
  const searchStrategy = generateStrategy(archetype.type, priorities, dealbreakers, renovationAppetite, budgetData)

  return {
    archetype,
    prose,
    blindSpots,
    searchStrategy,
    budget: {
      comfortable: budgetData.budgetRange?.[0] || 0,
      stretch: budgetData.budgetRange?.[1] || 0,
      flexibility: budgetFlex,
      cities: cityBreakdown,
    },
    hardFilters: {
      minBedrooms: bedroomsMin,
      minBathrooms: parseFloat(answers.bathrooms_min) || 1,
      propertyTypes: (answers.property_types || []) as string[],
      targetCities,
      commuteAnchors,
    },
    homePreferences: {
      styles: homeStyles,
      era: homeEra,
      features: homeFeatures,
      lightPreference,
    },
    timeline: moveTimeline,
    priorities,
    lifestyle: { saturdayMorning, hostingStyle, renovationAppetite },
    dealbreakers,
    freeText,
    insights: [], // kept for backwards compat
  }
}

// --- Archetype definitions ---
export interface ArchetypeInfo {
  type: string
  typeZh: string
  headline: string
  headlineZh: string
  description: string
  descriptionZh: string
}

export const ARCHETYPES: Record<string, ArchetypeInfo> = {
  nester: {
    type: "The Nester",
    typeZh: "安家型",
    headline: "You're building a home your family will grow into.",
    headlineZh: "你在为家人打造一个可以成长的家。",
    description: `Family is the center of every decision you make about housing. You don't just want a home — you want a foundation.

**How you think:** You evaluate every home through the lens of "will this work in 5 years?" You picture your kids walking to school, playing in the backyard, growing up in these rooms. You think about the neighborhood as much as the house — safe streets, good families nearby, a sense of community.

**What drives you:** School districts (you've probably already researched ratings), a quiet residential street, enough bedrooms to grow into, a yard with room to play. You want stability and roots.

**Your style:** You gravitate toward traditional homes — Colonials, Capes, Craftsmans. You like homes that feel "established" — mature trees, real neighborhoods, not brand-new developments. The kitchen needs to work for family life (quick breakfasts, homework at the counter, Sunday cooking).

**Watch out for:** You tend to over-index on schools and under-index on your own daily happiness. Make sure the commute doesn't destroy your evenings. Also: you often say 3 bedrooms but actually need 4 (office + future kid). Be honest about that now.

**Your ideal Saturday:** Kids are playing outside while you drink coffee by the window. You walk them to a nearby playground. The house is quiet enough to hear birds, close enough to walk somewhere for a pastry.`,
    descriptionZh: `家庭是你所有住房决策的核心。你不只是想要一个房子——你要的是一个根基。

**你的思考方式：** 你看每套房都会想"5年后还合适吗？"你会想象孩子走路上学、在后院玩耍、在这些房间里长大。你对社区的关注不亚于房子本身——安全的街道、好的邻居家庭、社区归属感。

**驱动你的东西：** 学区（你可能已经研究过评分了）、安静的住宅区、够用的卧室数、有活动空间的院子。你想要稳定和归属感。

**你的风格偏好：** 你倾向传统房型——Colonial、Cape、Craftsman。你喜欢"有沉淀感"的房子——成熟的大树、真正的社区、不是刚建好的开发项目。厨房需要适合家庭生活（快速早餐、孩子在吧台写作业、周日做饭）。

**注意事项：** 你容易过度关注学区而忽视自己的日常幸福感。确保通勤不会毁掉你的晚间生活。另外：你往往说3间卧室就够了，但其实需要4间（办公室+未来宝宝）。现在就对自己诚实。

**你理想的周六：** 孩子在外面玩，你在窗边喝咖啡。走路带他们去附近的游乐场。房子安静到能听到鸟鸣，又近到能步行去买个糕点。`,
  },
  urbanist: {
    type: "The Urbanist",
    typeZh: "都市型",
    headline: "You want to walk out the door and have life happen.",
    headlineZh: "你要的是出门就有生活。",
    description: `Convenience isn't a luxury for you — it's a requirement. The neighborhood IS the home.

**How you think:** You evaluate homes by what's within a 10-minute walk, not by square footage. A smaller place in the perfect location beats a mansion in the suburbs every time. You'd rather bike to work than have a three-car garage.

**What drives you:** Walk Score, transit access, the café on the corner, the grocery store two blocks away. You want to feel the energy of a neighborhood. Driving everywhere feels like a failure of planning.

**Your style:** You're drawn to village centers, main street adjacency, townhouses with character. You appreciate density done well — not cookie-cutter, but curated. You'd pick a renovated 1920s apartment over a 2020 suburban box.

**Watch out for:** You sometimes sacrifice too much space for location. Make sure you actually have room to live, work from home, and store your things. Also: walkable streets are louder — you'll need to find the sweet spot (side street, 2 blocks from Main).

**Your ideal Saturday:** You walk to get coffee, browse a farmers market, grab lunch at a neighborhood spot — all without touching your car keys. The house is your base camp, not your whole world.`,
    descriptionZh: `便利对你不是奢侈品——是必需品。社区本身就是你的家。

**你的思考方式：** 你评价房子不看面积，看10分钟步行范围内有什么。完美位置的小房子永远赢过郊区的大豪宅。你宁可骑车上班也不要三车位车库。

**驱动你的东西：** Walk Score、公交可达性、街角的咖啡店、两条街外的超市。你想感受社区的活力。到处开车对你来说是规划的失败。

**你的风格偏好：** 你喜欢 village center、靠近主街的位置、有特色的联排。你欣赏做得好的密度——不是千篇一律，而是有策划感的。你会选翻新的1920年代公寓，而不是2020年的郊区新房。

**注意事项：** 你有时候为了位置牺牲太多空间。确保你真的有地方生活、远程办公、存放东西。另外：步行分高的街通常更吵——你需要找到甜蜜点（小巷，离主街2个block）。

**你理想的周六：** 走路去买咖啡，逛农夫市集，在社区小店吃午饭——全程不碰车钥匙。房子是你的大本营，不是你的全世界。`,
  },
  entertainer: {
    type: "The Entertainer",
    typeZh: "社交型",
    headline: "Your home is where people gather.",
    headlineZh: "你的家是人们聚集的地方。",
    description: `You don't just live in your home — you perform in it. Every space is evaluated by how it works when people are over.

**How you think:** You walk into a house and immediately imagine where 8 people would sit for dinner, whether the kitchen island has room for friends to lean against while you cook, if the backyard can handle a summer party. Flow matters more than formal rooms.

**What drives you:** An open kitchen that connects to living space, indoor-outdoor flow (deck, patio, sliding doors), a dining area that fits a real table, and a yard that's actually usable — flat, accessible, and not a postage stamp.

**Your style:** Open concept is non-negotiable. You want the cook to be part of the conversation, not isolated in a galley. Modern or renovated kitchens with counter space and good appliances. Outdoor living that feels like an extension of the house.

**Watch out for:** You might over-prioritize entertaining spaces and under-prioritize private retreats. You still need a quiet bedroom, a functional bathroom routine for two, and storage for all the stuff that accumulates. Don't forget: you host 20% of the time but live there 100%.

**Your ideal Saturday:** Friends coming over at 5pm — you're prepping in the kitchen with music playing, doors open to the backyard. Kids running between inside and outside. It's effortless because the space was designed for exactly this.`,
    descriptionZh: `你不只是住在家里——你在家里"表演"。每个空间都按"有人来的时候好不好用"来评估。

**你的思考方式：** 你走进一个房子，立刻想象8个人坐哪儿吃饭、厨房岛台够不够朋友靠着聊天、后院能不能办夏天派对。空间流动比正式房间重要。

**驱动你的东西：** 连通客厅的开放厨房、室内外过渡（deck、patio、推拉门）、能放大桌子的餐区、真正好用的院子——平坦、可达、不是邮票大小。

**你的风格偏好：** 开放式格局不可商量。你要做饭的人也能参与对话，不是被关在窄厨房里。现代或翻新过的厨房，有台面空间和好家电。户外生活区感觉像房子的延伸。

**注意事项：** 你可能过度关注社交空间而忽略私密休息区。你仍然需要安静的卧室、两个人用起来顺畅的浴室、还有收纳所有杂物的地方。别忘了：你20%的时间在招待，但100%的时间住在那里。

**你理想的周六：** 朋友们5点来——你在厨房备菜，音乐放着，后院门开着。孩子在里外跑来跑去。一切轻松自然，因为空间本来就是为这个设计的。`,
  },
  aesthete: {
    type: "The Aesthete",
    typeZh: "感官型",
    headline: "You feel a home before you think about it.",
    headlineZh: "你是先感受一个家，再去思考它。",
    description: `You walk into a home and within 30 seconds you know. It's not about the spec sheet — it's about how the light falls, how the rooms breathe, whether the space has soul.

**How you think:** You notice things most buyers don't — the quality of afternoon light through south-facing windows, the way a staircase turns, whether the trim work is original, if the proportions of a room feel right. You trust your gut reaction more than a checklist.

**What drives you:** Natural light (this is almost always #1), architectural character, quality materials, thoughtful proportions. You'd rather have a beautifully designed 1,400 sqft home than a bland 2,200 sqft one. Details matter: hardware, flooring, ceiling height, window style.

**Your style:** You appreciate homes with history and personality — Craftsman details, Victorian character, mid-century lines. You respond to south-facing light, high ceilings, interesting angles. You probably have opinions about paint colors. You'd rather do it right or not at all.

**Watch out for:** You can fall in love with a beautiful home that doesn't actually work for your life. That gorgeous Victorian might have 7-foot ceilings on the third floor, no closet space, and a bathroom from 1962. Balance soul with function. Also: beautiful homes command a premium — be ready to pay 10-15% more for "the one."

**Your ideal Saturday:** Morning light streams into the kitchen as you make pour-over coffee. You sit in a room that feels proportioned perfectly — not too big, not cramped. You notice how the light moves through the house as the day progresses.`,
    descriptionZh: `你走进一个房子，30秒内就知道了。不是看参数——是光线怎么落下来、房间怎么呼吸、空间有没有灵魂。

**你的思考方式：** 你注意到大多数买家不会注意的东西——下午阳光透过南向窗户的质感、楼梯转弯的方式、装饰条是不是原装的、房间比例对不对。你相信直觉反应胜过清单。

**驱动你的东西：** 自然光（几乎总是第一位）、建筑特色、材质质感、用心的比例。你宁要设计精美的1400尺房子，不要平庸的2200尺。细节很重要：五金件、地板、层高、窗户样式。

**你的风格偏好：** 你欣赏有历史和个性的房子——Craftsman细节、Victorian特色、Mid-century线条。你对南向光、高天花、有趣角度有反应。你大概对墙漆颜色有想法。你要么做对，要么不做。

**注意事项：** 你可能会爱上一个漂亮但实际不适合你生活的房子。那栋华丽的Victorian可能三楼层高只有7尺、没有衣柜空间、浴室还是1962年的。在灵魂和功能之间找平衡。另外：漂亮的房子有溢价——准备好为"命中注定"多付10-15%。

**你理想的周六：** 晨光洒进厨房，你在做手冲咖啡。你坐在一个比例完美的房间里——不太大也不局促。你注意到光线随着一天的推移在房子里移动。`,
  },
  pragmatist: {
    type: "The Pragmatist",
    typeZh: "实用型",
    headline: "You see potential where others see problems.",
    headlineZh: "你能在别人看到问题的地方看到潜力。",
    description: `Where others see a dated kitchen, you see $40k in instant equity. You think like an investor even when buying your own home.

**How you think:** You evaluate homes by their bones — structure, lot size, location, layout. Everything cosmetic is noise to you. You can see through ugly wallpaper to the 2,400 sqft on a corner lot with south exposure. You're running numbers while other buyers are checking the paint color.

**What drives you:** Value relative to market, lot size and potential, good bones (foundation, roof, mechanicals), a layout that works or can be opened up. You'd rather buy below market and invest $50-80k in renovation than pay full price for someone else's taste.

**Your style:** You don't have a fixed aesthetic because you know you'll create your own. You look for structural advantages: oversized lots, extra depth, legal ADU potential, expansion possibility. Ranch homes you can add a second floor, Colonials with unfinished attics, properties with detached garages that could become studios.

**Watch out for:** Not every "fixer" is a good deal. Some have structural issues that eat your entire renovation budget. Get inspections before falling in love with potential. Also: your partner/family might not share your vision — a home that's "great in 18 months" needs to be livable on day one.

**Your ideal Saturday:** You're sketching renovation plans at the kitchen table, calling contractors for quotes, researching permits. The house is a project and you love it. Six months from now it'll be exactly what you want — and worth $100k more than you paid.`,
    descriptionZh: `别人看到过时的厨房，你看到的是$40k的即时增值空间。即使买自住房，你也像投资者一样思考。

**你的思考方式：** 你按"骨架"评估房子——结构、占地、位置、布局。所有表面装饰对你来说都是噪音。你能透过丑陋壁纸看到转角地块上的2400尺南向房。别人在看墙漆颜色时，你在算数字。

**驱动你的东西：** 相对市场的价值、占地面积和潜力、好的骨架（地基、屋顶、机械系统）、合理或能打通的布局。你宁愿低于市价买入然后投$50-80k装修，也不想为别人的品味付全价。

**你的风格偏好：** 你没有固定审美因为你知道会自己创造。你寻找结构优势：超大地块、额外进深、合法ADU潜力、扩建可能。你看Ranch想加二层、看Colonial想利用未完工阁楼、看带独立车库的房想改成工作室。

**注意事项：** 不是每个"Fixer"都是好deal。有些有结构问题会吃掉你整个装修预算。爱上潜力之前先做检查。另外：你的伴侣/家人可能不共享你的愿景——一个"18个月后会很棒"的房子，第一天也得能住。

**你理想的周六：** 你在厨房桌上画装修图纸、打电话问承包商报价、研究许可证。房子是个项目，你乐在其中。6个月后它会变成你想要的样子——而且比你买的时候值多$100k。`,
  },
  explorer: {
    type: "The Explorer",
    typeZh: "探索型",
    headline: "You're still discovering what matters most.",
    headlineZh: "你还在发现什么对你最重要。",
    description: `You're at the beginning of your journey and that's perfectly fine. You don't fully know what you want yet — and that's actually an advantage.

**How you think:** You're open to possibilities. You haven't locked yourself into one neighborhood or one style. You're gathering data — every open house teaches you something about your own preferences. You're still figuring out the trade-offs.

**What drives you:** Curiosity and possibility. You want to see what's out there before committing. You might surprise yourself — the neighborhood you thought you wanted might not feel right in person, and somewhere unexpected might click instantly.

**Your style:** Undefined yet, and that's okay. You'll know it when you see it. Your style will emerge from reactions to real homes, not from Pinterest boards. Pay attention to your gut — the homes that make you linger are telling you something.

**Watch out for:** Analysis paralysis. At some point you need to commit to a direction. Don't let perfect be the enemy of good. Also: the market doesn't wait — if you're exploring for too long in a competitive market, you'll watch homes sell that you would have loved. Set a timeline for when "exploring" becomes "actively searching."

**Your ideal Saturday:** You're at three open houses in different neighborhoods, each one teaching you something new about what you actually respond to. You're building your filter with real experience, not assumptions.`,
    descriptionZh: `你在旅程的起点，这完全没问题。你还不完全知道自己想要什么——这其实是个优势。

**你的思考方式：** 你对各种可能性保持开放。你没有把自己锁定在某个社区或某种风格。你在收集数据——每次开放日都在教你关于自己偏好的东西。你还在弄清楚取舍关系。

**驱动你的东西：** 好奇心和可能性。你想在承诺之前看看外面有什么。你可能会惊讶自己——你以为想要的社区可能现场感觉不对，而某个意想不到的地方可能瞬间就点击了。

**你的风格偏好：** 还没定义，没关系。看到了你就知道。你的风格会从对真实房子的反应中浮现，而不是从Pinterest板上。关注你的直觉——让你想多待一会儿的房子在告诉你什么。

**注意事项：** 分析瘫痪。某个时刻你需要选定方向。不要让完美成为好的敌人。另外：市场不等人——如果你在竞争激烈的市场里探索太久，你会看着本来会爱上的房子被别人买走。设定一个时间线：什么时候从"探索"变成"积极寻找"。

**你理想的周六：** 你在三个不同社区看了三场开放日，每一场都教你一些关于自己真正反应什么的新东西。你在用真实体验而不是假设来建立你的筛选标准。`,
  },
}

// --- Archetype classification ---
function classifyArchetype(
  priorities: { item: string; rank: number }[],
  lifestyle: string[],
  hosting: string | null
): { type: string; headline: string } {
  const top3 = priorities.slice(0, 3).map((p) => p.item)

  if (
    top3.includes("Schools & family-friendliness") ||
    top3.includes("Privacy & quiet") ||
    lifestyle.includes("Kids playing in the yard") ||
    lifestyle.includes("Walking kids to school")
  ) {
    return { type: "The Nester", headline: "You're building a home your family will grow into." }
  }

  if (
    top3.includes("Location & commute") ||
    lifestyle.includes("Walking to a café") ||
    lifestyle.includes("Errands nearby on foot")
  ) {
    return { type: "The Urbanist", headline: "You want to walk out the door and have life happen." }
  }

  if (
    top3.includes("Kitchen & entertaining") ||
    top3.includes("Outdoor space & yard") ||
    (hosting && (hosting.includes("Big dinner") || hosting.includes("Backyard")))
  ) {
    return { type: "The Entertainer", headline: "Your home is where people gather." }
  }

  if (
    top3.includes("Natural light & views") ||
    top3.includes("Finishes & move-in ready") ||
    lifestyle.includes("Coffee & morning light")
  ) {
    return { type: "The Aesthete", headline: "You feel a home before you think about it." }
  }

  if (
    top3.includes("Space & square footage") ||
    lifestyle.includes("Working from home")
  ) {
    return { type: "The Pragmatist", headline: "You see potential where others see problems." }
  }

  return { type: "The Explorer", headline: "You're still discovering what matters most." }
}

// --- Natural language prose ---
function generateProse(
  priorities: { item: string; rank: number; weight: number }[],
  lifestyle: string[],
  hosting: string | null,
  dealbreakers: string[],
  renovation: string | null,
  budget: any,
  bedrooms: number
): string[] {
  const paragraphs: string[] = []

  // Opening: what defines this buyer
  if (priorities.length >= 3) {
    const top = priorities[0].item.toLowerCase()
    const second = priorities[1].item.toLowerCase()
    paragraphs.push(
      `For you, ${top} isn't just a preference — it's the lens through which you'll judge every home you see. ${second} comes close behind. Everything else is negotiable.`
    )
  }

  // How they'll actually use the home
  const familySignals = lifestyle.filter(s =>
    s.includes("Kids") || s.includes("kids") || s.includes("school")
  )
  const soloSignals = lifestyle.filter(s =>
    s.includes("Reading") || s.includes("Coffee") || s.includes("Working")
  )
  const socialSignals = lifestyle.filter(s =>
    s.includes("Hosting") || s.includes("café")
  )

  if (familySignals.length >= 2) {
    paragraphs.push(
      "Your home will revolve around your kids — school proximity, safe outdoor space, and room to grow. You're not buying for today, you're buying for the next 7-10 years."
    )
  } else if (soloSignals.length >= 2) {
    paragraphs.push(
      "You need a home that gives you space to think. Quiet mornings, a corner for work, good light. The house should feel calm even when life isn't."
    )
  } else if (socialSignals.length >= 1 && hosting?.includes("Big dinner")) {
    paragraphs.push(
      "You'll use this home to bring people together. The kitchen island, the dining table, the backyard — they're not features, they're how you live."
    )
  }

  // Renovation truth
  if (renovation?.includes("Turn-key")) {
    paragraphs.push(
      "You want to move in and not touch anything. That's valid — but it means your budget needs to stretch further, because move-in ready commands a 10-15% premium in this market."
    )
  } else if (renovation?.includes("Cosmetic")) {
    paragraphs.push(
      "You say cosmetic is fine — but pay attention to what's actually cosmetic vs what's structural. New paint is cosmetic. A cramped kitchen layout is not. Be honest about where your line is."
    )
  } else if (renovation?.includes("Bring it on")) {
    paragraphs.push(
      "You're open to renovation — that's your competitive advantage. You can bid on homes others skip, offer less, and build exactly what you want. Factor $50-80k renovation budget on top of purchase price."
    )
  }

  return paragraphs
}

// --- Blind spots & contradictions ---
function detectBlindSpots(
  priorities: { item: string; rank: number }[],
  lifestyle: string[],
  dealbreakers: string[],
  renovation: string | null,
  bedrooms: number,
  budget: any,
  commutes: string[],
  cities: string[]
): string[] {
  const spots: string[] = []
  const top3 = priorities.slice(0, 3).map((p) => p.item)

  // Contradiction: quiet + walkable
  const wantsQuiet = top3.includes("Privacy & quiet") || dealbreakers.includes("Too noisy — street noise, neighbors")
  const wantsWalkable = lifestyle.includes("Walking to a café") || lifestyle.includes("Errands nearby on foot") || dealbreakers.includes("Not walkable — have to drive for everything")

  if (wantsQuiet && wantsWalkable) {
    spots.push(
      "You want both quiet and walkability — these usually conflict. High Walk Score streets are busier. Look for homes on side streets within 2-3 blocks of a main street: close enough to walk, far enough to sleep."
    )
  }

  // Contradiction: cosmetic OK but kitchen dealbreaker
  if (renovation?.includes("Cosmetic") && dealbreakers.includes("Kitchen is too small or outdated")) {
    spots.push(
      "You said cosmetic updates are fine, but an outdated kitchen is a dealbreaker. A kitchen renovation isn't cosmetic — it's $30-60k and 2-3 months. You actually need a home with the kitchen already done."
    )
  }

  // Hidden need: bedroom count too low
  const hasKids = lifestyle.includes("Kids playing in the yard") || lifestyle.includes("Walking kids to school")
  const wfh = lifestyle.includes("Working from home")
  if (bedrooms <= 3 && hasKids && wfh) {
    spots.push(
      `You said ${bedrooms} bedrooms minimum, but you have kids and work from home. That's master + kid room + office = ${bedrooms} with zero flexibility. If there's any chance of another child or hosting family, you actually need ${bedrooms + 1}.`
    )
  }

  // Budget vs expectations
  if (budget.budgetRange && top3.includes("Schools & family-friendliness") && cities.length > 0) {
    spots.push(
      "Good school districts command a premium. In Greater Boston, the difference between a 6-rated and 8-rated school district can be $100-200k on the same house. Make sure your budget accounts for the school quality you actually want."
    )
  }

  // Dual commute pressure
  if (commutes.length >= 2) {
    spots.push(
      "With two commute destinations, you're constrained geographically. Map both commutes before falling in love with a neighborhood — a home that's great for one commute might add 20 minutes to the other."
    )
  }

  return spots.slice(0, 4) // Max 4 blind spots
}

// --- Search strategy recommendation ---
function generateStrategy(
  archetype: string,
  priorities: { item: string; rank: number }[],
  dealbreakers: string[],
  renovation: string | null,
  budget: any
): string {
  const parts: string[] = []

  parts.push("Based on everything you've told us, here's what we should actually be looking for:")

  if (archetype === "The Nester") {
    parts.push("A home on a quiet residential street in a top school district, with a fenced yard and enough bedrooms to grow into. Updated kitchen is non-negotiable. Ideally Colonial or Cape style, 1,800+ sqft.")
  } else if (archetype === "The Urbanist") {
    parts.push("A well-located home where daily life is walkable — grocery, café, transit all close. You'll trade size for location. Condo or townhouse in a village center, or a compact single-family on a side street near Main St.")
  } else if (archetype === "The Entertainer") {
    parts.push("An open-concept home with a real kitchen, flow between indoor and outdoor, and space for a crowd. Deck or patio is as important as an extra bedroom. Single-family with a flat, usable yard.")
  } else if (archetype === "The Aesthete") {
    parts.push("A home with soul — great light, interesting architecture, quality finishes. You'd rather have a smaller, beautiful home than a bigger bland one. Look for south-facing, high ceilings, and character details.")
  } else if (archetype === "The Pragmatist") {
    parts.push("A home with good bones and upside potential. Below-market properties that need work are your sweet spot. Focus on layout, lot size, and location — everything else can be changed.")
  } else {
    parts.push("We'll cast a wide net at first and narrow based on your reactions to actual homes. Your preferences will sharpen as you see real options.")
  }

  if (renovation?.includes("Turn-key")) {
    parts.push("Only homes renovated in the last 5 years or new construction.")
  }

  return parts.join(" ")
}
