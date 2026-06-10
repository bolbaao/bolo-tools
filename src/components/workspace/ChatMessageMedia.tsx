"use client";

import {
  artifactDownloadName,
  chatArtifactKindFromLabel,
  chatFileKindIcon,
  chatFileKindLabel,
  type ChatArtifactDownload,
  type ChatFileKind,
  type ChatReplyImage,
} from "@/lib/chat-files";

export type AttachmentDisplayItem = {
  id: string;
  name: string;
  kind: ChatFileKind;
  previewUrl?: string;
  size?: number;
};

function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ChatAttachmentThumb({ item }: { item: AttachmentDisplayItem }) {
  const sizeLabel = formatFileSize(item.size);

  if (item.kind === "image" && item.previewUrl) {
    return (
      <div className="workspace-chat-attach-thumb" title={item.name}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.previewUrl} alt={item.name} className="workspace-chat-attach-thumb-media" />
        <span className="workspace-chat-attach-thumb-name">{item.name}</span>
        {sizeLabel ? <span className="workspace-chat-attach-thumb-meta">{sizeLabel}</span> : null}
      </div>
    );
  }

  if (item.kind === "video" && item.previewUrl) {
    return (
      <div className="workspace-chat-attach-thumb" title={item.name}>
        <video
          src={item.previewUrl}
          muted
          playsInline
          preload="metadata"
          className="workspace-chat-attach-thumb-media"
        />
        <span className="workspace-chat-attach-thumb-badge">视频</span>
        <span className="workspace-chat-attach-thumb-name">{item.name}</span>
        {sizeLabel ? <span className="workspace-chat-attach-thumb-meta">{sizeLabel}</span> : null}
      </div>
    );
  }

  return (
    <div className="workspace-chat-attach-thumb workspace-chat-attach-thumb-file" title={item.name}>
      <span className="workspace-chat-attach-thumb-icon" aria-hidden>
        {chatFileKindIcon(item.kind)}
      </span>
      <span className="workspace-chat-attach-thumb-kind">{chatFileKindLabel(item.kind)}</span>
      <span className="workspace-chat-attach-thumb-name">{item.name}</span>
      {sizeLabel ? <span className="workspace-chat-attach-thumb-meta">{sizeLabel}</span> : null}
    </div>
  );
}

export function ChatAttachmentGrid({ items }: { items: AttachmentDisplayItem[] }) {
  if (!items.length) return null;
  return (
    <div className="workspace-chat-attach-grid">
      {items.map((item) => (
        <ChatAttachmentThumb key={item.id} item={item} />
      ))}
    </div>
  );
}

export function ChatPendingAttachmentGrid({
  items,
  onRemove,
}: {
  items: AttachmentDisplayItem[];
  onRemove: (id: string) => void;
}) {
  if (!items.length) return null;
  return (
    <div className="workspace-chat-attach-grid workspace-chat-attach-grid-pending">
      {items.map((item) => (
        <div key={item.id} className="workspace-chat-attach-pending">
          <ChatAttachmentThumb item={item} />
          <button
            type="button"
            onClick={() => onRemove(item.id)}
            className="workspace-chat-attach-remove"
            aria-label={`移除 ${item.name}`}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

export function ChatDownloadFileCard({ item }: { item: ChatArtifactDownload }) {
  const kind = chatArtifactKindFromLabel(item.label);
  const isImage = kind === "image" && !/gif|动图/i.test(item.label);
  const previewHref = item.href;
  const downloadHref = `${item.href}?download=1`;
  const downloadFilename = artifactDownloadName(item.label);

  return (
    <a
      href={downloadHref}
      download={downloadFilename}
      className="workspace-chat-download-card"
      title={downloadFilename || item.label}
    >
      {isImage ? (
        <div className="workspace-chat-download-preview">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewHref} alt={item.label} className="workspace-chat-download-preview-img" />
        </div>
      ) : (
        <span className="workspace-chat-download-icon" aria-hidden>
          {chatFileKindIcon(kind)}
        </span>
      )}
      <span className="workspace-chat-download-info">
        <span className="workspace-chat-download-label">{item.label}</span>
        <span className="workspace-chat-download-action">点击下载</span>
      </span>
    </a>
  );
}

export function ChatReplyImageGallery({ items }: { items: ChatReplyImage[] }) {
  if (!items.length) return null;
  return (
    <div className="workspace-chat-reply-images">
      {items.map((item) => (
        <figure key={item.id} className="workspace-chat-reply-image-figure">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.href}
            alt={item.alt}
            className="workspace-chat-reply-image"
            loading="lazy"
          />
          <figcaption className="workspace-chat-reply-image-caption">
            <span>{item.alt}</span>
            <a href={`${item.href}?download=1`} download className="workspace-chat-reply-image-download">
              下载
            </a>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

export function ChatDownloadFileList({ items }: { items: ChatArtifactDownload[] }) {
  if (!items.length) return null;
  return (
    <div className="workspace-chat-download-list">
      {items.map((item) => (
        <ChatDownloadFileCard key={item.id} item={item} />
      ))}
    </div>
  );
}
