import ToolPageLayout from "@/components/ToolPageLayout";
import ImageSharpenForm from "@/components/tools/ImageSharpenForm";
import { getToolById } from "@/lib/tools";

export default function ImageSharpenPage() {
  const tool = getToolById("image-sharpen")!;
  return (
    <ToolPageLayout tool={tool}>
      <ImageSharpenForm />
    </ToolPageLayout>
  );
}
