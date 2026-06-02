import ToolPageLayout from "@/components/ToolPageLayout";
import AppBuilderPanel from "@/components/tools/AppBuilderPanel";
import { getToolById } from "@/lib/tools";

export default function AppBuilderPage() {
  const tool = getToolById("app-builder")!;
  return (
    <ToolPageLayout tool={tool}>
      <AppBuilderPanel />
    </ToolPageLayout>
  );
}
