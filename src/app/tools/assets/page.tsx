import ToolPageLayout from "@/components/ToolPageLayout";
import AssetsGate from "@/components/AssetsGate";

const assetsTool = {
  id: "assets",
  title: "我的素材库",
  description: "密码保护 · 集中管理图片、视频与音频素材。",
  href: "/tools/assets",
  icon: "▣",
  gradient: "from-rose-500/20 to-pink-500/10",
  tag: "管理",
  bento: "default" as const,
  demoHint: "双击导航栏菠萝图标进入",
};

export default function AssetsPage() {
  return (
    <ToolPageLayout tool={assetsTool}>
      <AssetsGate />
    </ToolPageLayout>
  );
}
