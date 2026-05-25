import ToolPageLayout from "@/components/ToolPageLayout";
import MediaSearchPanel from "@/components/tools/MediaSearchPanel";
import { getToolById } from "@/lib/tools";

export default function MediaSearchPage() {
  const tool = getToolById("media-search")!;
  return (
    <ToolPageLayout tool={tool}>
      <MediaSearchPanel />
    </ToolPageLayout>
  );
}
