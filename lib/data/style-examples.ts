export interface StyleExample {
  id: string
  label: string
  labelZh: string
  photoUrl: string
  tags: string[]
}

export const STYLE_EXAMPLES: StyleExample[] = [
  {
    id: "colonial",
    label: "Colonial",
    labelZh: "殖民地风格",
    photoUrl: "https://media.mlspin.com/photo.aspx?mls=73487660&n=0&w=600&h=450",
    tags: ["colonial", "classic", "traditional", "stately"],
  },
  {
    id: "cape",
    label: "Cape Cod",
    labelZh: "科德角风格",
    photoUrl: "https://media.mlspin.com/photo.aspx?mls=73500458&n=0&w=600&h=450",
    tags: ["cape_cod", "classic", "cozy", "charming"],
  },
  {
    id: "contemporary",
    label: "Contemporary",
    labelZh: "现代风格",
    photoUrl: "https://media.mlspin.com/photo.aspx?mls=73476980&n=0&w=600&h=450",
    tags: ["contemporary", "minimalist", "new_construction"],
  },
  {
    id: "victorian",
    label: "Victorian",
    labelZh: "维多利亚风格",
    photoUrl: "https://media.mlspin.com/photo.aspx?mls=73469901&n=0&w=600&h=450",
    tags: ["victorian", "historic", "charming", "grand"],
  },
  {
    id: "ranch",
    label: "Ranch",
    labelZh: "牧场风格",
    photoUrl: "https://media.mlspin.com/photo.aspx?mls=73491946&n=0&w=600&h=450",
    tags: ["ranch", "mid_century", "cozy", "minimal"],
  },
  {
    id: "tudor",
    label: "Tudor",
    labelZh: "都铎风格",
    photoUrl: "https://media.mlspin.com/photo.aspx?mls=73428300&n=0&w=600&h=450",
    tags: ["tudor", "historic", "classic", "stately"],
  },
  {
    id: "bungalow",
    label: "Craftsman / Bungalow",
    labelZh: "工匠风格",
    photoUrl: "https://media.mlspin.com/photo.aspx?mls=73488330&n=0&w=600&h=450",
    tags: ["craftsman", "bungalow", "charming", "warm", "cozy"],
  },
  {
    id: "cottage",
    label: "Cottage / Farmhouse",
    labelZh: "小屋/农舍风格",
    photoUrl: "https://media.mlspin.com/photo.aspx?mls=73509517&n=0&w=600&h=450",
    tags: ["cottage", "farmhouse", "cozy", "charming", "warm"],
  },
]
