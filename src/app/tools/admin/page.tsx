import ToolPageLayout from "@/components/ToolPageLayout";
import AdminPanel from "@/components/tools/AdminPanel";
import type { Tool } from "@/lib/tools";

const adminTool: Tool = {
  id: "admin",
  title: "用户管理",
  description: "查看注册用户及其记忆库与对话存档",
  href: "/tools/admin",
  gradient: "from-amber-500/20 to-orange-500/10",
  tag: "管理",
  bento: "default",
  demoHint: "管理员专用",
};

export default function AdminPage() {
  return (
    <ToolPageLayout tool={adminTool}>
      <AdminPanel />
    </ToolPageLayout>
  );
}
