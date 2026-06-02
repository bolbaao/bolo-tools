import ToolPageLayout from "@/components/ToolPageLayout";
import AssetsGate from "@/components/AssetsGate";
import type { Tool } from "@/lib/tools";

const assetsTool: Tool = {
  id: "assets",
  title: "我的素材库",
  description: "密码保护的个人素材库，集中管理图片、视频与音频，随时上传与下载。",
  usageGuide: "输入访问密码进入 → 按类型筛选 → 上传或下载素材",
  href: "/tools/assets",
  gradient: "from-rose-500/20 to-pink-500/10",
  tag: "管理",
  bento: "default",
  demoHint: "双击导航栏菠萝图标进入",
};

export default function AssetsPage() {
  return (
    <ToolPageLayout tool={assetsTool}>
      <AssetsGate />
    </ToolPageLayout>
  );
}
