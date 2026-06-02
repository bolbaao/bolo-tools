import ToolPageLayout from "@/components/ToolPageLayout";
import AiWorkflowPanel from "@/components/tools/AiWorkflowPanel";
import { getToolById } from "@/lib/tools";

export default function AiWorkflowPage() {
  const tool = getToolById("ai-workflow")!;
  return (
    <ToolPageLayout tool={tool}>
      <AiWorkflowPanel />
    </ToolPageLayout>
  );
}
