import { fetchWithProxyFallback } from "./fetch-helper.mjs";

const WMO_LABELS = {
  0: "晴",
  1: "大部晴朗",
  2: "局部多云",
  3: "阴",
  45: "雾",
  48: "雾凇",
  51: "小毛毛雨",
  53: "毛毛雨",
  55: "大毛毛雨",
  61: "小雨",
  63: "中雨",
  65: "大雨",
  71: "小雪",
  73: "中雪",
  75: "大雪",
  80: "小阵雨",
  81: "阵雨",
  82: "大阵雨",
  95: "雷雨",
};

const WMO_EMOJI = {
  0: "☀️",
  1: "🌤️",
  2: "⛅",
  3: "☁️",
  45: "🌫️",
  48: "🌫️",
  51: "🌦️",
  53: "🌦️",
  55: "🌦️",
  61: "🌧️",
  63: "🌧️",
  65: "🌧️",
  71: "🌨️",
  73: "🌨️",
  75: "🌨️",
  80: "🌦️",
  81: "🌦️",
  82: "🌦️",
  95: "⛈️",
};

const WEATHER_HINT =
  /天气|气温|温度|多少度|冷不冷|热不热|下雨|下雪|刮风|风速|湿度|穿什么|带伞/i;

const CITY_ALIASES = [
  "威海",
  "北京",
  "上海",
  "广州",
  "深圳",
  "杭州",
  "成都",
  "重庆",
  "武汉",
  "西安",
  "南京",
  "苏州",
  "天津",
  "青岛",
  "大连",
  "厦门",
  "福州",
  "济南",
  "郑州",
  "长沙",
  "昆明",
  "沈阳",
  "哈尔滨",
  "长春",
  "石家庄",
  "太原",
  "合肥",
  "南昌",
  "南宁",
  "海口",
  "三亚",
  "拉萨",
  "乌鲁木齐",
  "兰州",
  "银川",
  "西宁",
  "呼和浩特",
  "香港",
  "澳门",
  "台北",
];

export function isWeatherQuery(text) {
  return WEATHER_HINT.test(String(text ?? ""));
}

/** 只从单条消息提取城市，不参考历史对话 */
export function extractCityFromMessage(text) {
  const msg = String(text ?? "").trim();
  if (!msg || !isWeatherQuery(msg)) return null;

  const withSuffix = msg.match(/([\u4e00-\u9fa5]{2,10}?(?:市|县|区|州|盟|旗))/);
  if (withSuffix) {
    return withSuffix[1].replace(/(的)?天气.*$/, "").trim();
  }

  for (const name of CITY_ALIASES) {
    if (msg.includes(name)) return name;
  }

  const local = msg.match(/([\u4e00-\u9fa5]{2,6})现在/);
  if (local) return local[1];

  return null;
}

function wmoLabel(code) {
  return WMO_LABELS[code] ?? (code != null ? `天气码${code}` : "未知");
}

export function wmoEmoji(code) {
  const n = Number(code);
  if (Number.isFinite(n) && WMO_EMOJI[n]) return WMO_EMOJI[n];
  return "🌡️";
}

async function fetchJson(url, timeoutMs = 12_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchWithProxyFallback(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function geocodeCity(name) {
  const q = encodeURIComponent(String(name).trim());
  const data = await fetchJson(
    `https://geocoding-api.open-meteo.com/v1/search?name=${q}&count=1&language=zh&format=json`,
  );
  const hit = data?.results?.[0];
  if (!hit) return null;
  return {
    name: hit.name,
    admin1: hit.admin1,
    country: hit.country,
    latitude: hit.latitude,
    longitude: hit.longitude,
  };
}

export async function fetchCurrentWeather(latitude, longitude) {
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new Error("无效坐标");
  }

  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: "temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m",
    timezone: "auto",
    forecast_days: "1",
  });

  const data = await fetchJson(`https://api.open-meteo.com/v1/forecast?${params}`);
  const c = data?.current;
  if (!c) throw new Error("天气数据为空");

  const windDir = c.wind_direction_10m;
  const windDirLabel =
    windDir == null
      ? ""
      : ["北", "东北", "东", "东南", "南", "西南", "西", "西北"][Math.round(windDir / 45) % 8];

  const weatherCode = c.weather_code;

  return {
    fetchedAt: new Date().toISOString(),
    timezone: data.timezone,
    temperatureC: c.temperature_2m,
    humidityPercent: c.relative_humidity_2m,
    weatherCode,
    weather: wmoLabel(weatherCode),
    icon: wmoEmoji(weatherCode),
    windSpeedKmh: c.wind_speed_10m,
    windDirection: windDirLabel,
    coordinates: { latitude: lat, longitude: lon },
  };
}

