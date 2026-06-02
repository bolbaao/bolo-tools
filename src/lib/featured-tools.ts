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
    description: "把下载的歌曲转成 MP3、FLAC 等常用格式，多首可一起转、打包带走。",
    href: "/tools/music-convert",
  },
  {
    id: "video-extract",
    title: "视频链接提取",
    description: "粘贴抖音、B 站、YouTube 等分享链接，选好清晰度就能在本页下载。",
    href: "/tools/video-extract",
  },
  {
    id: "image-studio",
    title: "图像工坊",
    description: "压缩、变清晰、抠图、美化人像，还能用文字生成新图，图像处理一站搞定。",
    href: "/tools/image-studio",
  },
  {
    id: "doc-convert",
    title: "文档转换",
    description: "PDF 与 Word 互转、PDF 变图片、多张图片合成 PDF，不用装额外软件。",
    href: "/tools/doc-convert",
  },
  {
    id: "hot-trends",
    title: "每日热点榜单",
    description: "抖音、小红书等平台热点一屏浏览，方便你快速跟上正在火的话题。",
    href: "/tools/hot-trends",
  },
  {
    id: "toolkit",
    title: "实用工具箱",
    description: "字幕、动图、文本处理等更多小工具，按分类浏览，点一下就能用。",
    href: "#toolkit",
  },
];
