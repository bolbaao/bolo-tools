import ToolPageLayout from "@/components/ToolPageLayout";
import AiSearchPanel from "@/components/tools/AiSearchPanel";
import { getToolById } from "@/lib/tools";

export default function AiSearchPage() {
  const tool = getToolById("ai-search")!;
  return (
    <ToolPageLayout tool={tool}>
      <AiSearchPanel />
    </ToolPageLayout>
  );
}
