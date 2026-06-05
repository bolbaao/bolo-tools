export type FavoriteTrend = {
  id: string;
  platform: "douyin" | "xiaohongshu";
  title: string;
  rank?: number;
  heat?: string;
  tag?: string;
  author?: string;
  url?: string;
  savedAt: string;
};

const STORAGE_KEY = "pineapple-hot-trends-favorites";

function favoriteId(platform: string, title: string) {
  return `${platform}::${title}`;
}

export function loadFavoriteTrends(): FavoriteTrend[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveFavoriteTrends(items: FavoriteTrend[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function isTrendFavorited(
  favorites: FavoriteTrend[],
  platform: string,
  title: string,
): boolean {
  const id = favoriteId(platform, title);
  return favorites.some((f) => f.id === id);
}

export function toggleFavoriteTrend(
  favorites: FavoriteTrend[],
  item: Omit<FavoriteTrend, "id" | "savedAt">,
): FavoriteTrend[] {
  const id = favoriteId(item.platform, item.title);
  const exists = favorites.some((f) => f.id === id);
  if (exists) {
    return favorites.filter((f) => f.id !== id);
  }
  return [
    {
      ...item,
      id,
      savedAt: new Date().toISOString(),
    },
    ...favorites,
  ];
}

export function removeFavoriteTrend(favorites: FavoriteTrend[], id: string): FavoriteTrend[] {
  return favorites.filter((f) => f.id !== id);
}
