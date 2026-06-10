import { sortFormatsByQuality } from "./video-platform.mjs";

function formatResolution(f) {
  if (f.resolution && f.resolution !== "audio only") return f.resolution;
  if (f.height) return `${f.height}p`;
  if (f.format_note) return f.format_note;
  return f.ext || "默认";
}

function hasVideo(f) {
  return f.vcodec !== "none" && f.vcodec != null;
}

function hasAudio(f) {
  return f.acodec !== "none" && f.acodec != null;
}

function isHlsExt(f) {
  return /\.m3u8/i.test(String(f.url || "")) || String(f.ext || "").toLowerCase() === "m3u8";
}

function pickBestAudio(formats) {
  const audioOnly = formats.filter((f) => f.url && !hasVideo(f) && hasAudio(f));
  if (!audioOnly.length) return null;
  audioOnly.sort((a, b) => (b.abr || b.tbr || 0) - (a.abr || b.tbr || 0));
  return audioOnly[0];
}

/**
 * @param {object} info yt-dlp JSON
 * @param {string} platform
 */
export function mapFormats(info, platform) {
  let list = (info.formats || []).filter(
    (f) => f.url && (hasVideo(f) || hasAudio(f) || (f.vcodec == null && f.acodec == null)),
  );

  const bestAudio = pickBestAudio(list);

  if (sortFormatsByQuality(platform)) {
    const combined = list.filter((f) => hasVideo(f) && hasAudio(f));
    const videoOnly = list.filter((f) => hasVideo(f) && !hasAudio(f));
    const unknownMux = list.filter((f) => f.vcodec == null && f.acodec == null);

    let candidates = combined.length
      ? combined
      : videoOnly.length
        ? videoOnly
        : unknownMux.length
          ? unknownMux
          : list.filter((f) => hasVideo(f));
    candidates.sort((a, b) => (b.height || 0) - (a.height || 0));

    const seen = new Set();
    candidates = candidates.filter((f) => {
      const key = `${f.height || 0}-${f.ext}-${f.format_id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return candidates.slice(0, 12).map((f) => {
      const muxed = hasVideo(f) && hasAudio(f);
      const needsMerge = hasVideo(f) && !hasAudio(f) && Boolean(bestAudio?.url);
      return {
        formatId: f.format_id,
        ext: needsMerge || isHlsExt(f) ? "mp4" : f.ext,
        resolution: formatResolution(f),
        filesize: f.filesize || f.filesize_approx,
        url: f.url,
        decodeKey: f._decodeKey || undefined,
        audioUrl: needsMerge ? bestAudio.url : undefined,
        hasAudio: muxed || f.vcodec == null || Boolean(needsMerge),
      };
    });
  }

  return list.slice(-12).map((f) => ({
    formatId: f.format_id,
    ext: f.ext,
    resolution: formatResolution(f),
    filesize: f.filesize || f.filesize_approx,
    url: f.url,
    decodeKey: f._decodeKey || undefined,
    hasAudio: hasAudio(f) || f.vcodec == null,
  }));
}

export function mapFormatsWithFallback(info, platform) {
  const formats = mapFormats(info, platform);
  if (formats.length) return formats;
  if (info.url) {
    return [
      {
        url: info.url,
        ext: info.ext || "mp4",
        resolution: "best",
        hasAudio: true,
      },
    ];
  }
  return [];
}
