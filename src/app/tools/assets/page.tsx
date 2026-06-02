import ToolPageLayout from "@/components/ToolPageLayout";
import AssetsGate from "@/components/AssetsGate";
import type { Tool } from "@/lib/tools";

const assetsTool: Tool = {
  id: "assets",
  title: "我的素材库",
  description: "你的私人素材仓库，图片、视频和音频集中存放，随时上传或下载。",
  usageGuide: "输入密码进入 → 按类型浏览 → 上传新素材或下载已有文件",
  href: "/tools/assets",
  gradient: "from-rose-500/20 to-pink-500/10",
  tag: "管理",
  bento: "default",
  demoHint: "双击导航栏图标进入",
};

export default function AssetsPage() {
  return (
    <ToolPageLayout tool={assetsTool}>
      <AssetsGate />
    </ToolPageLayout>
  );
}
