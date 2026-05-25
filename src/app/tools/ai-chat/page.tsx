import ToolPageLayout from "@/components/ToolPageLayout";
import AiChatPanel from "@/components/tools/AiChatPanel";
import { getToolById } from "@/lib/tools";

export default function AiChatPage() {
  const tool = getToolById("ai-chat")!;
  return (
    <ToolPageLayout tool={tool}>
      <AiChatPanel />
    </ToolPageLayout>
  );
}
