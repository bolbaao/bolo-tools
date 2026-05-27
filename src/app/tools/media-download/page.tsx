import ToolPageLayout from "@/components/ToolPageLayout";
import MediaDownloadPanel from "@/components/tools/MediaDownloadPanel";
import { getToolById } from "@/lib/tools";

export default function MediaDownloadPage() {
  const tool = getToolById("media-download")!;
  return (
    <ToolPageLayout tool={tool}>
      <MediaDownloadPanel />
    </ToolPageLayout>
  );
}
