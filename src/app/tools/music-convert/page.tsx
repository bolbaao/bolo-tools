import ToolPageLayout from "@/components/ToolPageLayout";
import MusicConvertForm from "@/components/tools/MusicConvertForm";
import { getToolById } from "@/lib/tools";

export default function MusicConvertPage() {
  const tool = getToolById("music-convert")!;
  return (
    <ToolPageLayout tool={tool}>
      <MusicConvertForm />
    </ToolPageLayout>
  );
}
