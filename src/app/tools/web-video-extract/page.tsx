import ToolPageLayout from "@/components/ToolPageLayout";
import WebVideoExtractPanel from "@/components/tools/WebVideoExtractPanel";
import { getToolById } from "@/lib/tools";

export default function WebVideoExtractPage() {
  const tool = getToolById("web-video-extract")!;
  return (
    <ToolPageLayout tool={tool}>
      <WebVideoExtractPanel />
    </ToolPageLayout>
  );
}
