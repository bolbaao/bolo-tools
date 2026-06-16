import ToolPageLayout from "@/components/ToolPageLayout";
import StoryboardPanel from "@/components/tools/StoryboardPanel";
import { getToolById } from "@/lib/tools";

export default function StoryboardPage() {
  const tool = getToolById("storyboard")!;
  return (
    <ToolPageLayout tool={tool}>
      <StoryboardPanel />
    </ToolPageLayout>
  );
}
