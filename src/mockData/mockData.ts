export const mockCategories = [
  { id: "movie", name: "电影" },
  { id: "tv", name: "电视剧" },
  { id: "variety", name: "综艺" },
];

export const mockFilters = {
  movie: {
    types: [
      { id: "action", name: "动作" },
      { id: "horror", name: "恐怖" },
      { id: "romance", name: "爱情" },
      { id: "comedy", name: "喜剧" },
      { id: "sci-fi", name: "科幻" },
    ],
    years: [
      { id: "2026", name: "2026" },
      { id: "2025", name: "2025" },
      { id: "2024", name: "2024" },
      { id: "2023", name: "2023" },
    ],
    regions: [
      { id: "cn", name: "中国" },
      { id: "jp", name: "日本" },
      { id: "kr", name: "韩国" },
      { id: "us", name: "美国" },
    ],
  },

  tv: {
    types: [
      { id: "romance", name: "爱情" },
      { id: "crime", name: "犯罪" },
      { id: "suspense", name: "悬疑" },
      { id: "comedy", name: "喜剧" },
    ],
    years: [
      { id: "2026", name: "2026" },
      { id: "2025", name: "2025" },
      { id: "2024", name: "2024" },
    ],
    regions: [
      { id: "cn", name: "中国" },
      { id: "jp", name: "日本" },
      { id: "kr", name: "韩国" },
    ],
  },

  variety: {
    types: [
      { id: "music", name: "音乐" },
      { id: "reality", name: "真人秀" },
      { id: "talk", name: "访谈" },
    ],
    years: [
      { id: "2026", name: "2026" },
      { id: "2025", name: "2025" },
      { id: "2024", name: "2024" },
    ],
    regions: [
      { id: "cn", name: "中国" },
      { id: "kr", name: "韩国" },
      { id: "jp", name: "日本" },
    ],
  },
};

export const mockMovies = [
  {
    id: "1",
    category: "movie",
    title: "动作电影示例",
    cover: "https://placehold.co/300x420",
    type: "action",
    year: "2026",
    region: "kr",
  },
  {
    id: "2",
    category: "movie",
    title: "爱情电影示例",
    cover: "https://placehold.co/300x420",
    type: "romance",
    year: "2025",
    region: "cn",
  },
  {
    id: "3",
    category: "movie",
    title: "恐怖电影示例",
    cover: "https://placehold.co/300x420",
    type: "horror",
    year: "2026",
    region: "jp",
  },
  {
    id: "4",
    category: "tv",
    title: "韩国电视剧示例",
    cover: "https://placehold.co/300x420",
    type: "romance",
    year: "2026",
    region: "kr",
  },
  {
    id: "5",
    category: "variety",
    title: "综艺节目示例",
    cover: "https://placehold.co/300x420",
    type: "reality",
    year: "2025",
    region: "cn",
  },
];
