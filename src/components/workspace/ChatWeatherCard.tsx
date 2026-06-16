"use client";

import type { ChatWeatherCard } from "@/lib/chat-weather";
import { formatWeatherUpdatedLabel } from "@/lib/chat-weather";

type Props = {
  card: ChatWeatherCard;
  compact?: boolean;
};

export default function ChatWeatherCard({ card, compact }: Props) {
  const updated = formatWeatherUpdatedLabel(card);
  const wind =
    card.windSpeedKmh != null
      ? `${card.windSpeedKmh} km/h${card.windDirection ? ` · ${card.windDirection}风` : ""}`
      : null;

  return (
    <div
      className={`chat-weather-card${compact ? " chat-weather-card-compact" : ""}`}
      aria-label={`${card.locationLabel} ${card.weather} ${card.temperatureC} 摄氏度`}
    >
      <div className="chat-weather-card-main">
        <div className="chat-weather-card-icon" aria-hidden>
          {card.icon}
        </div>
        <div className="chat-weather-card-body">
          <p className="chat-weather-card-location">{card.locationLabel}</p>
          <p className="chat-weather-card-temp">
            {Math.round(card.temperatureC)}
            <span className="chat-weather-card-temp-unit">°C</span>
          </p>
          <p className="chat-weather-card-condition">{card.weather}</p>
        </div>
      </div>
      <div className="chat-weather-card-meta">
        {card.humidityPercent != null ? <span>湿度 {card.humidityPercent}%</span> : null}
        {wind ? <span>{wind}</span> : null}
        {updated ? <span>更新 {updated}</span> : null}
      </div>
    </div>
  );
}
