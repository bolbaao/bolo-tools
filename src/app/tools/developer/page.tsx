import ToolPageLayout from "@/components/ToolPageLayout";
import DeveloperPanel from "@/components/tools/DeveloperPanel";
import type { Tool } from "@/lib/tools";

const developerTool: Tool = {
  id: "developer",
  title: "开发者手册",
  description: "部署说明、环境变量、开发命令与项目结构，仅供管理员查看。",
  usageGuide: "用管理员账号登录 → 阅读部署与开发说明 → 按需配置 .env 并重启服务",
  href: "/tools/developer",
  gradient: "from-sky-500/20 to-indigo-500/10",
  tag: "管理",
  bento: "default",
  demoHint: "管理员专用",
};

export default function DeveloperPage() {
  return (
    <ToolPageLayout tool={developerTool}>
      <DeveloperPanel />
    </ToolPageLayout>
  );
}
