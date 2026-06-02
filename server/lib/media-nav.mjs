import { env } from "./env.mjs";

/** 参考 https://sdocapp.com/s/JCuSjA3k5zzjjvQN9 群公告导航结构 */
const DEFAULT_NOTICES = [
  "点击蓝色字体即可进入！",
  "若搜索①打不开请用②号，或切换网络！",
];

const DEFAULT_PORTALS = [
  {
    id: "daily",
    label: "汁源每日更新",
    url: "https://2kma.cn/7MjpDz",
  },
  {
    id: "search1",
    label: "汁源搜索①",
    url: "http://mm.plool.com/app/index.html?id=211229kl",
  },
  {
    id: "search2",
    label: "汁源搜嗦②",
    url: "http://aa.plool.com/app/index.html?id=211229kl",
  },
  {
    id: "search3",
    label: "汁源搜嗦③",
    url: "http://1.h88818.net/app/index.html?id=test",
  },
];

const DEFAULT_EXTRAS = {
  title: "干饭优惠卷|每日可领",
  links: [
    { id: "eleme", label: "饿了么荭包", url: "http://dpurl.cn/Vd91bVlz" },
    { id: "meituan", label: "美团外卖荭包", url: "https://click.meituan.com/t?t=1&c=default" },
  ],
};

function portal(id, label, envKey, fallbackUrl) {
  const url = env(envKey, fallbackUrl).trim();
  return url ? { id, label, url } : null;
}

export function getMediaNav() {
  const portals = [
    portal("daily", "汁源每日更新", "MEDIA_NAV_DAILY_URL", DEFAULT_PORTALS[0].url),
    portal("search1", "汁源搜索①", "MEDIA_NAV_SEARCH1_URL", DEFAULT_PORTALS[1].url),
    portal("search2", "汁源搜嗦②", "MEDIA_NAV_SEARCH2_URL", DEFAULT_PORTALS[2].url),
    portal("search3", "汁源搜嗦③", "MEDIA_NAV_SEARCH3_URL", DEFAULT_PORTALS[3].url),
  ].filter(Boolean);

  const elemeUrl = env("MEDIA_NAV_ELEME_URL", DEFAULT_EXTRAS.links[0].url).trim();
  const meituanUrl = env("MEDIA_NAV_MEITUAN_URL", DEFAULT_EXTRAS.links[1].url).trim();
  const extraLinks = [
    elemeUrl ? { id: "eleme", label: "饿了么荭包", url: elemeUrl } : null,
    meituanUrl ? { id: "meituan", label: "美团外卖荭包", url: meituanUrl } : null,
  ].filter(Boolean);

  return {
    title: "群公告导航",
    notices: DEFAULT_NOTICES,
    portals,
    extras: extraLinks.length
      ? { title: DEFAULT_EXTRAS.title, links: extraLinks }
      : null,
    internal: {
      label: "本站网盘检索",
      href: "/tools/media-download",
      hint: "在本站内按片名搜索网盘链接",
    },
  };
}
