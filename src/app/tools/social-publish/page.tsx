import ToolPageLayout from "@/components/ToolPageLayout";
import SocialPublishPanel from "@/components/tools/SocialPublishPanel";
import { getToolById } from "@/lib/tools";

export default function SocialPublishPage() {
  const tool = getToolById("social-publish")!;
  return (
    <ToolPageLayout tool={tool}>
      <SocialPublishPanel />
    </ToolPageLayout>
  );
}
