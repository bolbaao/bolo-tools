import ToolPageLayout from "@/components/ToolPageLayout";
import DeveloperPanel from "@/components/tools/DeveloperPanel";
import type { Tool } from "@/lib/tools";

const developerTool: Tool = {
  id: "developer",
  title: "开发者手册",
  description: "部署说明、环境变量、开发命令与项目结构，仅供管理员查看。",
  href: "/tools/developer",
  gradient: "from-sky-500/20 to-indigo-500/10",
  tag: "管理",
};

export default function DeveloperPage() {
  return (
    <ToolPageLayout tool={developerTool}>
      <DeveloperPanel />
    </ToolPageLayout>
  );
}
