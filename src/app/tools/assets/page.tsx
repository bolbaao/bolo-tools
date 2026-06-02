import ToolPageLayout from "@/components/ToolPageLayout";
import AssetsGate from "@/components/AssetsGate";
import type { Tool } from "@/lib/tools";

const assetsTool: Tool = {
  id: "assets",
  title: "我的素材库",
  description: "你的私人素材仓库，图片、视频和音频集中存放，随时上传或下载。",
  href: "/tools/assets",
  gradient: "from-rose-500/20 to-pink-500/10",
  tag: "管理",
};

export default function AssetsPage() {
  return (
    <ToolPageLayout tool={assetsTool}>
      <AssetsGate />
    </ToolPageLayout>
  );
}
