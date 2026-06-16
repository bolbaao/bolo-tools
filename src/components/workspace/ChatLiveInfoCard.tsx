"use client";

import type { ChatLiveInfoCard } from "@/lib/chat-liveinfo";
import {
  formatLiveInfoUpdatedLabel,
  liveInfoKindClass,
} from "@/lib/chat-liveinfo";

type Props = {
  card: ChatLiveInfoCard;
  compact?: boolean;
};

export default function ChatLiveInfoCard({ card, compact }: Props) {
  const updated = formatLiveInfoUpdatedLabel(card);
  const kindClass = liveInfoKindClass(card.kind);

  return (
    <div
      className={`chat-liveinfo-card chat-liveinfo-card-${kindClass}${
        compact ? " chat-liveinfo-card-compact" : ""
      }`}
      aria-label={`${card.title} ${card.headline}`}
    >
      <div className="chat-liveinfo-card-main">
        <div className="chat-liveinfo-card-icon" aria-hidden>
          {card.icon}
        </div>
        <div className="chat-liveinfo-card-body">
          <p className="chat-liveinfo-card-title">{card.title}</p>
          <p className="chat-liveinfo-card-headline">{card.headline}</p>
        </div>
      </div>

      {card.highlights.length > 0 ? (
        <ul className="chat-liveinfo-card-highlights">
          {card.highlights.slice(0, compact ? 5 : 6).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}

      <div className="chat-liveinfo-card-meta">
        {card.meta?.map((item) => (
          <span key={`${item.label}-${item.value}`}>
            {item.label} {item.value}
          </span>
        ))}
        {updated ? <span>更新 {updated}</span> : null}
      </div>
    </div>
  );
}
