import ToolPageLayout from "@/components/ToolPageLayout";
import AiVideoEditPanel from "@/components/tools/AiVideoEditPanel";
import { getToolById } from "@/lib/tools";

export default function AiVideoEditPage() {
  const tool = getToolById("ai-video-edit")!;
  return (
    <ToolPageLayout tool={tool}>
      <AiVideoEditPanel />
    </ToolPageLayout>
  );
}
