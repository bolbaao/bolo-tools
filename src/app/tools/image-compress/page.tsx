import ToolPageLayout from "@/components/ToolPageLayout";
import ImageCompressForm from "@/components/tools/ImageCompressForm";
import { getToolById } from "@/lib/tools";

export default function ImageCompressPage() {
  const tool = getToolById("image-compress")!;
  return (
    <ToolPageLayout tool={tool}>
      <ImageCompressForm />
    </ToolPageLayout>
  );
}
