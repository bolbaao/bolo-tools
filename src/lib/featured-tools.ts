export type FeaturedTool = {
  id: string;
  title: string;
  description: string;
  href: string;
};

/** 首页精选卡片对应的工具 id（不含「实用工具箱」入口本身） */
export const homepageFeaturedToolIds = [
  "music-convert",
  "video-extract",
  "image-studio",
  "hot-trends",
  "doc-convert",
] as const;

export const featuredTools: FeaturedTool[] = [
  {
    id: "music-convert",
    title: "音乐格式转换",
    description: "上传各平台加密曲目，转换为 MP3、FLAC 等格式，支持批量打包下载。",
    href: "/tools/music-convert",
  },
  {
    id: "video-extract",
    title: "视频链接提取",
    description: "粘贴抖音、B 站、YouTube 等平台链接，解析多清晰度并本页直接下载。",
    href: "/tools/video-extract",
  },
  {
    id: "image-studio",
    title: "图像工坊",
    description: "压缩、变清晰、智能抠图与 AI 生图，一站式完成图像处理。",
    href: "/tools/image-studio",
  },
  {
    id: "doc-convert",
    title: "文档转换",
    description: "PDF 与 Word 互转、PDF 导出图片、多张图片合并 PDF。",
    href: "/tools/doc-convert",
  },
  {
    id: "hot-trends",
    title: "每日热点榜单",
    description: "聚合抖音、小红书等平台实时热点，按榜单浏览，便于快速跟进话题。",
    href: "/tools/hot-trends",
  },
  {
    id: "toolkit",
    title: "实用工具箱",
    description: "字幕、GIF、文本处理、爬虫等更多工具，按分类浏览并一键进入。",
    href: "#toolkit",
  },
];