/**
 * 仅根据当前用户消息查实时天气，不沿用历史对话里的城市。
 * @param {{ lastUserMessage: string, pageContext?: object }} input
 */
export async function resolveWeatherSnapshot({ lastUserMessage, pageContext }) {
  const text = String(lastUserMessage ?? "").trim();
  if (!isWeatherQuery(text)) return null;

  const geo = pageContext?.clientPermissions?.geolocation;

  try {
    const city = extractCityFromMessage(text);

    if (!city) {
      if (geo?.status === "granted" && geo.latitude != null && geo.longitude != null) {
        const current = await fetchCurrentWeather(geo.latitude, geo.longitude);
        return {
          source: "coordinates",
          locationLabel: geo.label || `当前位置`,
          current,
        };
      }
      return { needsLocation: true, hint: "未识别城市名且未授权定位" };
    }

    const place = await geocodeCity(city);
    if (!place) {
      return { error: `未找到「${city}」的地理位置` };
    }

    const current = await fetchCurrentWeather(place.latitude, place.longitude);
    const locationLabel = [place.name, place.admin1, place.country].filter(Boolean).join("，");

    return {
      source: "city",
      query: city,
      locationLabel,
      current,
    };
  } catch (e) {
    return { error: e?.message || "查询天气失败" };
  }
}

function formatFetchedAt(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatWeatherReply(snapshot) {
  if (!snapshot?.current) return null;

  const c = snapshot.current;
  const card = {
    locationLabel: snapshot.locationLabel,
    weather: c.weather,
    weatherCode: c.weatherCode,
    icon: c.icon,
    temperatureC: c.temperatureC,
    humidityPercent: c.humidityPercent,
    windSpeedKmh: c.windSpeedKmh,
    windDirection: c.windDirection,
    fetchedAt: c.fetchedAt,
  };

  const updated = formatFetchedAt(c.fetchedAt);
  const wind =
    c.windSpeedKmh != null
      ? `${c.windSpeedKmh} km/h${c.windDirection ? `（${c.windDirection}风）` : ""}`
      : "";

  const lines = [
    `**${snapshot.locationLabel}** 实时天气 ${c.icon}`,
    "",
    `- 现象：${c.weather}`,
    `- 气温：**${c.temperatureC}℃**`,
    c.humidityPercent != null ? `- 湿度：${c.humidityPercent}%` : "",
    wind ? `- 风速：${wind}` : "",
    updated ? `- 更新：${updated}` : "",
    "",
    "```weather",
    JSON.stringify(card),
    "```",
  ].filter(Boolean);

  return lines.join("\n");
}

export function formatWeatherForPrompt(snapshot) {
  if (!snapshot) return "";
  if (snapshot.needsLocation) {
    return "\n【天气查询】用户问天气但未说明城市，应请用户说明城市名，不要沿用对话历史中的其他城市。";
  }
  if (snapshot.error) {
    return `\n【天气查询失败】${snapshot.error}`;
  }
  const c = snapshot.current;
  if (!c) return "";

  const parts = [
    `地点：${snapshot.locationLabel}`,
    `现象：${c.icon} ${c.weather}`,
    `气温：${c.temperatureC}℃`,
    `湿度：${c.humidityPercent}%`,
    `风速：${c.windSpeedKmh} km/h${c.windDirection ? `（${c.windDirection}风）` : ""}`,
    `数据时间：${c.fetchedAt}`,
  ];

  return `\n【实时天气（Open-Meteo，请据此明确回答，勿说无法查天气，勿引用历史对话中的旧天气）】\n${parts.join("\n")}`;
}
