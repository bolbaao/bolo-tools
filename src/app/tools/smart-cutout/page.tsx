import ToolPageLayout from "@/components/ToolPageLayout";
import SmartCutoutForm from "@/components/tools/SmartCutoutForm";
import { getToolById } from "@/lib/tools";

export default function SmartCutoutPage() {
  const tool = getToolById("smart-cutout")!;
  return (
    <ToolPageLayout tool={tool}>
      <SmartCutoutForm />
    </ToolPageLayout>
  );
}
