import { formatWeatherReply, isWeatherQuery, resolveWeatherSnapshot } from "./weather.mjs";

/**
 * 天气类问题走 Open-Meteo 实时接口，只解析当前消息中的城市。
 * @param {string} lastUser
 * @param {{ pageContext?: object }} [opts]
 */
export async function tryWeatherReply(lastUser, opts = {}) {
  const text = String(lastUser || "").trim();
  if (!isWeatherQuery(text)) return null;

  const snapshot = await resolveWeatherSnapshot({
    lastUserMessage: text,
    pageContext: opts.pageContext,
  });

  if (snapshot?.needsLocation) {
    return "请告诉我你想查哪个城市的天气，例如「成都天气」或「北京现在多少度」。";
  }

  if (snapshot?.error) {
    return `暂时查不到天气：${snapshot.error}`;
  }

  return formatWeatherReply(snapshot);
}
