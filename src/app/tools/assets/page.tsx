import ToolPageLayout from "@/components/ToolPageLayout";
import AssetsPanel from "@/components/tools/AssetsPanel";
import { getToolById } from "@/lib/tools";

export default function AssetsPage() {
  const tool = getToolById("assets")!;
  return (
    <ToolPageLayout tool={tool}>
      <AssetsPanel />
    </ToolPageLayout>
  );
}
