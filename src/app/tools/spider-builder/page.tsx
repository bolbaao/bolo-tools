import ToolPageLayout from "@/components/ToolPageLayout";
import SpiderBuilderPanel from "@/components/tools/SpiderBuilderPanel";
import { getToolById } from "@/lib/tools";

export default function SpiderBuilderPage() {
  const tool = getToolById("spider-builder")!;
  return (
    <ToolPageLayout tool={tool}>
      <SpiderBuilderPanel />
    </ToolPageLayout>
  );
}
