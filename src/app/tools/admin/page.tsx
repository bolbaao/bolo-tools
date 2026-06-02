import ToolPageLayout from "@/components/ToolPageLayout";
import AdminPanel from "@/components/tools/AdminPanel";
import type { Tool } from "@/lib/tools";

const adminTool: Tool = {
  id: "admin",
  title: "用户管理",
  description: "管理员查看注册用户、记忆库与对话记录，用于运营与客服支持。",
  usageGuide: "使用管理员账号登录 → 浏览用户列表 → 展开查看记忆与对话详情",
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
