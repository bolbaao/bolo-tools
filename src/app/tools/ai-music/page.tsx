import ToolPageLayout from "@/components/ToolPageLayout";
import AiMusicForm from "@/components/tools/AiMusicForm";
import { getToolById } from "@/lib/tools";

export default function AiMusicPage() {
  const tool = getToolById("ai-music")!;
  return (
    <ToolPageLayout tool={tool}>
      <AiMusicForm />
    </ToolPageLayout>
  );
}
