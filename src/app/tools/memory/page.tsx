import ToolPageLayout from "@/components/ToolPageLayout";
import MemoryPanel from "@/components/tools/MemoryPanel";
import { getToolById } from "@/lib/tools";

export default function MemoryPage() {
  const tool = getToolById("memory")!;
  return (
    <ToolPageLayout tool={tool}>
      <MemoryPanel />
    </ToolPageLayout>
  );
}
