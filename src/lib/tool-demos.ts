/**
 * 各工具板块演示视频（Coverr 免费素材，可替换为 public/demos/{id}.mp4）
 * @see https://coverr.co/
 */
export type ToolDemoSource = {
  /** 优先使用本地 /demos/{toolId}.mp4（若存在） */
  localPath: string;
  /** 远程回退地址 */
  remoteUrl: string;
  poster?: string;
};

export const TOOL_DEMO_VIDEOS: Record<string, ToolDemoSource> = {
  "music-convert": {
    localPath: "/demos/music-convert.mp4",
    remoteUrl: "https://cdn.coverr.co/videos/coverr-man-playing-the-piano-6284/1080p.mp4",
    poster: "https://cdn.coverr.co/videos/coverr-man-playing-the-piano-6284/thumbnail?width=640",
  },
  "video-extract": {
    localPath: "/demos/video-extract.mp4",
    remoteUrl: "https://cdn.coverr.co/videos/coverr-connected-on-the-go-smartphone-in-use/1080p.mp4",
    poster:
      "https://cdn.coverr.co/videos/coverr-connected-on-the-go-smartphone-in-use/thumbnail?width=640",
  },
  "ai-video": {
    localPath: "/demos/ai-video.mp4",
    remoteUrl: "https://cdn.coverr.co/videos/coverr-mysterious-figure-in-neon-noir-cityscape/1080p.mp4",
    poster:
      "https://cdn.coverr.co/videos/coverr-mysterious-figure-in-neon-noir-cityscape/thumbnail?width=640",
  },
  "smart-cutout": {
    localPath: "/demos/smart-cutout.mp4",
    remoteUrl:
      "https://cdn.coverr.co/videos/coverr-portrait-of-a-woman-in-a-surreal-smoky-dreamscape/1080p.mp4",
    poster:
      "https://cdn.coverr.co/videos/coverr-portrait-of-a-woman-in-a-surreal-smoky-dreamscape/thumbnail?width=640",
  },
  "image-sharpen": {
    localPath: "/demos/image-sharpen.mp4",
    remoteUrl: "https://cdn.coverr.co/videos/coverr-taking-photos-of-orchids-3595/1080p.mp4",
    poster: "https://cdn.coverr.co/videos/coverr-taking-photos-of-orchids-3595/thumbnail?width=640",
  },
  "image-compress": {
    localPath: "/demos/image-compress.mp4",
    remoteUrl: "https://cdn.coverr.co/videos/coverr-a-female-s-hands-typing-on-laptop-7520/1080p.mp4",
    poster:
      "https://cdn.coverr.co/videos/coverr-a-female-s-hands-typing-on-laptop-7520/thumbnail?width=640",
  },
  "ai-chat": {
    localPath: "/demos/ai-chat.mp4",
    remoteUrl: "https://cdn.coverr.co/videos/coverr-woman-texting-and-smiling-3838/1080p.mp4",
    poster: "https://cdn.coverr.co/videos/coverr-woman-texting-and-smiling-3838/thumbnail?width=640",
  },
  "hot-trends": {
    localPath: "/demos/hot-trends.mp4",
    remoteUrl: "https://cdn.coverr.co/videos/coverr-scrolling-through-coronavirus-news-6170/1080p.mp4",
    poster:
      "https://cdn.coverr.co/videos/coverr-scrolling-through-coronavirus-news-6170/thumbnail?width=640",
  },
  "media-search": {
    localPath: "/demos/media-search.mp4",
    remoteUrl: "https://cdn.coverr.co/videos/coverr-film-director-s-pov-7972/1080p.mp4",
    poster: "https://cdn.coverr.co/videos/coverr-film-director-s-pov-7972/thumbnail?width=640",
  },
  "spider-builder": {
    localPath: "/demos/spider-builder.mp4",
    remoteUrl: "https://cdn.coverr.co/videos/coverr-developing-coding-sequences-3909/1080p.mp4",
    poster: "https://cdn.coverr.co/videos/coverr-developing-coding-sequences-3909/thumbnail?width=640",
  },
  assets: {
    localPath: "/demos/assets.mp4",
    remoteUrl: "https://cdn.coverr.co/videos/coverr-timelapse-working-from-home-3951/1080p.mp4",
    poster: "https://cdn.coverr.co/videos/coverr-timelapse-working-from-home-3951/thumbnail?width=640",
  },
};

export function getToolDemoSource(toolId: string): ToolDemoSource | undefined {
  return TOOL_DEMO_VIDEOS[toolId];
}
