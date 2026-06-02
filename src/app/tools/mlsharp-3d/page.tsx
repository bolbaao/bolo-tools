import ToolPageLayout from "@/components/ToolPageLayout";
import Mlsharp3DPanel from "@/components/tools/Mlsharp3DPanel";
import { getToolById } from "@/lib/tools";

export default function Mlsharp3DPage() {
  const tool = getToolById("mlsharp-3d")!;
  return (
    <ToolPageLayout tool={tool}>
      <Mlsharp3DPanel />
    </ToolPageLayout>
  );
}
