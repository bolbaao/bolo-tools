import ToolPageLayout from "@/components/ToolPageLayout";
import AiWriterPanel from "@/components/tools/AiWriterPanel";
import { getToolById } from "@/lib/tools";

export default function AiWriterPage() {
  const tool = getToolById("ai-writer")!;
  return (
    <ToolPageLayout tool={tool}>
      <AiWriterPanel />
    </ToolPageLayout>
  );
}
