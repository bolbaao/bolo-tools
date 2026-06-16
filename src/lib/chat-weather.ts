export type ChatWeatherCard = {
  locationLabel: string;
  weather: string;
  weatherCode?: number;
  icon: string;
  temperatureC: number;
  humidityPercent?: number;
  windSpeedKmh?: number;
  windDirection?: string;
  fetchedAt?: string;
};

const WEATHER_BLOCK_RE = /```weather\s*([\s\S]*?)```/i;

export function parseChatWeatherCard(content: string): ChatWeatherCard | null {
  const match = String(content || "").match(WEATHER_BLOCK_RE);
  if (!match?.[1]) return null;
  try {
    const parsed = JSON.parse(match[1].trim()) as Partial<ChatWeatherCard>;
    if (!parsed.locationLabel || parsed.temperatureC == null || !parsed.weather) return null;
    return {
      locationLabel: String(parsed.locationLabel),
      weather: String(parsed.weather),
      weatherCode: typeof parsed.weatherCode === "number" ? parsed.weatherCode : undefined,
      icon: String(parsed.icon || "🌡️"),
      temperatureC: Number(parsed.temperatureC),
      humidityPercent:
        parsed.humidityPercent == null ? undefined : Number(parsed.humidityPercent),
      windSpeedKmh: parsed.windSpeedKmh == null ? undefined : Number(parsed.windSpeedKmh),
      windDirection: parsed.windDirection ? String(parsed.windDirection) : undefined,
      fetchedAt: parsed.fetchedAt ? String(parsed.fetchedAt) : undefined,
    };
  } catch {
    return null;
  }
}

export function stripChatWeatherBlock(content: string): string {
  return String(content || "")
    .replace(WEATHER_BLOCK_RE, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function formatFetchedAt(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatWeatherUpdatedLabel(card: ChatWeatherCard): string {
  return formatFetchedAt(card.fetchedAt);
}
