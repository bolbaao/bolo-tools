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

const WEATHER_HINT =
  /天气|气温|温度|多少度|冷不冷|热不热|下雨|下雪|刮风|风速|湿度|穿什么|带伞/i;

/** 常见城市/区县名（用户直接提到时用于查询） */
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

export function extractCityFromMessages(messages) {
  const users = [...messages].reverse().filter((m) => m.role === "user");
  for (const m of users) {
    const text = String(m.content ?? "");
    const withSuffix = text.match(/([\u4e00-\u9fa5]{2,10}?(?:市|县|区|州|盟|旗))/);
    if (withSuffix && isWeatherQuery(text)) {
      return withSuffix[1].replace(/(的)?天气.*$/, "").trim();
    }
    for (const name of CITY_ALIASES) {
      if (text.includes(name)) return name;
    }
    const local = text.match(/([\u4e00-\u9fa5]{2,6})现在/);
    if (local && isWeatherQuery(text)) return local[1];
  }
  return null;
}

function wmoLabel(code) {
  return WMO_LABELS[code] ?? (code != null ? `天气码${code}` : "未知");
}

async function fetchJson(url, timeoutMs = 12_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
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

  return {
    fetchedAt: new Date().toISOString(),
    timezone: data.timezone,
    temperatureC: c.temperature_2m,
    humidityPercent: c.relative_humidity_2m,
    weather: wmoLabel(c.weather_code),
    windSpeedKmh: c.wind_speed_10m,
    windDirection: windDirLabel,
    coordinates: { latitude: lat, longitude: lon },
  };
}

export async function resolveWeatherSnapshot({ messages, pageContext }) {
  if (!Array.isArray(messages) || !messages.some((m) => isWeatherQuery(m.content))) {
    return null;
  }

  const perms = pageContext?.clientPermissions;
  const geo = perms?.geolocation;

  try {
    if (geo?.status === "granted" && geo.latitude != null && geo.longitude != null) {
      const current = await fetchCurrentWeather(geo.latitude, geo.longitude);
      return {
        source: "coordinates",
        locationLabel: `纬度 ${geo.latitude.toFixed(2)}、经度 ${geo.longitude.toFixed(2)}`,
        current,
      };
    }

    const city = extractCityFromMessages(messages);
    if (!city) {
      if (isWeatherQuery(messages.at(-1)?.content) && geo?.status !== "granted") {
        return { needsLocation: true, hint: "未识别城市名且未授权定位" };
      }
      return null;
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

export function formatWeatherForPrompt(snapshot) {
  if (!snapshot) return "";
  if (snapshot.needsLocation) {
    return "\n【天气查询】用户问天气但未提供城市且未授权定位，应申请 geolocation 或请用户说明城市。";
  }
  if (snapshot.error) {
    return `\n【天气查询失败】${snapshot.error}`;
  }
  const c = snapshot.current;
  if (!c) return "";

  const parts = [
    `地点：${snapshot.locationLabel}`,
    `现象：${c.weather}`,
    `气温：${c.temperatureC}℃`,
    `湿度：${c.humidityPercent}%`,
    `风速：${c.windSpeedKmh} km/h${c.windDirection ? `（${c.windDirection}风）` : ""}`,
    `数据时间：${c.fetchedAt}`,
  ];

  return `\n【实时天气（Open-Meteo，请据此明确回答，勿说无法查天气）】\n${parts.join("\n")}`;
}
