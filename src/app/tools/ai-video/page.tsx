import ToolPageLayout from "@/components/ToolPageLayout";
import AiVideoForm from "@/components/tools/AiVideoForm";
import { getToolById } from "@/lib/tools";

export default function AiVideoPage() {
  const tool = getToolById("ai-video")!;
  return (
    <ToolPageLayout tool={tool}>
      <AiVideoForm />
    </ToolPageLayout>
  );
}
