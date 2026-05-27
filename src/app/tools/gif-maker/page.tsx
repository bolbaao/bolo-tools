import ToolPageLayout from "@/components/ToolPageLayout";
import GifMakerForm from "@/components/tools/GifMakerForm";
import { getToolById } from "@/lib/tools";

export default function GifMakerPage() {
  const tool = getToolById("gif-maker")!;
  return (
    <ToolPageLayout tool={tool}>
      <GifMakerForm />
    </ToolPageLayout>
  );
}
