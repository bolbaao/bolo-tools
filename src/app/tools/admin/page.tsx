import ToolPageLayout from "@/components/ToolPageLayout";
import AdminPanel from "@/components/tools/AdminPanel";
import type { Tool } from "@/lib/tools";

const adminTool: Tool = {
  id: "admin",
  title: "用户管理",
  description: "查看注册用户、他们的记忆与对话记录，方便运营与客服跟进问题。",
  usageGuide: "用管理员账号登录 → 浏览用户列表 → 点开查看记忆与对话详情",
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
