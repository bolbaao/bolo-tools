import ToolPageLayout from "@/components/ToolPageLayout";
import TextToolboxForm from "@/components/tools/TextToolboxForm";
import { getToolById } from "@/lib/tools";

export default function TextToolboxPage() {
  const tool = getToolById("text-toolbox")!;
  return (
    <ToolPageLayout tool={tool}>
      <TextToolboxForm />
    </ToolPageLayout>
  );
}
