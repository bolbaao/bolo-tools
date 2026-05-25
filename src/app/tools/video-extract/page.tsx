import ToolPageLayout from "@/components/ToolPageLayout";
import VideoExtractForm from "@/components/tools/VideoExtractForm";
import { getToolById } from "@/lib/tools";

export default function VideoExtractPage() {
  const tool = getToolById("video-extract")!;
  return (
    <ToolPageLayout tool={tool}>
      <VideoExtractForm />
    </ToolPageLayout>
  );
}
