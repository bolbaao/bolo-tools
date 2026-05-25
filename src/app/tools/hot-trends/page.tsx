import ToolPageLayout from "@/components/ToolPageLayout";
import HotTrendsPanel from "@/components/tools/HotTrendsPanel";
import { getToolById } from "@/lib/tools";

export default function HotTrendsPage() {
  const tool = getToolById("hot-trends")!;
  return (
    <ToolPageLayout tool={tool}>
      <HotTrendsPanel />
    </ToolPageLayout>
  );
}
