import ToolPageLayout from "@/components/ToolPageLayout";
import SubtitleWorkshopForm from "@/components/tools/SubtitleWorkshopForm";
import { getToolById } from "@/lib/tools";

export default function SubtitleWorkshopPage() {
  const tool = getToolById("subtitle-workshop")!;
  return (
    <ToolPageLayout tool={tool}>
      <SubtitleWorkshopForm />
    </ToolPageLayout>
  );
}
